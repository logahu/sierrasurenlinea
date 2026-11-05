package mx.turamohoy.catalogo.resource;

import jakarta.ws.rs.GET;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import mx.turamohoy.catalogo.dto.ProductoDto;
import mx.turamohoy.catalogo.model.Producto;

import java.util.List;

@Path("/api/productos")
@Produces(MediaType.APPLICATION_JSON)
public class ProductoResource {

    /** Todos los productos disponibles de todos los negocios. */
    @GET
    public List<ProductoDto> listar() {
        return Producto.disponibles().stream().map(ProductoDto::de).toList();
    }

    @GET
    @Path("/{id}")
    public ProductoDto obtener(@PathParam("id") Long id) {
        Producto p = Producto.buscarCompleto(id);
        if (p == null || !p.disponible || !p.categoria.negocio.visible) {
            throw new NotFoundException("Producto no encontrado: " + id);
        }
        return ProductoDto.de(p);
    }
}
