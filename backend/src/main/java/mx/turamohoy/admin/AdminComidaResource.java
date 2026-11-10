package mx.turamohoy.admin;

import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
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
import mx.turamohoy.catalogo.dto.RestauranteDto;
import mx.turamohoy.catalogo.dto.RestauranteDto.PlatilloDto;
import mx.turamohoy.catalogo.model.Negocio;
import mx.turamohoy.catalogo.model.Platillo;
import mx.turamohoy.catalogo.model.Restaurante;
import mx.turamohoy.catalogo.model.TipoNegocio;
import mx.turamohoy.fotos.ImagenesPermitidas;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Encarguitos → "Comida a domicilio" desde el panel: lugares de comida y sus platillos.
 * Nada se borra: un lugar se oculta y un platillo se marca como no disponible.
 */
@Path("/api/admin/negocios/{slug}/restaurantes")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@RolesAllowed({Rol.DUENO, Rol.ENCARGADO})
public class AdminComidaResource {

    @Inject
    SesionActual sesion;

    @Inject
    ImagenesPermitidas imagenes;

    public record RestauranteEdicion(
            @NotBlank(message = "El nombre es obligatorio.") @Size(max = 80) String nombre,
            @Size(max = 200) String descripcion,
            @Size(max = 120) String horario,
            @Size(max = 200) String direccion,
            String imagenUrl,
            @Min(0) @Max(999) Integer orden,
            Boolean visible) {
    }

    public record PlatilloEdicion(
            @NotBlank(message = "El nombre es obligatorio.") @Size(max = 100) String nombre,
            @Size(max = 300) String descripcion,
            @NotNull(message = "El precio es obligatorio.")
            @DecimalMin(value = "0", message = "El precio no puede ser negativo.")
            @DecimalMax(value = "99999.99", message = "El precio es demasiado alto.")
            @Digits(integer = 5, fraction = 2, message = "El precio lleva como máximo dos decimales.") BigDecimal precio,
            String imagenUrl,
            @Min(0) @Max(999) Integer orden,
            Boolean disponible) {
    }

    /** Todos los lugares (también ocultos) con todos sus platillos. */
    @GET
    public List<RestauranteDto> listar(@PathParam("slug") String slug) {
        List<Restaurante> lugares = Restaurante.delNegocio(servicio(slug));
        Map<Long, List<Platillo>> menu = Platillo.deRestaurantes(lugares, false).stream()
                .collect(Collectors.groupingBy(p -> p.restaurante.id));
        return lugares.stream().map(r -> RestauranteDto.de(r, menu.getOrDefault(r.id, List.of()))).toList();
    }

    @POST
    @Transactional
    public Response crear(@PathParam("slug") String slug, @Valid @NotNull RestauranteEdicion e) {
        Negocio n = servicio(slug);
        Restaurante r = new Restaurante();
        r.negocio = n;
        r.orden = Restaurante.delNegocio(n).stream().mapToInt(x -> x.orden).max().orElse(0) + 1;
        aplicar(n, r, e);
        r.persist();
        return Response.status(Status.CREATED).entity(RestauranteDto.de(r, List.of())).build();
    }

    @PUT
    @Path("/{id}")
    @Transactional
    public RestauranteDto editar(@PathParam("slug") String slug, @PathParam("id") Long id,
                                 @Valid @NotNull RestauranteEdicion e) {
        Negocio n = servicio(slug);
        Restaurante r = restaurante(n, id);
        aplicar(n, r, e);
        return RestauranteDto.de(r, Platillo.deRestaurantes(List.of(r), false));
    }

    @POST
    @Path("/{id}/platillos")
    @Transactional
    public Response crearPlatillo(@PathParam("slug") String slug, @PathParam("id") Long id,
                                  @Valid @NotNull PlatilloEdicion e) {
        Negocio n = servicio(slug);
        Restaurante r = restaurante(n, id);
        Platillo p = new Platillo();
        p.restaurante = r;
        p.orden = Platillo.deRestaurantes(List.of(r), false).stream().mapToInt(x -> x.orden).max().orElse(0) + 1;
        aplicar(n, p, e);
        p.persist();
        return Response.status(Status.CREATED).entity(PlatilloDto.de(p)).build();
    }

    @PUT
    @Path("/{id}/platillos/{platilloId}")
    @Transactional
    public PlatilloDto editarPlatillo(@PathParam("slug") String slug, @PathParam("id") Long id,
                                      @PathParam("platilloId") Long platilloId, @Valid @NotNull PlatilloEdicion e) {
        Negocio n = servicio(slug);
        Restaurante r = restaurante(n, id);
        Platillo p = Platillo.findById(platilloId);
        if (p == null || !p.restaurante.id.equals(r.id)) {
            throw Errores.de(Status.NOT_FOUND, "No existe ese platillo en " + r.nombre + ".");
        }
        aplicar(n, p, e);
        return PlatilloDto.de(p);
    }

    private Negocio servicio(String slug) {
        Negocio n = sesion.negocioEditable(slug);
        if (n.tipo != TipoNegocio.SERVICIO) {
            throw Errores.de(Status.BAD_REQUEST, n.nombre + " no tiene comida a domicilio.");
        }
        return n;
    }

    private static Restaurante restaurante(Negocio n, Long id) {
        Restaurante r = Restaurante.findById(id);
        if (r == null || !r.negocio.id.equals(n.id)) {
            throw Errores.de(Status.NOT_FOUND, "No existe ese lugar de comida.");
        }
        return r;
    }

    private void aplicar(Negocio n, Restaurante r, RestauranteEdicion e) {
        r.nombre = e.nombre().trim();
        r.descripcion = AdminNegocioResource.limpio(e.descripcion());
        r.horario = AdminNegocioResource.limpio(e.horario());
        r.direccion = AdminNegocioResource.limpio(e.direccion());
        r.imagenUrl = imagenes.validar(n, e.imagenUrl());
        if (e.orden() != null) {
            r.orden = e.orden();
        }
        if (e.visible() != null) {
            r.visible = e.visible();
        }
    }

    private void aplicar(Negocio n, Platillo p, PlatilloEdicion e) {
        p.nombre = e.nombre().trim();
        p.descripcion = AdminNegocioResource.limpio(e.descripcion());
        p.precio = e.precio();
        p.imagenUrl = imagenes.validar(n, e.imagenUrl());
        if (e.orden() != null) {
            p.orden = e.orden();
        }
        if (e.disponible() != null) {
            p.disponible = e.disponible();
        }
    }
}
