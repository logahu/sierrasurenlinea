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
            @NotBlank(message = "El correo es obligatorio.") @Email(message = "El correo no es válido.")
            @Size(max = 120) String correo,
            @NotBlank(message = "La contraseña es obligatoria.") String contrasena,
            /** Obligatorio salvo para administradores. */
            String negocioSlug,
            /** DUENO (administrador, máximo 2), ENCARGADO (uno por negocio) o REPARTIDOR; vacío = ENCARGADO. */
            String rol) {
    }

    /** Para el dueño solo se toma en cuenta el nombre. */
    public record EdicionUsuario(
            @NotBlank(message = "El nombre es obligatorio.") @Size(max = 80) String nombre,
            String negocioSlug,
            Boolean activo) {
    }

    public record NuevaContrasena(@NotBlank String nueva) {
    }

    @GET
    public List<UsuarioDto> listar() {
        sesion.usuario();
        return Usuario.<Usuario>listAll(Sort.by("rol").and("nombre")).stream().map(UsuarioDto::de).toList();
    }

    @POST
    @Transactional
    public Response crear(@Valid @NotNull NuevoEncargado req) {
        sesion.usuario();
        String correo = Usuario.normalizarCorreo(req.correo());
        if (Usuario.porCorreo(correo).isPresent()) {
            throw Errores.de(Status.CONFLICT, "Ya existe un usuario con el correo " + correo + ".");
        }
        Contrasenas.validarNueva(req.contrasena());
        String rol = req.rol() == null || req.rol().isBlank() ? Rol.ENCARGADO : req.rol();
        if (!Rol.DUENO.equals(rol) && !Rol.ENCARGADO.equals(rol) && !Rol.REPARTIDOR.equals(rol)) {
            throw Errores.de(Status.BAD_REQUEST, "El rol debe ser administrador, encargado o repartidor.");
        }
        Negocio negocio = null;
        if (Rol.DUENO.equals(rol)) {
            exigirCupoDeAdministrador();
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
        u.nombre = req.nombre().trim();
        u.rol = rol;
        u.negocio = negocio;
        u.contrasenaHash = Contrasenas.cifrar(req.contrasena());
        u.persist();
        return Response.status(Status.CREATED).entity(UsuarioDto.de(u)).build();
    }

    @PUT
    @Path("/{id}")
    @Transactional
    public UsuarioDto editar(@PathParam("id") Long id, @Valid @NotNull EdicionUsuario req) {
        Usuario u = buscar(id);
        u.nombre = req.nombre().trim();
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
            u.activo = activo;
            return UsuarioDto.de(u);
        }
        Negocio negocio = req.negocioSlug() == null ? u.negocio : negocio(req.negocioSlug());
        boolean activo = req.activo() == null ? u.activo : req.activo();
        if (activo && Rol.ENCARGADO.equals(u.rol)) {
            exigirSinEncargado(negocio, u);
        }
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
