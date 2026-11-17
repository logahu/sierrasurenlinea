package mx.turamohoy.agenda;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.time.DayOfWeek;
import java.time.LocalTime;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Horario de citas por día de la semana, guardado como JSON en {@code negocio.horario_citas}:
 * {"1":["10:00","19:00"], …, "7":null} (1 = lunes; null o ausente = cerrado).
 */
public final class HorarioCitas {

    private static final ObjectMapper JSON = new ObjectMapper();

    /** De qué hora a qué hora atiende un día. */
    public record Turno(LocalTime abre, LocalTime cierra) {
    }

    private final Map<DayOfWeek, Turno> dias;

    private HorarioCitas(Map<DayOfWeek, Turno> dias) {
        this.dias = dias;
    }

    public static HorarioCitas de(String json) {
        Map<DayOfWeek, Turno> dias = new EnumMap<>(DayOfWeek.class);
        if (json != null && !json.isBlank()) {
            try {
                Map<String, List<String>> m = JSON.readValue(json, new TypeReference<>() { });
                m.forEach((k, v) -> {
                    if (v != null && v.size() == 2) {
                        Turno t = new Turno(LocalTime.parse(v.get(0)), LocalTime.parse(v.get(1)));
                        if (t.abre().isBefore(t.cierra())) {
                            dias.put(DayOfWeek.of(Integer.parseInt(k)), t);
                        }
                    }
                });
            } catch (JsonProcessingException | RuntimeException e) {
                // un horario dañado equivale a cerrado
            }
        }
        return new HorarioCitas(dias);
    }

    /** El turno del día, o null si cierra. */
    public Turno turno(DayOfWeek dia) {
        return dias.get(dia);
    }

    public boolean vacio() {
        return dias.isEmpty();
    }

    /** Para guardar: {"1":["10:00","19:00"], ...}. */
    public static String json(Map<Integer, Turno> dias) {
        Map<String, List<String>> m = new LinkedHashMap<>();
        for (int d = 1; d <= 7; d++) {
            Turno t = dias.get(d);
            m.put(String.valueOf(d), t == null ? null : List.of(t.abre().toString(), t.cierra().toString()));
        }
        try {
            return JSON.writeValueAsString(m);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }

    /** Para mostrar: {1: ["10:00","19:00"], …} con null en los días cerrados. */
    public Map<Integer, List<String>> comoMapa() {
        Map<Integer, List<String>> m = new LinkedHashMap<>();
        for (DayOfWeek d : DayOfWeek.values()) {
            Turno t = dias.get(d);
            m.put(d.getValue(), t == null ? null : List.of(t.abre().toString(), t.cierra().toString()));
        }
        return m;
    }
}
