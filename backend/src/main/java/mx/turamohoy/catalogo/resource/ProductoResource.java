package mx.turamohoy.catalogo.resource;

import jakarta.ws.rs.GET;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import mx.turamohoy.catalogo.dto.ProductoDto;
import mx.turamohoy.catalogo.model.Producto;

import java.util.List;

@Path("/api/productos")
@Produces(MediaType.APPLICATION_JSON)
public class ProductoResource {

    /**
     * Lista los productos disponibles. Con {@code ?categoria=ramos} filtra por categoría.
     */
    @GET
    public List<ProductoDto> listar(@QueryParam("categoria") String categoria) {
        List<Producto> productos = (categoria == null || categoria.isBlank())
                ? Producto.disponibles()
                : Producto.disponiblesPorCategoria(categoria.trim());
        return productos.stream().map(ProductoDto::de).toList();
    }

    @GET
    @Path("/{id}")
    public ProductoDto obtener(@PathParam("id") Long id) {
        Producto p = Producto.buscarConCategoria(id);
        if (p == null || !p.disponible) {
            throw new NotFoundException("Producto no encontrado: " + id);
        }
        return ProductoDto.de(p);
    }
}
