package mx.turamohoy.agenda;

import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.ws.rs.Consumes;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.POST;
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
import mx.turamohoy.catalogo.model.Categoria;
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

    public record Profesional(Long id, String nombre, String especialidades, String rol, String avatar) {
    }

    public record CitaDto(Long pedidoId, String folio, String estado, LocalDateTime inicio, LocalDateTime fin,
                          Long empleadoId, String empleadoNombre, String clienteNombre, String clienteTelefono,
                          List<String> servicios, String notas, boolean prueba,
                          /** Categoría del primer servicio (para el color en la agenda); null si no se sabe. */
                          String categoria,
                          /** Cae en un horario sin servicio: hay que avisar al cliente y reprogramarla. */
                          boolean sinServicio) {
    }

    /** Rango sin servicio; {@code empleadoId} null = todo el negocio. */
    public record BloqueoDto(Long id, LocalDateTime inicio, LocalDateTime fin, Long empleadoId, String empleadoNombre,
                             String motivo, int citasAfectadas) {
    }

    public record NuevoBloqueo(
            /** Primer día (2026-12-24). */
            @NotBlank(message = "Elige el día.") String fecha,
            /** Último día, para bloquear días completos; null = solo {@code fecha}. */
            String fechaFin,
            /** De qué hora a qué hora (solo en {@code fecha}); null = todo el día. */
            String horaInicio, String horaFin,
            /** null = todo el negocio. */
            Long empleadoId,
            @Size(max = 80, message = "El motivo es de máximo 80 letras.") String motivo,
            /** Guardar aunque haya citas en ese horario (se avisa y se reprograman). */
            boolean confirmar) {
    }

    /** Si hay citas y no se confirmó, {@code bloqueo} viene vacío y {@code afectadas} dice cuáles. */
    public record ResultadoBloqueo(BloqueoDto bloqueo, List<CitaDto> afectadas) {
    }

    public record AgendaDto(String negocioSlug, String negocioNombre, boolean soloMias, List<Profesional> profesionales,
                            List<CitaDto> citas,
                            /** Categorías del negocio en su orden (fijan el color de cada una en la agenda). */
                            List<String> categorias,
                            /** Horario de citas: 1 = lunes … 7 = domingo; sin llave = cerrado. */
                            Map<Integer, List<String>> horario,
                            int minutosCita,
                            /** Horarios sin servicio en el rango (los del empleado: suyos y del negocio). */
                            List<BloqueoDto> bloqueos) {
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
        List<AgendaBloqueo> bloqueos = AgendaBloqueo.entre(n, de, a).stream()
                .filter(b -> !soloMias || b.deTodos() || b.empleado.id.equals(u.id)).toList();
        List<CitaDto> citas = citasDto(pedidos, bloqueos);
        List<Profesional> profesionales = soloMias
                ? List.of(new Profesional(u.id, u.nombre, u.especialidades, u.rol, u.avatar))
                : Usuario.profesionalesDe(n).stream()
                        .map(x -> new Profesional(x.id, x.nombre, x.especialidades, x.rol, x.avatar)).toList();
        List<String> categorias = Categoria.delNegocio(n).stream().map(c -> c.nombre).toList();
        return new AgendaDto(n.slug, n.nombre, soloMias, profesionales, citas, categorias,
                HorarioCitas.de(n.horarioCitas).comoMapa(), n.minutosCita,
                bloqueos.stream().map(b -> dto(b, 0)).toList());
    }

    private static List<CitaDto> citasDto(List<Pedido> pedidos, List<AgendaBloqueo> bloqueos) {
        Map<Long, List<PedidoLinea>> lineas = pedidos.isEmpty() ? Map.of()
                : PedidoLinea.<PedidoLinea>find("select l from PedidoLinea l left join fetch l.producto pr"
                                + " left join fetch pr.categoria where l.pedido in ?1 order by l.orden", pedidos).list().stream()
                        .collect(Collectors.groupingBy(l -> l.pedido.id));
        return pedidos.stream().map(p -> {
            List<PedidoLinea> ls = lineas.getOrDefault(p.id, List.of());
            String categoria = ls.stream().filter(l -> l.producto != null && l.producto.categoria != null)
                    .map(l -> l.producto.categoria.nombre).findFirst().orElse(null);
            return new CitaDto(p.id, p.folio, p.estado, p.citaInicio, p.citaFin,
                    p.empleado == null ? null : p.empleado.id, p.empleado == null ? null : p.empleado.nombre,
                    p.clienteNombre, p.clienteTelefono, ls.stream().map(l -> l.nombre).toList(), p.notas, p.prueba,
                    categoria, p.empleado != null && bloqueos.stream()
                            .anyMatch(b -> b.cubre(p.empleado.id, p.citaInicio, p.citaFin)));
        }).toList();
    }

    private static BloqueoDto dto(AgendaBloqueo b, int afectadas) {
        return new BloqueoDto(b.id, b.inicio, b.fin, b.empleado == null ? null : b.empleado.id,
                b.empleado == null ? null : b.empleado.nombre, b.motivo, afectadas);
    }

    /** Citas vigentes (no canceladas) que se cruzan con el rango y la persona (null = todas). */
    private static List<Pedido> citasEn(Negocio n, LocalDateTime inicio, LocalDateTime fin, Long empleadoId) {
        return Pedido.<Pedido>find("select p from Pedido p left join fetch p.empleado where p.negocio = ?1"
                        + " and p.citaInicio < ?3 and p.citaFin > ?2 and p.estado <> 'CANCELADO' order by p.citaInicio",
                n, inicio, fin).list().stream()
                .filter(p -> empleadoId == null || (p.empleado != null && p.empleado.id.equals(empleadoId))).toList();
    }

    /** Días y horas sin servicio de hoy en adelante, con cuántas citas caen en cada uno. */
    @GET
    @Path("/negocios/{slug}/bloqueos")
    @Transactional
    public List<BloqueoDto> bloqueos(@PathParam("slug") String slug) {
        Negocio n = sesion.negocioEditable(slug);
        LocalDateTime ahora = Agenda.ahora();
        return AgendaBloqueo.<AgendaBloqueo>find("select b from AgendaBloqueo b left join fetch b.empleado"
                        + " where b.negocio = ?1 and b.fin > ?2 order by b.inicio", n, ahora).list().stream()
                .map(b -> dto(b, citasEn(n, b.inicio, b.fin, b.empleado == null ? null : b.empleado.id).size()))
                .toList();
    }

    /**
     * Bloquea días completos (fecha a fechaFin) o unas horas de un día, para todo el negocio o
     * una persona. Si ya hay citas ahí y no viene {@code confirmar}, no guarda y dice cuáles.
     */
    @POST
    @Path("/negocios/{slug}/bloqueos")
    @Transactional
    public ResultadoBloqueo bloquear(@PathParam("slug") String slug, @Valid @NotNull NuevoBloqueo b) {
        Negocio n = sesion.negocioEditable(slug);
        LocalDate dia = fecha(b.fecha());
        LocalDateTime inicio;
        LocalDateTime fin;
        boolean conHoras = b.horaInicio() != null && !b.horaInicio().isBlank();
        try {
            if (conHoras) {
                inicio = dia.atTime(LocalTime.parse(b.horaInicio()));
                fin = dia.atTime(LocalTime.parse(b.horaFin() == null ? "" : b.horaFin()));
            } else {
                LocalDate ultimo = b.fechaFin() == null || b.fechaFin().isBlank() ? dia : LocalDate.parse(b.fechaFin());
                inicio = dia.atStartOfDay();
                fin = ultimo.plusDays(1).atStartOfDay();
            }
        } catch (DateTimeParseException e) {
            throw Errores.de(Status.BAD_REQUEST, "Revisa las fechas y horas (formato 10:00).");
        }
        if (!fin.isAfter(inicio)) {
            throw Errores.de(Status.BAD_REQUEST, conHoras ? "La hora final debe ser después de la inicial."
                    : "El último día no puede ser antes del primero.");
        }
        LocalDateTime ahora = Agenda.ahora();
        if (!fin.isAfter(ahora)) {
            throw Errores.de(Status.BAD_REQUEST, "Ese horario ya pasó.");
        }
        if (inicio.isBefore(ahora)) {
            inicio = ahora.withSecond(0).withNano(0);
        }
        if (fin.isAfter(ahora.plusDays(366))) {
            throw Errores.de(Status.BAD_REQUEST, "Solo se puede bloquear hasta un año adelante.");
        }
        Usuario empleado = null;
        if (b.empleadoId() != null) {
            empleado = Usuario.profesionalesDe(n).stream().filter(x -> x.id.equals(b.empleadoId())).findFirst()
                    .orElseThrow(() -> Errores.de(Status.BAD_REQUEST, "Esa persona no atiende citas en este negocio."));
        }
        List<Pedido> afectadas = citasEn(n, inicio, fin, b.empleadoId());
        if (!afectadas.isEmpty() && !b.confirmar()) {
            return new ResultadoBloqueo(null, citasDto(afectadas, List.of()));
        }
        AgendaBloqueo nuevo = new AgendaBloqueo();
        nuevo.negocio = n;
        nuevo.empleado = empleado;
        nuevo.inicio = inicio;
        nuevo.fin = fin;
        nuevo.motivo = b.motivo() == null || b.motivo().isBlank() ? null : b.motivo().trim();
        nuevo.creadoPor = sesion.usuario();
        nuevo.persist();
        String quien = empleado == null ? "todo el negocio" : empleado.nombre;
        Bitacora.anotar(sesion.usuario(), n, Bitacora.NEGOCIO, n.id, "Bloqueó la agenda de " + n.nombre,
                Agenda.textoRango(inicio, fin) + " · " + quien + (nuevo.motivo == null ? "" : " · " + nuevo.motivo)
                        + (afectadas.isEmpty() ? "" : " · " + afectadas.size() + " cita(s) por reprogramar"));
        List<AgendaBloqueo> este = List.of(nuevo);
        return new ResultadoBloqueo(dto(nuevo, afectadas.size()), citasDto(afectadas, este));
    }

    @DELETE
    @Path("/negocios/{slug}/bloqueos/{id}")
    @Transactional
    public void quitarBloqueo(@PathParam("slug") String slug, @PathParam("id") Long id) {
        Negocio n = sesion.negocioEditable(slug);
        AgendaBloqueo b = AgendaBloqueo.<AgendaBloqueo>findByIdOptional(id).filter(x -> x.negocio.id.equals(n.id))
                .orElseThrow(() -> Errores.de(Status.NOT_FOUND, "Ese bloqueo ya no existe."));
        Bitacora.anotar(sesion.usuario(), n, Bitacora.NEGOCIO, n.id, "Quitó un bloqueo de la agenda de " + n.nombre,
                Agenda.textoRango(b.inicio, b.fin) + " · " + (b.empleado == null ? "todo el negocio" : b.empleado.nombre));
        b.delete();
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
