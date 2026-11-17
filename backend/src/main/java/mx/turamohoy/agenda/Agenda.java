package mx.turamohoy.agenda;

import jakarta.ws.rs.core.Response.Status;
import mx.turamohoy.admin.Errores;
import mx.turamohoy.admin.Usuario;
import mx.turamohoy.catalogo.model.Negocio;
import mx.turamohoy.pedidos.Pedido;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.TextStyle;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Horarios libres y apartado de citas. Todo en hora de Miahuatlán. Una cita de N servicios
 * ocupa N bloques seguidos con la misma persona.
 */
public final class Agenda {

    public static final ZoneId ZONA = ZoneId.of("America/Mexico_City");
    /** Hasta cuántos días adelante se puede apartar. */
    public static final int DIAS_ADELANTE = 30;
    private static final Locale ES = Locale.forLanguageTag("es-MX");

    /** Para las pruebas: la hora «de ahora». */
    static Clock reloj = Clock.system(ZONA);

    private Agenda() {
    }

    public static LocalDateTime ahora() {
        return LocalDateTime.now(reloj.withZone(ZONA));
    }

    /** Un horario de inicio y quiénes pueden atender a esa hora (para toda la duración). */
    public record Horario(String hora, List<Long> libres) {
    }

    public record Dia(String fecha, String nombre, boolean abierto, List<Horario> horarios) {
    }

    /**
     * Horarios en los que cabe una cita de {@code bloques} servicios, día por día.
     *
     * @param soloEmpleado si no es null, solo cuenta a esa persona
     */
    public static List<Dia> disponibilidad(Negocio n, LocalDate desde, int dias, int bloques, Long soloEmpleado) {
        HorarioCitas horario = HorarioCitas.de(n.horarioCitas);
        List<Usuario> profesionales = Usuario.profesionalesDe(n).stream()
                .filter(u -> soloEmpleado == null || u.id.equals(soloEmpleado)).toList();
        LocalDate hoy = ahora().toLocalDate();
        LocalDate inicio = desde.isBefore(hoy) ? hoy : desde;
        LocalDate fin = inicio.plusDays(Math.max(1, Math.min(dias, 14)));
        LocalDate tope = hoy.plusDays(DIAS_ADELANTE);
        Set<String> ocupados = ocupados(n, inicio.atStartOfDay(), fin.atStartOfDay());

        List<Dia> r = new ArrayList<>();
        for (LocalDate f = inicio; f.isBefore(fin); f = f.plusDays(1)) {
            HorarioCitas.Turno t = horario.turno(f.getDayOfWeek());
            String nombre = nombreDia(f);
            if (t == null || f.isAfter(tope)) {
                r.add(new Dia(f.toString(), nombre, false, List.of()));
                continue;
            }
            List<Horario> horarios = new ArrayList<>();
            for (LocalDateTime s : inicios(n, f, t, bloques)) {
                List<Long> libres = profesionales.stream()
                        .filter(u -> libre(ocupados, u.id, s, bloques, n.minutosCita)).map(u -> u.id).toList();
                if (!libres.isEmpty()) {
                    horarios.add(new Horario(s.toLocalTime().toString(), libres));
                }
            }
            r.add(new Dia(f.toString(), nombre, true, horarios));
        }
        return r;
    }

    /** Inicios posibles del día: alineados al tamaño del servicio, que quepan antes del cierre y aún no pasen. */
    static List<LocalDateTime> inicios(Negocio n, LocalDate f, HorarioCitas.Turno t, int bloques) {
        List<LocalDateTime> r = new ArrayList<>();
        LocalDateTime ahora = ahora();
        for (LocalTime h = t.abre(); !h.plusMinutes((long) n.minutosCita * bloques).isAfter(t.cierra())
                && h.isAfter(t.abre().minusMinutes(1)); h = h.plusMinutes(n.minutosCita)) {
            LocalDateTime s = f.atTime(h);
            if (s.isAfter(ahora)) {
                r.add(s);
            }
            if (h.plusMinutes(n.minutosCita).isBefore(h)) {
                break; // pasó de medianoche
            }
        }
        return r;
    }

    private static boolean libre(Set<String> ocupados, Long empleado, LocalDateTime s, int bloques, int minutos) {
        for (int i = 0; i < bloques; i++) {
            if (ocupados.contains(empleado + "@" + s.plusMinutes((long) minutos * i))) {
                return false;
            }
        }
        return true;
    }

