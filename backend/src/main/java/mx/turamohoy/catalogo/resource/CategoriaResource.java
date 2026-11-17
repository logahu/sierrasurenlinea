package mx.turamohoy.catalogo.resource;

import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import mx.turamohoy.catalogo.dto.CategoriaDto;
import mx.turamohoy.catalogo.model.Categoria;

import java.util.List;

/** Todas las categorías de todos los negocios (las del sitio usan /api/negocios/{slug}). */
@Path("/api/categorias")
@Produces(MediaType.APPLICATION_JSON)
public class CategoriaResource {

    @GET
    public List<CategoriaDto> listar() {
        // Solo de negocios públicos: los que están en pruebas u ocultos no se anuncian.
        return Categoria.todas().stream().filter(c -> c.negocio.publico()).map(CategoriaDto::de).toList();
    }
}
