package mx.turamohoy.admin;

import io.quarkus.panache.common.Sort;
import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.Response.Status;
import mx.turamohoy.catalogo.model.Negocio;
import mx.turamohoy.historial.Bitacora;

import java.util.List;

/**
 * Usuarios del panel: administradores (máximo 2), encargados (uno por negocio) y repartidores.
 * Solo un administrador. Sin borrados: se quita el acceso (baja lógica) y se puede devolver.
 */
@Path("/api/admin/usuarios")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@RolesAllowed(Rol.DUENO)
public class AdminUsuarioResource {

    @Inject
    SesionActual sesion;

    public record NuevoEncargado(
            @NotBlank(message = "El nombre es obligatorio.") @Size(max = 80) String nombre,
            /** 10 dígitos: con él entra al panel. */
            @NotBlank(message = "El teléfono es obligatorio.") String telefono,
            /** Opcional; también sirve para entrar. */
            @Email(message = "El correo no es válido.") @Size(max = 120) String correo,
            @NotBlank(message = "La contraseña es obligatoria.") String contrasena,
            /** Obligatorio para encargados; vacío en administradores y en repartidores generales. */
            String negocioSlug,
            /** DUENO (administrador, máximo 2), ENCARGADO (uno por negocio) o REPARTIDOR; vacío = ENCARGADO. */
            String rol) {
    }

    /** Para el administrador solo se toman en cuenta nombre, teléfono, correo y acceso. */
    public record EdicionUsuario(
            @NotBlank(message = "El nombre es obligatorio.") @Size(max = 80) String nombre,
            /** Si viene, se cambia (10 dígitos, sin repetir). */
            String telefono,
            /** Si viene, se cambia; vacío lo quita. */
            @Email(message = "El correo no es válido.") @Size(max = 120) String correo,
            String negocioSlug,
            Boolean activo) {
    }

    public record NuevaContrasena(@NotBlank String nueva) {
    }

    @GET
    public List<UsuarioDto> listar() {
        sesion.usuario();
        java.util.Map<Long, Long> entregas = mx.turamohoy.pedidos.Pedido.getEntityManager()
                .createQuery("select p.repartidor.id, count(p) from Pedido p where p.repartidor is not null"
                        + " and p.estado = :e group by p.repartidor.id", Object[].class)
                .setParameter("e", mx.turamohoy.pedidos.Pedido.ENTREGADO).getResultList().stream()
                .collect(java.util.stream.Collectors.toMap(f -> (Long) f[0], f -> (Long) f[1]));
        return Usuario.<Usuario>listAll(Sort.by("rol").and("nombre")).stream()
                .map(u -> UsuarioDto.de(u, entregas.getOrDefault(u.id, 0L))).toList();
    }

    @POST
    @Transactional
    public Response crear(@Valid @NotNull NuevoEncargado req) {
        sesion.usuario();
        String telefono = telefonoLibre(req.telefono(), null);
        String correo = correoLibre(req.correo(), null);
        Contrasenas.validarNueva(req.contrasena());
        String rol = req.rol() == null || req.rol().isBlank() ? Rol.ENCARGADO : req.rol();
        if (!Rol.DUENO.equals(rol) && !Rol.ENCARGADO.equals(rol) && !Rol.REPARTIDOR.equals(rol) && !Rol.EMPLEADO.equals(rol)) {
            throw Errores.de(Status.BAD_REQUEST, "El rol debe ser administrador, encargado, repartidor o empleado.");
        }
        Negocio negocio = null;
        if (Rol.DUENO.equals(rol)) {
            exigirCupoDeAdministrador();
        } else if (Rol.REPARTIDOR.equals(rol) && (req.negocioSlug() == null || req.negocioSlug().isBlank())) {
            negocio = null; // repartidor general: entrega pedidos de todos los negocios
        } else {
            if (req.negocioSlug() == null || req.negocioSlug().isBlank()) {
                throw Errores.de(Status.BAD_REQUEST, "Elige el negocio.");
            }
            negocio = negocio(req.negocioSlug());
            if (Rol.ENCARGADO.equals(rol)) {
                exigirSinEncargado(negocio, null);
            }
        }

        Usuario u = new Usuario();
        u.correo = correo;
        u.telefono = telefono;
        u.nombre = req.nombre().trim();
        u.rol = rol;
        u.negocio = negocio;
        u.contrasenaHash = Contrasenas.cifrar(req.contrasena());
        u.persist();
        Bitacora.anotar(sesion.usuario(), negocio, Bitacora.USUARIO, u.id,
                "Dio de alta a " + u.nombre + " como " + nombreRol(u),
                "Teléfono " + u.telefono + (u.correo == null ? "" : " · " + u.correo));
        return Response.status(Status.CREATED).entity(UsuarioDto.de(u)).build();
    }

