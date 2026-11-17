package mx.turamohoy.catalogo.resource;

import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import mx.turamohoy.catalogo.dto.GiroDto;
import mx.turamohoy.catalogo.model.Giro;
import mx.turamohoy.catalogo.model.Negocio;
import mx.turamohoy.clientes.SesionCliente;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/** Giros de la portada en orden, con cuántos negocios visibles tiene cada uno. */
@Path("/api/giros")
@Produces(MediaType.APPLICATION_JSON)
public class GiroResource {

    @Inject
    SesionCliente sesionCliente;

    @GET
    public List<GiroDto> listar() {
        List<String> estados = Negocio.estadosVisibles(sesionCliente.esProbador());
        Map<Long, Long> conteo = Negocio.<Negocio>find("select n from Negocio n join fetch n.giro where n.estado in ?1", estados)
                .list().stream()
                .collect(Collectors.groupingBy(n -> n.giro.id, Collectors.counting()));
        return Giro.enOrden().stream().map(g -> GiroDto.de(g, conteo.getOrDefault(g.id, 0L))).toList();
    }
}
