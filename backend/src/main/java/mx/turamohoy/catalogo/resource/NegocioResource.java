package mx.turamohoy.catalogo.resource;

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

    /** Para saber si quien pide es un probador (ve también los negocios en pruebas). */
    @jakarta.inject.Inject
    mx.turamohoy.clientes.SesionCliente sesionCliente;

    /**
     * Negocios de la portada en orden «Recomendados»: primero los patrocinados (anuncio
     * DIRECTORIO vigente, por el orden del anuncio) y luego el resto por su orden.
     * Con {@code ?giro=flores} solo los de ese giro.
     */
    @GET
    public List<NegocioDto> listar(@QueryParam("giro") String giro) {
        List<String> estados = Negocio.estadosVisibles(sesionCliente.esProbador());
        String q = "select n from Negocio n join fetch n.giro g where n.estado in ?1";
        List<Negocio> negocios = (giro == null || giro.isBlank())
                ? Negocio.<Negocio>find(q + " order by n.orden", estados).list()
                : Negocio.<Negocio>find(q + " and g.slug = ?2 order by n.orden", estados, giro.trim()).list();
        java.util.Map<Long, Integer> patrocinados = mx.turamohoy.publicidad.Anuncio.patrocinados(
                mx.turamohoy.publicidad.Anuncio.hoy());
        return negocios.stream()
                .sorted(java.util.Comparator.comparingInt(n -> patrocinados.getOrDefault(n.id, Integer.MAX_VALUE)))
                .map(n -> NegocioDto.resumen(n, patrocinados.containsKey(n.id)))
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

    private Negocio buscar(String slug) {
        return Negocio.visiblePorSlug(slug, sesionCliente.esProbador())
                .orElseThrow(() -> new NotFoundException("Negocio no encontrado: " + slug));
    }

    /** Encarguitos: lugares de comida visibles con sus platillos disponibles. */
    @GET
    @Path("/{slug}/restaurantes")
    public List<RestauranteDto> restaurantes(@PathParam("slug") String slug) {
        Negocio negocio = Negocio.visiblePorSlug(slug, sesionCliente.esProbador())
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
