package mx.turamohoy.colonias;

import io.quarkus.panache.common.Sort;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;

import java.util.List;

/** Lista pública para el combo «Colonia» del pedido. */
@Path("/api/colonias")
@Produces(MediaType.APPLICATION_JSON)
public class ColoniaResource {

    public record ColoniaPublica(Long id, String nombre, String tipo, String codigoPostal, String zona) {
    }

    @GET
    public List<ColoniaPublica> activas() {
        return Colonia.<Colonia>list("estado", Sort.by("nombre"), Colonia.ACTIVA).stream()
                .map(c -> new ColoniaPublica(c.id, c.nombre, c.tipo, c.codigoPostal, c.zona)).toList();
    }
}
