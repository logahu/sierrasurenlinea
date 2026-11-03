package mx.turamohoy.catalogo.resource;

import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import mx.turamohoy.catalogo.dto.CategoriaDto;
import mx.turamohoy.catalogo.model.Categoria;
import io.quarkus.panache.common.Sort;

import java.util.List;

@Path("/api/categorias")
@Produces(MediaType.APPLICATION_JSON)
public class CategoriaResource {

    @GET
    public List<CategoriaDto> listar() {
        return Categoria.<Categoria>listAll(Sort.by("orden")).stream()
                .map(CategoriaDto::de)
                .toList();
    }
}
