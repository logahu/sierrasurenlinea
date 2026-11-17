package mx.turamohoy.catalogo.resource;

import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.panache.common.Sort;
import jakarta.annotation.security.RolesAllowed;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import mx.turamohoy.admin.Rol;
import mx.turamohoy.catalogo.model.Visita;
import mx.turamohoy.catalogo.model.VisitaDia;

import java.util.List;
import java.util.regex.Pattern;

/**
 * Contador de visitas por página. El sitio llama POST /api/visitas en cada
 * navegación y muestra el total, camuflado como folio, en el pie de página.
 */
@Path("/api/visitas")
@Produces(MediaType.APPLICATION_JSON)
public class VisitaResource {

    /**
     * Solo se aceptan las formas de ruta que existen en el sitio:
     * "/", "/{negocio}", "/{negocio}/producto/{id}", "/giro/{giro}" y, para los clics en la
     * publicidad, "/anuncio/{id}". Así nadie puede llenar la tabla con rutas inventadas.
     */
    static final Pattern RUTA_VALIDA = Pattern.compile(
            "^/(anuncio/\\d{1,9}|giro/[a-z0-9-]{1,40}|[a-z0-9-]{1,60}(/producto/\\d{1,9})?)?$");

    /** {@code contar = false}: solo consulta el total (el visitante ya fue contado en esta sesión). */
    public record VisitaRequest(String ruta, Boolean contar) {}

    public record VisitaDto(String ruta, long total) {}

    @POST
    @Consumes(MediaType.APPLICATION_JSON)
    public VisitaDto registrar(VisitaRequest req) {
        String ruta = req == null ? null : req.ruta();
        if (ruta == null || !RUTA_VALIDA.matcher(ruta).matches()) {
            throw new BadRequestException("Ruta no válida");
        }
        if (req.contar() == null || req.contar()) {
            sumar(ruta);
        }
        Visita v = QuarkusTransaction.requiringNew().call(() -> Visita.<Visita>findById(ruta));
        return new VisitaDto(ruta, v == null ? 0 : v.total);
    }

    /** Totales de todas las páginas, de la más visitada a la menos. Solo el dueño, desde el panel. */
    @GET
    @RolesAllowed(Rol.DUENO)
    public List<VisitaDto> listar() {
        return Visita.<Visita>listAll(Sort.descending("total")).stream()
                .map(v -> new VisitaDto(v.ruta, v.total))
                .toList();
    }

    /** Igual, pero en el renglón del día (para el tablero). */
    private static void sumarDia(String ruta) {
        java.time.LocalDate hoy = VisitaDia.hoy();
        if (QuarkusTransaction.requiringNew().call(() -> VisitaDia.sumar(ruta, hoy)) > 0) {
            return;
        }
        try {
            QuarkusTransaction.requiringNew().run(() -> VisitaDia.nueva(ruta, hoy).persist());
        } catch (RuntimeException e) {
            QuarkusTransaction.requiringNew().run(() -> VisitaDia.sumar(ruta, hoy));
        }
    }

    /**
     * Suma 1 de forma atómica. La primera visita de una página crea su fila; si dos
     * visitas llegan a la vez y ambas intentan crearla, la que pierde suma sobre la fila
     * que ya existe.
     */
    private static void sumar(String ruta) {
        sumarDia(ruta);
        if (QuarkusTransaction.requiringNew().call(() -> Visita.sumar(ruta)) > 0) {
            return;
        }
        try {
            QuarkusTransaction.requiringNew().run(() -> Visita.nueva(ruta).persist());
        } catch (RuntimeException e) {
            // Llave duplicada: otra visita simultánea ya creó la fila (llega como
            // PersistenceException o QuarkusTransactionException según el momento).
            QuarkusTransaction.requiringNew().run(() -> Visita.sumar(ruta));
        }
    }
}
