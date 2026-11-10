package mx.turamohoy.admin;

import io.quarkus.panache.common.Sort;
import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
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
import mx.turamohoy.historial.Bitacora;
import mx.turamohoy.historial.Cambios;
import mx.turamohoy.catalogo.model.Producto;
import mx.turamohoy.catalogo.model.TipoNegocio;
import mx.turamohoy.fotos.ImagenesPermitidas;

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

    @Inject
    ImagenesPermitidas imagenes;

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
            Boolean visible,
            @Min(value = 0, message = "El tope no puede ser negativo.")
            @Max(value = 100000, message = "El tope es demasiado alto.") Integer topeAdelanto,
            /** Foto de portada subida con /fotos o una de ejemplo; vacío = no cambia. */
            String portadaUrl) {
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
        Cambios c = new Cambios();
        String nombre = n.nombre, eslogan = n.eslogan, descripcion = n.descripcion, whatsapp = n.whatsapp,
                telefono = n.telefono, direccion = n.direccion, horario = n.horario, portadaAntes = n.portadaUrl,
                color = n.colorPrimario;
        Integer tope = n.topeAdelanto;
        boolean visible = n.visible;
        n.eslogan = limpio(e.eslogan());
        n.descripcion = limpio(e.descripcion());
        n.whatsapp = Telefonos.whatsapp(e.whatsapp());
        n.telefono = limpio(e.telefono());
        n.direccion = limpio(e.direccion());
        n.horario = limpio(e.horario());
        String portada = imagenes.validar(n, e.portadaUrl());
        if (portada != null) {
            n.portadaUrl = portada;
        }
        if (n.tipo == TipoNegocio.SERVICIO && e.topeAdelanto() != null) {
            n.topeAdelanto = e.topeAdelanto();
        }
        if (sesion.usuario().esDueno()) {
            n.nombre = e.nombre().trim();
            if (e.colorPrimario() != null) {
                n.colorPrimario = e.colorPrimario().toLowerCase();
            }
            if (e.visible() != null) {
                n.visible = e.visible();
            }
        }
        c.campo("Nombre", nombre, n.nombre).campo("Eslogan", eslogan, n.eslogan).largo("Descripción", descripcion, n.descripcion)
                .campo("WhatsApp", whatsapp, n.whatsapp).campo("Teléfono", telefono, n.telefono)
                .campo("Dirección", direccion, n.direccion).campo("Horario", horario, n.horario)
                .largo("Portada", portadaAntes, n.portadaUrl).campo("Color", color, n.colorPrimario)
                .campo("Tope de adelanto", tope, n.topeAdelanto).campo("Visible", visible, n.visible);
        if (c.hay()) {
            Bitacora.anotar(sesion.usuario(), n, Bitacora.NEGOCIO, n.id, "Editó los datos de " + n.nombre, c.toString());
        }
        return aDto(n);
    }

    public record Visibilidad(boolean visible) {
    }

    /** Mostrar u ocultar un negocio solo dentro de la app de Google Play. Solo el dueño. */
    @PUT
    @Path("/{slug}/visible-app")
    @RolesAllowed(Rol.DUENO)
    @Transactional
    public NegocioAdminDto cambiarVisibleApp(@PathParam("slug") String slug, @NotNull Visibilidad v) {
        Negocio n = sesion.negocioEditable(slug);
        if (n.visibleApp != v.visible()) {
            Bitacora.anotar(sesion.usuario(), n, Bitacora.NEGOCIO, n.id,
                    (v.visible() ? "Mostró " : "Ocultó ") + n.nombre + " en la app", null);
        }
        n.visibleApp = v.visible();
        return aDto(n);
    }

    /** Mostrar u ocultar un negocio en el sitio con un toque. Solo el dueño. */
    @PUT
    @Path("/{slug}/visible")
    @RolesAllowed(Rol.DUENO)
    @Transactional
    public NegocioAdminDto cambiarVisible(@PathParam("slug") String slug, @NotNull Visibilidad v) {
        Negocio n = sesion.negocioEditable(slug);
        if (n.visible != v.visible()) {
            Bitacora.anotar(sesion.usuario(), n, Bitacora.NEGOCIO, n.id,
                    (v.visible() ? "Mostró " : "Ocultó ") + n.nombre + " en el sitio", null);
        }
        n.visible = v.visible();
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
