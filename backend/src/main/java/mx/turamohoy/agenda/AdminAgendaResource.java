package mx.turamohoy.agenda;

import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response.Status;
import mx.turamohoy.admin.Errores;
import mx.turamohoy.admin.Rol;
import mx.turamohoy.admin.SesionActual;
import mx.turamohoy.admin.Usuario;
import mx.turamohoy.catalogo.model.Negocio;
import mx.turamohoy.historial.Bitacora;
import mx.turamohoy.pedidos.Pedido;
import mx.turamohoy.pedidos.PedidoLinea;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeParseException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Agenda en el panel. El encargado (y el administrador) ve todas las citas del negocio; el
 * empleado, solo las suyas. También aquí se configura el horario de citas.
 */
@Path("/api/admin/agenda")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@RolesAllowed({Rol.DUENO, Rol.ENCARGADO, Rol.EMPLEADO})
public class AdminAgendaResource {

    @Inject
    SesionActual sesion;

    public record Profesional(Long id, String nombre, String especialidades, String rol) {
    }

    public record CitaDto(Long pedidoId, String folio, String estado, LocalDateTime inicio, LocalDateTime fin,
                          Long empleadoId, String empleadoNombre, String clienteNombre, String clienteTelefono,
                          List<String> servicios, String notas, boolean prueba) {
    }

    public record AgendaDto(String negocioSlug, String negocioNombre, boolean soloMias, List<Profesional> profesionales,
                            List<CitaDto> citas) {
    }

    public record Configuracion(boolean activa, int minutosCita, Map<Integer, List<String>> horario) {
    }

    public record EdicionConfiguracion(
            boolean activa,
            @Min(value = 15, message = "Cada cita dura al menos 15 minutos.") @Max(240) int minutosCita,
            /** 1 = lunes … 7 = domingo; null o vacío = cerrado. */
            @NotNull Map<Integer, List<String>> horario) {
    }

    /**
     * Citas desde {@code desde} durante {@code dias} días (sin las canceladas).
     *
     * @param negocio solo para el administrador; el encargado y el empleado ven el suyo
     */
    @GET
    @Transactional
    public AgendaDto citas(@QueryParam("negocio") String negocio, @QueryParam("desde") String desde,
                           @QueryParam("dias") @DefaultValue("1") int dias) {
        Usuario u = sesion.usuario();
        Negocio n = negocioDe(u, negocio);
        LocalDate inicio = fecha(desde);
        LocalDateTime de = inicio.atStartOfDay();
        LocalDateTime a = inicio.plusDays(Math.max(1, Math.min(dias, 31))).atStartOfDay();
        boolean soloMias = Rol.EMPLEADO.equals(u.rol);
        String q = "select p from Pedido p left join fetch p.empleado where p.negocio = ?1 and p.citaInicio >= ?2"
                + " and p.citaInicio < ?3 and p.estado <> 'CANCELADO'" + (soloMias ? " and p.empleado = ?4" : "")
                + " order by p.citaInicio";
        List<Pedido> pedidos = soloMias ? Pedido.<Pedido>find(q, n, de, a, u).list() : Pedido.<Pedido>find(q, n, de, a).list();
        Map<Long, List<String>> servicios = pedidos.isEmpty() ? Map.of()
                : PedidoLinea.<PedidoLinea>list("pedido in ?1 order by orden", pedidos).stream()
                        .collect(Collectors.groupingBy(l -> l.pedido.id, Collectors.mapping(l -> l.nombre, Collectors.toList())));
        List<CitaDto> citas = pedidos.stream().map(p -> new CitaDto(p.id, p.folio, p.estado, p.citaInicio, p.citaFin,
                p.empleado == null ? null : p.empleado.id, p.empleado == null ? null : p.empleado.nombre,
                p.clienteNombre, p.clienteTelefono, servicios.getOrDefault(p.id, List.of()), p.notas, p.prueba)).toList();
        List<Profesional> profesionales = soloMias
                ? List.of(new Profesional(u.id, u.nombre, u.especialidades, u.rol))
                : Usuario.profesionalesDe(n).stream().map(x -> new Profesional(x.id, x.nombre, x.especialidades, x.rol)).toList();
        return new AgendaDto(n.slug, n.nombre, soloMias, profesionales, citas);
    }

    @GET
    @Path("/negocios/{slug}/configuracion")
    public Configuracion configuracion(@PathParam("slug") String slug) {
        Negocio n = sesion.negocioEditable(slug);
        return new Configuracion(n.agendaActiva, n.minutosCita, HorarioCitas.de(n.horarioCitas).comoMapa());
    }

    @PUT
    @Path("/negocios/{slug}/configuracion")
    @Transactional
    public Configuracion guardar(@PathParam("slug") String slug, @Valid @NotNull EdicionConfiguracion c) {
        Negocio n = sesion.negocioEditable(slug);
        Map<Integer, HorarioCitas.Turno> dias = new HashMap<>();
        for (Map.Entry<Integer, List<String>> e : c.horario().entrySet()) {
            if (e.getKey() == null || e.getKey() < 1 || e.getKey() > 7) {
                throw Errores.de(Status.BAD_REQUEST, "Día no válido.");
            }
            List<String> v = e.getValue();
            if (v == null || v.isEmpty()) {
                continue;
            }
            try {
                HorarioCitas.Turno t = new HorarioCitas.Turno(LocalTime.parse(v.get(0)), LocalTime.parse(v.get(1)));
                if (!t.abre().isBefore(t.cierra())) {
                    throw Errores.de(Status.BAD_REQUEST, "La hora de cierre debe ser después de la de apertura.");
                }
                dias.put(e.getKey(), t);
            } catch (DateTimeParseException | IndexOutOfBoundsException ex) {
                throw Errores.de(Status.BAD_REQUEST, "Revisa las horas del horario (formato 10:00).");
            }
        }
        if (c.activa() && dias.isEmpty()) {
            throw Errores.de(Status.BAD_REQUEST, "Para activar la agenda abre al menos un día.");
        }
        String antes = n.agendaActiva + " · " + n.minutosCita + " min · " + n.horarioCitas;
        n.agendaActiva = c.activa();
        n.minutosCita = c.minutosCita();
        n.horarioCitas = HorarioCitas.json(dias);
        Bitacora.anotar(sesion.usuario(), n, Bitacora.NEGOCIO, n.id, "Cambió la agenda de citas de " + n.nombre,
                antes + " → " + n.agendaActiva + " · " + n.minutosCita + " min · " + n.horarioCitas);
        return new Configuracion(n.agendaActiva, n.minutosCita, HorarioCitas.de(n.horarioCitas).comoMapa());
    }

    private Negocio negocioDe(Usuario u, String slug) {
        if (u.esDueno()) {
            if (slug == null || slug.isBlank()) {
                throw Errores.de(Status.BAD_REQUEST, "Elige el negocio.");
            }
            return Negocio.porSlug(slug).orElseThrow(() -> Errores.de(Status.NOT_FOUND, "No existe ese negocio."));
        }
        if (u.negocio == null) {
            throw Errores.de(Status.FORBIDDEN, "No tienes un negocio asignado.");
        }
        return u.negocio;
    }

    private static LocalDate fecha(String desde) {
        try {
            return desde == null || desde.isBlank() ? Agenda.ahora().toLocalDate() : LocalDate.parse(desde);
        } catch (DateTimeParseException e) {
            throw Errores.de(Status.BAD_REQUEST, "Fecha no válida.");
        }
    }
}
