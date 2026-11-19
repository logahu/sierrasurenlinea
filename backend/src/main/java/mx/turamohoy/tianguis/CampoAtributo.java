package mx.turamohoy.tianguis;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.ws.rs.core.Response.Status;
import mx.turamohoy.admin.Errores;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Un campo propio de una categoría (Marca, Año, Kilometraje…). Los atributos de un anuncio se
 * validan contra los campos de su categoría: requeridos, números, opciones y largo.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record CampoAtributo(String nombre, String etiqueta, String tipo, boolean requerido, List<String> opciones,
                            String unidad) {

    public static final Set<String> TIPOS = Set.of("TEXTO", "NUMERO", "OPCION", "SI_NO");
    static final int MAX_VALOR = 60;

    static final ObjectMapper JSON = new ObjectMapper()
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

    public static List<CampoAtributo> leer(String json) {
        try {
            return json == null || json.isBlank() ? List.of() : JSON.readValue(json, new TypeReference<>() { });
        } catch (Exception e) {
            return List.of();
        }
    }

    public static String escribir(List<CampoAtributo> campos) {
        try {
            return JSON.writeValueAsString(campos == null ? List.of() : campos);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    /** Revisa la definición que manda el panel. */
    public static List<CampoAtributo> validarDefinicion(List<CampoAtributo> campos) {
        if (campos == null) {
            return List.of();
        }
        java.util.Set<String> nombres = new java.util.HashSet<>();
        for (CampoAtributo c : campos) {
            if (c.nombre() == null || !c.nombre().matches("[a-zA-Z][a-zA-Z0-9]{0,29}")) {
                throw Errores.de(Status.BAD_REQUEST, "Nombre de campo no válido (solo letras y números, sin espacios).");
            }
            if (!nombres.add(c.nombre())) {
                throw Errores.de(Status.BAD_REQUEST, "El campo «" + c.nombre() + "» está repetido.");
            }
            if (c.etiqueta() == null || c.etiqueta().isBlank() || c.etiqueta().length() > 40) {
                throw Errores.de(Status.BAD_REQUEST, "Cada campo necesita una etiqueta (máximo 40 letras).");
            }
            if (!TIPOS.contains(c.tipo())) {
                throw Errores.de(Status.BAD_REQUEST, "Tipo de campo no válido: " + c.tipo());
            }
            if ("OPCION".equals(c.tipo()) && (c.opciones() == null || c.opciones().isEmpty())) {
                throw Errores.de(Status.BAD_REQUEST, "«" + c.etiqueta() + "» necesita sus opciones.");
            }
        }
        return campos;
    }

    /**
     * Deja solo los atributos de la categoría, con valores válidos; los vacíos se quitan.
     * Lanza 400 con un mensaje para el formulario si falta uno requerido o un valor no sirve.
     */
    public static Map<String, String> validar(List<CampoAtributo> campos, Map<String, String> valores) {
        Map<String, String> r = new LinkedHashMap<>();
        Map<String, String> v = valores == null ? Map.of() : valores;
        for (CampoAtributo c : campos) {
            String x = v.get(c.nombre()) == null ? null : v.get(c.nombre()).trim();
            if (x == null || x.isEmpty()) {
                if (c.requerido()) {
                    throw Errores.de(Status.BAD_REQUEST, "Falta «" + c.etiqueta() + "».");
                }
                continue;
            }
            if (x.length() > MAX_VALOR) {
                throw Errores.de(Status.BAD_REQUEST, "«" + c.etiqueta() + "» es muy largo (máximo " + MAX_VALOR + ").");
            }
            switch (c.tipo()) {
                case "NUMERO" -> {
                    String n = x.replace(",", "").replace(" ", "");
                    if (!n.matches("\\d{1,9}(\\.\\d{1,2})?")) {
                        throw Errores.de(Status.BAD_REQUEST, "«" + c.etiqueta() + "» debe ser un número.");
                    }
                    x = n;
                }
                case "OPCION" -> {
                    String elegido = x;
                    x = c.opciones().stream().filter(o -> o.equalsIgnoreCase(elegido)).findFirst()
                            .orElseThrow(() -> Errores.de(Status.BAD_REQUEST, "«" + c.etiqueta() + "»: elige una opción de la lista."));
                }
                case "SI_NO" -> {
                    String s = Tianguis.normalizar(x);
                    if (!s.equals("si") && !s.equals("no")) {
                        throw Errores.de(Status.BAD_REQUEST, "«" + c.etiqueta() + "»: sí o no.");
                    }
                    x = s.equals("si") ? "Sí" : "No";
                }
                default -> { }
            }
            r.put(c.nombre(), x);
        }
        return r;
    }

    public static Map<String, String> leerValores(String json) {
        try {
            return json == null || json.isBlank() ? Map.of() : JSON.readValue(json, new TypeReference<LinkedHashMap<String, String>>() { });
        } catch (Exception e) {
            return Map.of();
        }
    }

    public static String escribirValores(Map<String, String> valores) {
        try {
            return JSON.writeValueAsString(valores == null ? Map.of() : valores);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
