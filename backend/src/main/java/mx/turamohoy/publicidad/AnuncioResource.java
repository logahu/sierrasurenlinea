package mx.turamohoy.publicidad;

import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import mx.turamohoy.clientes.SesionCliente;

import java.util.List;

/** Banners de la portada que se ven hoy. */
@Path("/api/anuncios")
@Produces(MediaType.APPLICATION_JSON)
public class AnuncioResource {

    @Inject
    SesionCliente sesionCliente;

    /** Lo que ve el visitante: sin fechas ni estado. */
    public record AnuncioDto(Long id, String titulo, String texto, String imagenUrl, String enlace,
                             String negocioSlug, String colorFondo, String posicion) {

        static AnuncioDto de(Anuncio a) {
            return new AnuncioDto(a.id, a.titulo, a.texto, a.imagenUrl, a.enlace,
                    a.negocio == null ? null : a.negocio.slug, a.colorFondo, a.posicion);
        }
    }

    /**
     * Activos y dentro de sus fechas, en orden. {@code ?posicion=PORTADA_ARRIBA} o
     * {@code DIRECTORIO}; sin posición, todos. Si el negocio anunciado no se puede ver,
     * su anuncio tampoco.
     */
    @GET
    public List<AnuncioDto> vigentes(@QueryParam("posicion") String posicion) {
        boolean probador = sesionCliente.esProbador();
        List<String> posiciones = posicion == null || posicion.isBlank()
                ? List.of(Anuncio.PORTADA_ARRIBA, Anuncio.DIRECTORIO)
                : List.of(posicion.trim().toUpperCase());
        return posiciones.stream()
                .filter(Anuncio.POSICIONES::contains)
                .flatMap(p -> Anuncio.vigentes(p, Anuncio.hoy()).stream())
                .filter(a -> a.negocio == null || a.negocio.visiblePara(probador))
                .map(AnuncioDto::de)
                .toList();
    }
}
