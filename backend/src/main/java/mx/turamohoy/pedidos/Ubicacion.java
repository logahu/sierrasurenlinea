package mx.turamohoy.pedidos;

import mx.turamohoy.admin.Errores;

import java.math.BigDecimal;
import java.math.RoundingMode;

import jakarta.ws.rs.core.Response.Status;

/** Un punto en el mapa (latitud y longitud) validado y redondeado a 6 decimales (~10 cm). */
public record Ubicacion(BigDecimal lat, BigDecimal lng) {

    /**
     * Devuelve la ubicación o null si no se mandó. Solo se aceptan puntos dentro de
     * México, para descartar datos absurdos.
     */
    public static Ubicacion de(Double lat, Double lng) {
        if (lat == null && lng == null) {
            return null;
        }
        if (lat == null || lng == null || lat.isNaN() || lng.isNaN()
                || lat < 14 || lat > 33 || lng < -119 || lng > -86) {
            throw Errores.de(Status.BAD_REQUEST, "La ubicación del mapa no es válida. Vuelve a marcarla.");
        }
        return new Ubicacion(BigDecimal.valueOf(lat).setScale(6, RoundingMode.HALF_UP),
                BigDecimal.valueOf(lng).setScale(6, RoundingMode.HALF_UP));
    }

    /** Enlace para abrir el punto en Google Maps (no necesita clave). */
    public String enlace() {
        return "https://maps.google.com/?q=" + lat.toPlainString() + "," + lng.toPlainString();
    }
}
