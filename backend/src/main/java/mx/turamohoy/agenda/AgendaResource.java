package mx.turamohoy.agenda;

import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response.Status;
import mx.turamohoy.admin.Errores;
import mx.turamohoy.admin.Usuario;
import mx.turamohoy.catalogo.model.Negocio;
import mx.turamohoy.clientes.SesionCliente;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Map;

/** Horarios libres de un negocio con agenda, para que el cliente aparte su cita. */
@Path("/api/negocios/{slug}/agenda")
@Produces(MediaType.APPLICATION_JSON)
public class AgendaResource {

    @Inject
    SesionCliente sesionCliente;

    /** Quien atiende, sin datos privados (ni teléfono ni correo). */
    public record Profesional(Long id, String nombre, String especialidades) {
    }

    public record Disponibilidad(int minutosCita, int duracionMinutos, List<Profesional> profesionales,
                                 Map<Integer, List<String>> horario, List<Agenda.Dia> dias) {
    }

    /**
     * @param servicios cuántos servicios lleva la cita (cada uno ocupa un bloque)
     * @param empleado  solo esa persona; vacío = cualquiera
     */
    @GET
    @Transactional
    public Disponibilidad disponibilidad(@PathParam("slug") String slug,
                                         @QueryParam("desde") String desde,
                                         @QueryParam("dias") @DefaultValue("7") int dias,
                                         @QueryParam("servicios") @DefaultValue("1") int servicios,
                                         @QueryParam("empleado") Long empleado) {
        Negocio n = Negocio.visiblePorSlug(slug, sesionCliente.esProbador())
                .filter(x -> x.agendaActiva)
                .orElseThrow(() -> Errores.de(Status.NOT_FOUND, "Este negocio no tiene agenda en línea."));
        LocalDate inicio;
        try {
            inicio = desde == null || desde.isBlank() ? Agenda.ahora().toLocalDate() : LocalDate.parse(desde);
        } catch (DateTimeParseException e) {
            throw Errores.de(Status.BAD_REQUEST, "Fecha no válida.");
        }
        int bloques = Math.max(1, Math.min(servicios, 8));
        List<Profesional> profesionales = Usuario.profesionalesDe(n).stream()
                .map(u -> new Profesional(u.id, u.nombre, u.especialidades)).toList();
        return new Disponibilidad(n.minutosCita, n.minutosCita * bloques, profesionales,
                HorarioCitas.de(n.horarioCitas).comoMapa(), Agenda.disponibilidad(n, inicio, dias, bloques, empleado));
    }
}
