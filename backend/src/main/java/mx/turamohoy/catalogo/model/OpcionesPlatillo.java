package mx.turamohoy.catalogo.model;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Opciones de un platillo («Carne: elige 1», «Extras: varias») y la cuenta de lo que eligió
 * el cliente. Se guardan como JSON en {@code platillo.opciones}.
 */
public final class OpcionesPlatillo {

    private static final ObjectMapper JSON = new ObjectMapper()
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

    private OpcionesPlatillo() {
    }

    public record Opcion(
            @NotBlank(message = "Cada opción necesita nombre.") @Size(max = 40) String nombre,
            @NotNull @DecimalMin(value = "0", message = "El precio extra no puede ser negativo.")
            @DecimalMax(value = "9999.99") BigDecimal precio,
            boolean disponible) {
    }

    /**
     * @param multiple    false = elige una; true = puede elegir varias (hasta {@code maximo}, si hay)
     * @param obligatorio debe elegir al menos una
     */
    public record Grupo(
            @NotBlank(message = "Cada grupo de opciones necesita nombre.") @Size(max = 40) String nombre,
            boolean multiple,
            boolean obligatorio,
            @Min(1) @Max(20) Integer maximo,
            @NotEmpty(message = "Cada grupo necesita al menos una opción.") @Size(max = 20)
            List<@Valid @NotNull Opcion> opciones) {
    }

    /** Lo que eligió el cliente: el nombre del grupo y el de la opción. */
    public record Elegida(String grupo, String opcion) {
    }

    /** Precio unitario (base + extras) y el texto de lo elegido, p. ej. «Pastor · Maíz · Queso (+$15)». */
    public record Cuenta(BigDecimal precioUnitario, String detalle) {
    }

    public static List<Grupo> leer(String json) {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        try {
            return JSON.readValue(json, new TypeReference<List<Grupo>>() { });
        } catch (JsonProcessingException e) {
            return List.of();
        }
    }

    public static String escribir(List<Grupo> grupos) {
        if (grupos == null || grupos.isEmpty()) {
            return null;
        }
        try {
            return JSON.writeValueAsString(grupos);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }

    /** Reglas que la anotación no cubre. Devuelve el problema o null si todo está bien. */
    public static String problema(List<Grupo> grupos) {
        if (grupos == null) {
            return null;
        }
        if (grupos.size() > 10) {
            return "Máximo 10 grupos de opciones por platillo.";
        }
        Set<String> nombres = new HashSet<>();
        for (Grupo g : grupos) {
            if (!nombres.add(clave(g.nombre()))) {
                return "Hay dos grupos llamados «" + g.nombre().trim() + "».";
            }
            Set<String> ops = new HashSet<>();
            for (Opcion o : g.opciones()) {
                if (!ops.add(clave(o.nombre()))) {
                    return "En «" + g.nombre().trim() + "» hay dos opciones llamadas «" + o.nombre().trim() + "».";
                }
            }
            if (!g.multiple() && g.maximo() != null && g.maximo() != 1) {
                return "«" + g.nombre().trim() + "» es de elegir una: no lleva máximo.";
            }
        }
        return null;
    }

    /** Limpia espacios y deja el máximo solo donde aplica. */
    public static List<Grupo> normalizar(List<Grupo> grupos) {
        List<Grupo> r = new ArrayList<>();
        for (Grupo g : grupos) {
            List<Opcion> ops = g.opciones().stream()
                    .map(o -> new Opcion(o.nombre().trim(), o.precio(), o.disponible())).toList();
            r.add(new Grupo(g.nombre().trim(), g.multiple(), g.obligatorio(), g.multiple() ? g.maximo() : null, ops));
        }
        return r;
    }

    /**
     * Revisa lo elegido contra las opciones del platillo y calcula el precio.
     *
     * @throws IllegalArgumentException con un mensaje para el cliente si algo no cuadra
     */
    public static Cuenta cuenta(Platillo p, List<Elegida> elegidas) {
        List<Grupo> grupos = leer(p.opciones);
        List<Elegida> lista = elegidas == null ? List.of() : elegidas;
        BigDecimal precio = p.precio;
        List<String> partes = new ArrayList<>();
        Set<String> vistas = new HashSet<>();
        for (Elegida e : lista) {
            if (e == null || grupos.stream().noneMatch(g -> clave(g.nombre()).equals(clave(e.grupo())))) {
                throw new IllegalArgumentException("Las opciones de " + p.nombre + " cambiaron. Vuelve a elegirlas.");
            }
            if (!vistas.add(clave(e.grupo()) + "|" + clave(e.opcion()))) {
                throw new IllegalArgumentException("Elegiste dos veces la misma opción en " + p.nombre + ".");
            }
        }
        for (Grupo g : grupos) {
            List<Elegida> deEste = lista.stream().filter(e -> clave(e.grupo()).equals(clave(g.nombre()))).toList();
            int maximo = g.multiple() ? (g.maximo() == null ? g.opciones().size() : g.maximo()) : 1;
            if (deEste.size() > maximo) {
                throw new IllegalArgumentException("En " + p.nombre + " solo puedes elegir "
                        + (maximo == 1 ? "una opción" : maximo + " opciones") + " de «" + g.nombre() + "».");
            }
            if (g.obligatorio() && deEste.isEmpty()) {
                throw new IllegalArgumentException("Elige «" + g.nombre() + "» para " + p.nombre + ".");
            }
            for (Elegida e : deEste) {
                Opcion o = g.opciones().stream().filter(x -> clave(x.nombre()).equals(clave(e.opcion())))
                        .findFirst().orElseThrow(() -> new IllegalArgumentException(
                                "Las opciones de " + p.nombre + " cambiaron. Vuelve a elegirlas."));
                if (!o.disponible()) {
                    throw new IllegalArgumentException("«" + o.nombre() + "» ya no está disponible para " + p.nombre + ".");
                }
                precio = precio.add(o.precio());
                partes.add(o.precio().signum() > 0
                        ? o.nombre() + " (+$" + o.precio().stripTrailingZeros().toPlainString() + ")"
                        : o.nombre());
            }
        }
        String detalle = String.join(" · ", partes);
        return new Cuenta(precio, detalle.isEmpty() ? null : (detalle.length() > 400 ? detalle.substring(0, 400) : detalle));
    }

    private static String clave(String s) {
        return s == null ? "" : s.trim().toLowerCase(Locale.ROOT);
    }
}