    @PUT
    @Path("/{id}")
    @Transactional
    public UsuarioDto editar(@PathParam("id") Long id, @Valid @NotNull EdicionUsuario req) {
        Usuario u = buscar(id);
        u.nombre = req.nombre().trim();
        if (req.telefono() != null) {
            String t = telefonoLibre(req.telefono(), u);
            if (!t.equals(u.telefono)) {
                Bitacora.anotar(sesion.usuario(), u.negocio, Bitacora.USUARIO, u.id, "Cambió el teléfono de " + u.nombre,
                        (u.telefono == null ? "(vacío)" : u.telefono) + " → " + t);
                u.telefono = t;
            }
        }
        if (req.correo() != null) {
            u.correo = req.correo().isBlank() ? null : correoLibre(req.correo(), u);
        }
        if (u.esDueno()) {
            // Administradores: solo nombre y baja lógica; nadie se da de baja a sí mismo
            // y siempre queda al menos uno activo.
            boolean activo = req.activo() == null ? u.activo : req.activo();
            if (!activo && u.activo) {
                if (u.id.equals(sesion.usuario().id)) {
                    throw Errores.de(Status.CONFLICT, "No puedes quitarte el acceso a ti mismo.");
                }
            } else if (activo && !u.activo) {
                exigirCupoDeAdministrador();
            }
            anotarAcceso(u, activo);
            u.activo = activo;
            return UsuarioDto.de(u);
        }
        Negocio negocio = req.negocioSlug() == null ? u.negocio : negocio(req.negocioSlug());
        boolean activo = req.activo() == null ? u.activo : req.activo();
        if (activo && Rol.ENCARGADO.equals(u.rol)) {
            exigirSinEncargado(negocio, u);
        }
        if (u.negocio != negocio) {
            Bitacora.anotar(sesion.usuario(), negocio, Bitacora.USUARIO, u.id, "Cambió de negocio a " + u.nombre,
                    (u.negocio == null ? "todos" : u.negocio.nombre) + " → " + (negocio == null ? "todos" : negocio.nombre));
        }
        anotarAcceso(u, activo);
        u.negocio = negocio;
        u.activo = activo;
        return UsuarioDto.de(u);
    }

    /** El dueño pone una contraseña nueva (p. ej. si el encargado la olvidó) y quita el bloqueo. */
    @PUT
    @Path("/{id}/contrasena")
    @Transactional
    public void reiniciarContrasena(@PathParam("id") Long id, @Valid @NotNull NuevaContrasena req) {
        Usuario u = buscar(id);
        Contrasenas.validarNueva(req.nueva());
        u.contrasenaHash = Contrasenas.cifrar(req.nueva());
        u.intentosFallidos = 0;
        u.bloqueadoHasta = null;
        Bitacora.anotar(sesion.usuario(), u.negocio, Bitacora.USUARIO, u.id, "Puso una contraseña nueva a " + u.nombre, null);
    }

    private void anotarAcceso(Usuario u, boolean activo) {
        if (u.activo != activo) {
            Bitacora.anotar(sesion.usuario(), u.negocio, Bitacora.USUARIO, u.id,
                    (activo ? "Devolvió el acceso a " : "Quitó el acceso a ") + u.nombre, nombreRol(u));
        }
    }

    static String nombreRol(Usuario u) {
        return switch (u.rol) {
            case Rol.DUENO -> "administrador";
            case Rol.REPARTIDOR -> u.negocio == null ? "repartidor de todos los negocios" : "repartidor de " + u.negocio.nombre;
            case Rol.EMPLEADO -> "empleado de " + (u.negocio == null ? "?" : u.negocio.nombre);
            default -> "encargado de " + (u.negocio == null ? "?" : u.negocio.nombre);
        };
    }

    private Usuario buscar(Long id) {
        sesion.usuario();
        Usuario u = Usuario.findById(id);
        if (u == null) {
            throw Errores.de(Status.NOT_FOUND, "No existe ese usuario.");
        }
        return u;
    }

    private static Negocio negocio(String slug) {
        return Negocio.porSlug(slug)
                .orElseThrow(() -> Errores.de(Status.BAD_REQUEST, "No existe el negocio " + slug + "."));
    }

    /** Teléfono normalizado a 10 dígitos que nadie más del equipo usa. */
    static String telefonoLibre(String telefono, Usuario excepto) {
        String t = mx.turamohoy.clientes.Cliente.normalizarTelefono(telefono);
        if (t == null) {
            throw Errores.de(Status.BAD_REQUEST, "El teléfono debe tener 10 dígitos.");
        }
        Usuario.<Usuario>find("telefono", t).firstResultOptional()
                .filter(otro -> excepto == null || !otro.id.equals(excepto.id))
                .ifPresent(otro -> {
                    throw Errores.de(Status.CONFLICT, "El teléfono " + t + " ya es de " + otro.nombre + ".");
                });
        return t;
    }

    /** Correo normalizado (o null si no se dio) que nadie más del equipo usa. */
    static String correoLibre(String correo, Usuario excepto) {
        if (correo == null || correo.isBlank()) {
            return null;
        }
        String c = Usuario.normalizarCorreo(correo);
        Usuario.porCorreo(c).filter(otro -> excepto == null || !otro.id.equals(excepto.id))
                .ifPresent(otro -> {
                    throw Errores.de(Status.CONFLICT, "Ya existe un usuario con el correo " + c + ".");
                });
        return c;
    }

    /** Máximo dos administradores activos. */
    static final int MAX_ADMINISTRADORES = 2;

    private static void exigirCupoDeAdministrador() {
        long activos = Usuario.count("rol = ?1 and activo = true", Rol.DUENO);
        if (activos >= MAX_ADMINISTRADORES) {
            throw Errores.de(Status.CONFLICT, "Ya hay " + MAX_ADMINISTRADORES + " administradores activos.");
        }
    }

    private static void exigirSinEncargado(Negocio negocio, Usuario excepto) {
        Usuario.encargadoDe(negocio)
                .filter(otro -> excepto == null || !otro.id.equals(excepto.id))
                .ifPresent(otro -> {
                    throw Errores.de(Status.CONFLICT,
                            negocio.nombre + " ya tiene encargado: " + otro.nombre + ". Desactívalo primero.");
                });
    }
}