    private static Set<String> ocupados(Negocio n, LocalDateTime desde, LocalDateTime hasta) {
        Set<String> r = new HashSet<>();
        for (CitaBloque b : CitaBloque.<CitaBloque>list(
                "pedido.negocio = ?1 and inicio >= ?2 and inicio < ?3", n, desde, hasta)) {
            r.add(b.empleado.id + "@" + b.inicio);
        }
        return r;
    }

    /**
     * Aparta la cita del pedido (ya guardado): elige a la persona si no se dijo, revisa que la
     * hora siga libre y guarda un bloque por servicio. Si otro cliente la ganó al mismo tiempo,
     * la llave única lo detiene al guardar.
     */
    public static void apartar(Pedido p, LocalDate fecha, LocalTime hora, Long empleadoId, int bloques) {
        Negocio n = p.negocio;
        HorarioCitas.Turno t = HorarioCitas.de(n.horarioCitas).turno(fecha.getDayOfWeek());
        LocalDateTime s = fecha.atTime(hora);
        if (t == null || !inicios(n, fecha, t, bloques).contains(s)
                || fecha.isAfter(ahora().toLocalDate().plusDays(DIAS_ADELANTE))) {
            throw Errores.de(Status.CONFLICT, "Ese horario ya no está disponible. Elige otro.");
        }
        Set<String> ocupados = ocupados(n, s, s.plusMinutes((long) n.minutosCita * bloques));
        List<Usuario> candidatos = Usuario.profesionalesDe(n).stream()
                .filter(u -> empleadoId == null || u.id.equals(empleadoId))
                .filter(u -> libre(ocupados, u.id, s, bloques, n.minutosCita)).toList();
        if (candidatos.isEmpty()) {
            throw Errores.de(Status.CONFLICT, "Ese horario se acaba de ocupar. Elige otro.");
        }
        Usuario quien = candidatos.size() == 1 ? candidatos.get(0) : menosOcupado(n, candidatos, fecha);
        for (int i = 0; i < bloques; i++) {
            CitaBloque b = new CitaBloque();
            b.pedido = p;
            b.empleado = quien;
            b.inicio = s.plusMinutes((long) n.minutosCita * i);
            b.persist();
        }
        p.empleado = quien;
        p.citaInicio = s;
        p.citaFin = s.plusMinutes((long) n.minutosCita * bloques);
        p.cuando = texto(p.citaInicio, p.citaFin) + " con " + quien.nombre;
    }

    /** Si cualquiera puede, a quien tiene menos citas ese día. */
    private static Usuario menosOcupado(Negocio n, List<Usuario> candidatos, LocalDate fecha) {
        Map<Long, Long> carga = new HashMap<>();
        for (CitaBloque b : CitaBloque.<CitaBloque>list("pedido.negocio = ?1 and inicio >= ?2 and inicio < ?3",
                n, fecha.atStartOfDay(), fecha.plusDays(1).atStartOfDay())) {
            carga.merge(b.empleado.id, 1L, Long::sum);
        }
        return candidatos.stream().min(Comparator.comparing((Usuario u) -> carga.getOrDefault(u.id, 0L))
                .thenComparing(u -> u.id)).orElseThrow();
    }

    /** Libera las horas (al cancelar). */
    public static void liberar(Pedido p) {
        CitaBloque.delete("pedido", p);
    }

    /** «Lunes 18 de noviembre, 11:00 a 13:00». */
    public static String texto(LocalDateTime inicio, LocalDateTime fin) {
        String dia = inicio.getDayOfWeek().getDisplayName(TextStyle.FULL, ES);
        return Character.toUpperCase(dia.charAt(0)) + dia.substring(1) + " "
                + inicio.format(DateTimeFormatter.ofPattern("d 'de' MMMM, HH:mm", ES)) + " a "
                + fin.format(DateTimeFormatter.ofPattern("HH:mm", ES));
    }

    static String nombreDia(LocalDate f) {
        LocalDate hoy = ahora().toLocalDate();
        if (f.equals(hoy)) {
            return "Hoy";
        }
        if (f.equals(hoy.plusDays(1))) {
            return "Mañana";
        }
        String dia = f.getDayOfWeek().getDisplayName(TextStyle.SHORT, ES).replace(".", "");
        return Character.toUpperCase(dia.charAt(0)) + dia.substring(1) + " " + f.getDayOfMonth();
    }
}
