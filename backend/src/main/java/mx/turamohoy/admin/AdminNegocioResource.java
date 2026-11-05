package mx.turamohoy.admin;

import io.quarkus.panache.common.Sort;
import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response.Status;
import mx.turamohoy.catalogo.model.Negocio;
import mx.turamohoy.catalogo.model.Producto;

import java.util.List;

/**
 * Datos de cada negocio desde el panel. El dueño ve y edita los cinco; el encargado,
 * solo el suyo y sin poder cambiar nombre, color ni ocultarlo.
 */
@Path("/api/admin/negocios")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@RolesAllowed({Rol.DUENO, Rol.ENCARGADO})
public class AdminNegocioResource {

    @Inject
    SesionActual sesion;

    /**
     * Lo que se puede cambiar. {@code nombre}, {@code colorPrimario} y {@code visible} solo
     * los aplica el dueño; si los manda un encargado se ignoran.
     */
    public record NegocioEdicion(
            @NotBlank(message = "El nombre es obligatorio.") @Size(max = 80) String nombre,
            @Size(max = 140) String eslogan,
            @Size(max = 600) String descripcion,
            @NotBlank(message = "El WhatsApp es obligatorio.") String whatsapp,
            @Size(max = 30) String telefono,
            @Size(max = 200) String direccion,
            @Size(max = 120) String horario,
            @Pattern(regexp = "#[0-9a-fA-F]{6}", message = "El color va en formato #rrggbb.") String colorPrimario,
            Boolean visible) {
    }

    @GET
    public List<NegocioAdminDto> listar() {
        Usuario u = sesion.usuario();
        List<Negocio> negocios = u.esDueno()
                ? Negocio.listAll(Sort.by("orden"))
                : List.of(u.negocio);
        return negocios.stream().map(AdminNegocioResource::aDto).toList();
    }

    @GET
    @Path("/{slug}")
    public NegocioAdminDto obtener(@PathParam("slug") String slug) {
        return aDto(sesion.negocioEditable(slug));
    }

    @PUT
    @Path("/{slug}")
    @Transactional
    public NegocioAdminDto guardar(@PathParam("slug") String slug, @Valid @NotNull NegocioEdicion e) {
        Negocio n = sesion.negocioEditable(slug);
        n.eslogan = limpio(e.eslogan());
        n.descripcion = limpio(e.descripcion());
        n.whatsapp = Telefonos.whatsapp(e.whatsapp());
        n.telefono = limpio(e.telefono());
        n.direccion = limpio(e.direccion());
        n.horario = limpio(e.horario());
        if (sesion.usuario().esDueno()) {
            n.nombre = e.nombre().trim();
            if (e.colorPrimario() != null) {
                n.colorPrimario = e.colorPrimario().toLowerCase();
            }
            if (e.visible() != null) {
                n.visible = e.visible();
            }
        }
        return aDto(n);
    }

    private static NegocioAdminDto aDto(Negocio n) {
        long activos = Producto.count("disponible = true and categoria.negocio = ?1", n);
        String encargado = Usuario.encargadoDe(n).map(u -> u.nombre).orElse(null);
        return NegocioAdminDto.de(n, activos, encargado);
    }

    /** Texto sin espacios de más; vacío se guarda como nulo. */
    static String limpio(String s) {
        if (s == null) {
            return null;
        }
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }

    /** Normaliza el número para wa.me: solo dígitos y con lada de país. */
    static final class Telefonos {
        private Telefonos() {
        }

        static String whatsapp(String capturado) {
            String digitos = capturado == null ? "" : capturado.replaceAll("\\D", "");
            if (digitos.length() == 10) {
                digitos = "52" + digitos; // número mexicano capturado sin lada de país
            }
            if (digitos.length() < 11 || digitos.length() > 15) {
                throw Errores.de(Status.BAD_REQUEST,
                        "El WhatsApp debe tener 10 dígitos (o la lada de país y el número).");
            }
            return digitos;
        }
    }
}
