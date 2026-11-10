package mx.turamohoy.catalogo.resource;

import io.quarkus.panache.common.Sort;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import mx.turamohoy.catalogo.dto.CategoriaDto;
import mx.turamohoy.catalogo.dto.NegocioDto;
import mx.turamohoy.catalogo.dto.ProductoDto;
import mx.turamohoy.catalogo.dto.RestauranteDto;
import mx.turamohoy.catalogo.dto.TipoEncargoDto;
import mx.turamohoy.catalogo.model.Categoria;
import mx.turamohoy.catalogo.model.Negocio;
import mx.turamohoy.catalogo.model.Platillo;
import mx.turamohoy.catalogo.model.Producto;
import mx.turamohoy.catalogo.model.Restaurante;
import mx.turamohoy.catalogo.model.TipoEncargo;
import mx.turamohoy.catalogo.model.TipoNegocio;

import java.util.List;
import java.util.stream.Collectors;
import java.util.Map;

@Path("/api/negocios")
@Produces(MediaType.APPLICATION_JSON)
public class NegocioResource {

    /** Negocios de la portada, en orden. */
    @GET
    public List<NegocioDto> listar() {
        return Negocio.<Negocio>list("visible", Sort.by("orden"), true).stream()
                .map(NegocioDto::resumen)
                .toList();
    }

    /** Un negocio con su contacto y sus categorías. */
    @GET
    @Path("/{slug}")
    public NegocioDto obtener(@PathParam("slug") String slug) {
        Negocio negocio = buscar(slug);
        List<CategoriaDto> categorias = Categoria.delNegocio(negocio).stream()
                .map(c -> new CategoriaDto(c.id, negocio.slug, c.slug, c.nombre, c.descripcion))
                .toList();
        List<TipoEncargoDto> tipos = negocio.tipo == TipoNegocio.SERVICIO
                ? TipoEncargo.visiblesDe(negocio).stream().map(TipoEncargoDto::de).toList()
                : List.of();
        return NegocioDto.de(negocio, categorias, tipos);
    }

    /** Productos disponibles del negocio. Con {@code ?categoria=ramos} filtra por categoría. */
    @GET
    @Path("/{slug}/productos")
    public List<ProductoDto> productos(@PathParam("slug") String slug,
                                       @QueryParam("categoria") String categoria) {
        Negocio negocio = buscar(slug);
        List<Producto> productos = (categoria == null || categoria.isBlank())
                ? Producto.disponiblesDelNegocio(negocio.slug)
                : Producto.disponiblesDelNegocio(negocio.slug, categoria.trim());
        return productos.stream().map(ProductoDto::de).toList();
    }

    private static Negocio buscar(String slug) {
        return Negocio.visiblePorSlug(slug)
                .orElseThrow(() -> new NotFoundException("Negocio no encontrado: " + slug));
    }

    /** Encarguitos: lugares de comida visibles con sus platillos disponibles. */
    @GET
    @Path("/{slug}/restaurantes")
    public List<RestauranteDto> restaurantes(@PathParam("slug") String slug) {
        Negocio negocio = Negocio.visiblePorSlug(slug)
                .orElseThrow(() -> new NotFoundException("No existe el negocio " + slug));
        List<Restaurante> lugares = Restaurante.visiblesDe(negocio);
        Map<Long, List<Platillo>> menu = Platillo.deRestaurantes(lugares, true).stream()
                .collect(Collectors.groupingBy(p -> p.restaurante.id));
        return lugares.stream()
                .filter(r -> menu.containsKey(r.id))
                .map(r -> RestauranteDto.de(r, menu.get(r.id)))
                .toList();
    }
}
