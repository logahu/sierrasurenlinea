package mx.turamohoy.admin;

import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
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
import mx.turamohoy.catalogo.dto.TipoEncargoDto;
import mx.turamohoy.catalogo.model.Negocio;
import mx.turamohoy.catalogo.model.TipoEncargo;
import mx.turamohoy.catalogo.model.TipoNegocio;

import java.util.List;

/**
 * "Tu lista del mandado" de Encarguitos desde el panel: las tarjetas de ¿Qué necesitas?
 * (súper, llevar algo, pagos, viaje en moto...). No se borran: se ocultan.
 */
@Path("/api/admin/negocios/{slug}/tipos-encargo")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@RolesAllowed({Rol.DUENO, Rol.ENCARGADO})
public class AdminTiposEncargoResource {

    @Inject
    SesionActual sesion;

    public record TipoEncargoEdicion(
            @NotBlank(message = "El título es obligatorio.") @Size(max = 60) String titulo,
            @Size(max = 80) String ayuda,
            @Size(max = 200) String ejemplo,
            @NotBlank(message = "Falta la etiqueta de \"dónde empezamos\".") @Size(max = 60) String etiquetaRecoger,
            boolean recogerObligatorio,
            boolean manejaDinero,
            @NotBlank String modo,
            @NotBlank String icono,
            boolean soloProgramado,
            @Min(0) @Max(999) Integer orden,
            Boolean visible) {
    }

    @GET
    public List<TipoEncargoDto> listar(@PathParam("slug") String slug) {
        return TipoEncargo.delNegocio(servicio(slug)).stream().map(TipoEncargoDto::de).toList();
    }

    @POST
    @Transactional
    public Response crear(@PathParam("slug") String slug, @Valid @NotNull TipoEncargoEdicion e) {
        Negocio n = servicio(slug);
        TipoEncargo t = new TipoEncargo();
        t.negocio = n;
        t.orden = TipoEncargo.delNegocio(n).stream().mapToInt(x -> x.orden).max().orElse(0) + 1;
        aplicar(t, e);
        t.persist();
        return Response.status(Status.CREATED).entity(TipoEncargoDto.de(t)).build();
    }

    @PUT
    @Path("/{id}")
    @Transactional
    public TipoEncargoDto editar(@PathParam("slug") String slug, @PathParam("id") Long id,
                                 @Valid @NotNull TipoEncargoEdicion e) {
        Negocio n = servicio(slug);
        TipoEncargo t = TipoEncargo.findById(id);
        if (t == null || !t.negocio.id.equals(n.id)) {
            throw Errores.de(Status.NOT_FOUND, "No existe esa opción en " + n.nombre + ".");
        }
        aplicar(t, e);
        return TipoEncargoDto.de(t);
    }

    private Negocio servicio(String slug) {
        Negocio n = sesion.negocioEditable(slug);
        if (n.tipo != TipoNegocio.SERVICIO) {
            throw Errores.de(Status.BAD_REQUEST, n.nombre + " no tiene lista del mandado.");
        }
        return n;
    }

    private static void aplicar(TipoEncargo t, TipoEncargoEdicion e) {
        if (!TipoEncargo.MODOS.contains(e.modo())) {
            throw Errores.de(Status.BAD_REQUEST, "El modo debe ser MANDADO o VIAJE.");
        }
        if (!TipoEncargo.ICONOS.contains(e.icono())) {
            throw Errores.de(Status.BAD_REQUEST, "Ese ícono no existe.");
        }
        t.titulo = e.titulo().trim();
        t.ayuda = AdminNegocioResource.limpio(e.ayuda());
        t.ejemplo = AdminNegocioResource.limpio(e.ejemplo());
        t.etiquetaRecoger = e.etiquetaRecoger().trim();
        t.recogerObligatorio = e.recogerObligatorio();
        t.modo = e.modo();
        // En un viaje no se compra nada: no aplica quién paga la compra.
        t.manejaDinero = TipoEncargo.MANDADO.equals(e.modo()) && e.manejaDinero();
        t.icono = e.icono();
        t.soloProgramado = e.soloProgramado();
        if (e.orden() != null) {
            t.orden = e.orden();
        }
        if (e.visible() != null) {
            t.visible = e.visible();
        }
    }
}
