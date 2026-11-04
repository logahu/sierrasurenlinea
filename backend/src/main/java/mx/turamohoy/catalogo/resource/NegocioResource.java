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
import mx.turamohoy.catalogo.model.Categoria;
import mx.turamohoy.catalogo.model.Negocio;
import mx.turamohoy.catalogo.model.Producto;

import java.util.List;

@Path("/api/negocios")
@Produces(MediaType.APPLICATION_JSON)
public class NegocioResource {

    /** Negocios de la portada, en orden. */
    @GET
    public List<NegocioDto> listar() {
        return Negocio.<Negocio>listAll(Sort.by("orden")).stream()
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
        return NegocioDto.de(negocio, categorias);
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
        return Negocio.porSlug(slug)
                .orElseThrow(() -> new NotFoundException("Negocio no encontrado: " + slug));
    }
}
