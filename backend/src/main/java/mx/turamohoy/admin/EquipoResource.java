package mx.turamohoy.admin;

import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
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
import java.util.Optional;

/**
 * «Mi equipo»: el encargado (o el administrador) da de alta, edita y quita el acceso a los
 * empleados de su negocio. Solo empleados: no puede crear encargados, repartidores ni administradores.
 */
@Path("/api/admin/negocios/{slug}/equipo")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@RolesAllowed({Rol.DUENO, Rol.ENCARGADO})
public class EquipoResource {

    @Inject
    SesionActual sesion;

    public record Equipo(List<UsuarioDto> empleados, UsuarioDto encargado) {
    }

    public record NuevoEmpleado(
            @NotBlank(message = "El nombre es obligatorio.") @Size(max = 80) String nombre,
            @NotBlank(message = "El teléfono es obligatorio.") String telefono,
            @NotBlank(message = "La contraseña es obligatoria.") String contrasena,
            @Size(max = 200) String especialidades) {
    }

    public record EdicionEmpleado(
            @NotBlank(message = "El nombre es obligatorio.") @Size(max = 80) String nombre,
            String telefono,
            @Size(max = 200) String especialidades,
            Boolean activo) {
    }

    public record NuevaContrasena(@NotBlank String nueva) {
    }

    public record Atiende(boolean atiende) {
    }

    @GET
    public Equipo listar(@PathParam("slug") String slug) {
        Negocio n = sesion.negocioEditable(slug);
        List<UsuarioDto> empleados = Usuario.<Usuario>list("negocio = ?1 and rol = ?2 order by activo desc, nombre",
                n, Rol.EMPLEADO).stream().map(UsuarioDto::de).toList();
        Optional<Usuario> encargado = Usuario.encargadoDe(n);
        return new Equipo(empleados, encargado.map(UsuarioDto::de).orElse(null));
    }

    @POST
    @Transactional
    public Response crear(@PathParam("slug") String slug, @Valid @NotNull NuevoEmpleado req) {
        Negocio n = sesion.negocioEditable(slug);
        String telefono = AdminUsuarioResource.telefonoLibre(req.telefono(), null);
        Contrasenas.validarNueva(req.contrasena());
        Usuario u = new Usuario();
        u.nombre = req.nombre().trim();
        u.telefono = telefono;
        u.rol = Rol.EMPLEADO;
        u.negocio = n;
        u.especialidades = limpio(req.especialidades());
        u.contrasenaHash = Contrasenas.cifrar(req.contrasena());
        u.persist();
        Bitacora.anotar(sesion.usuario(), n, Bitacora.USUARIO, u.id, "Dio de alta a " + u.nombre + " como empleado de " + n.nombre,
                "Teléfono " + u.telefono + (u.especialidades == null ? "" : " · " + u.especialidades));
        return Response.status(Status.CREATED).entity(UsuarioDto.de(u)).build();
    }

    @PUT
    @Path("/{id}")
    @Transactional
    public UsuarioDto editar(@PathParam("slug") String slug, @PathParam("id") Long id, @Valid @NotNull EdicionEmpleado req) {
        Negocio n = sesion.negocioEditable(slug);
        Usuario u = empleado(n, id);
        u.nombre = req.nombre().trim();
        if (req.telefono() != null && !req.telefono().isBlank()) {
            u.telefono = AdminUsuarioResource.telefonoLibre(req.telefono(), u);
        }
        u.especialidades = limpio(req.especialidades());
        if (req.activo() != null && req.activo() != u.activo) {
            Bitacora.anotar(sesion.usuario(), n, Bitacora.USUARIO, u.id,
                    (req.activo() ? "Devolvió el acceso a " : "Quitó el acceso a ") + u.nombre, "empleado de " + n.nombre);
            u.activo = req.activo();
        }
        return UsuarioDto.de(u);
    }

    @PUT
    @Path("/{id}/contrasena")
    @Transactional
    public void contrasena(@PathParam("slug") String slug, @PathParam("id") Long id, @Valid @NotNull NuevaContrasena req) {
        Negocio n = sesion.negocioEditable(slug);
        Usuario u = empleado(n, id);
        Contrasenas.validarNueva(req.nueva());
        u.contrasenaHash = Contrasenas.cifrar(req.nueva());
        u.intentosFallidos = 0;
        u.bloqueadoHasta = null;
        Bitacora.anotar(sesion.usuario(), n, Bitacora.USUARIO, u.id, "Puso una contraseña nueva a " + u.nombre, null);
    }

    /** El encargado también atiende citas (aparece en la agenda para que el cliente lo elija). */
    @PUT
    @Path("/encargado-atiende")
    @Transactional
    public UsuarioDto encargadoAtiende(@PathParam("slug") String slug, @NotNull Atiende req) {
        Negocio n = sesion.negocioEditable(slug);
        Usuario e = Usuario.encargadoDe(n).orElseThrow(() -> Errores.de(Status.NOT_FOUND, "Este negocio no tiene encargado."));
        e.atiendeCitas = req.atiende();
        Bitacora.anotar(sesion.usuario(), n, Bitacora.USUARIO, e.id,
                e.nombre + (req.atiende() ? " atiende citas" : " ya no atiende citas"), null);
        return UsuarioDto.de(e);
    }

    private static Usuario empleado(Negocio n, Long id) {
        Usuario u = Usuario.findById(id);
        if (u == null || !Rol.EMPLEADO.equals(u.rol) || u.negocio == null || !u.negocio.id.equals(n.id)) {
            throw Errores.de(Status.NOT_FOUND, "No existe ese empleado en tu negocio.");
        }
        return u;
    }

    private static String limpio(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
