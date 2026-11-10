package mx.turamohoy.historial;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/**
 * Junta qué campos cambiaron en una edición, para el detalle del historial:
 * "Precio: $450 → $480; Disponible: sí → no".
 */
public final class Cambios {

    private final List<String> lista = new ArrayList<>();

    public Cambios campo(String nombre, Object antes, Object despues) {
        String a = texto(antes);
        String d = texto(despues);
        if (!Objects.equals(a, d)) {
            lista.add(nombre + ": " + a + " → " + d);
        }
        return this;
    }

    /** Para textos largos solo se dice que cambió. */
    public Cambios largo(String nombre, String antes, String despues) {
        if (!Objects.equals(vacio(antes), vacio(despues))) {
            lista.add(nombre + " cambió");
        }
        return this;
    }

    public boolean hay() {
        return !lista.isEmpty();
    }

    @Override
    public String toString() {
        return String.join("; ", lista);
    }

    static String texto(Object v) {
        if (v == null || (v instanceof String s && s.isBlank())) {
            return "(vacío)";
        }
        if (v instanceof Boolean b) {
            return b ? "sí" : "no";
        }
        if (v instanceof BigDecimal n) {
            return "$" + n.stripTrailingZeros().toPlainString();
        }
        String s = v.toString().trim();
        return s.length() > 60 ? s.substring(0, 59) + "…" : s;
    }

    private static String vacio(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
