package mx.turamohoy.tianguis;

import io.vertx.core.http.HttpServerRequest;
import jakarta.ws.rs.core.Response.Status;
import mx.turamohoy.admin.Errores;
import mx.turamohoy.catalogo.model.Negocio;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.text.Normalizer;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Locale;

/** Reglas comunes del Tianguis Sierra Sur: fechas, texto para buscar, token de gestión, IP. */
public final class Tianguis {

    /** El negocio-sección del tianguis (giro en la portada y encargado en el panel). */
    public static final String SLUG = "tianguis";
    public static final ZoneId ZONA = ZoneId.of("America/Mexico_City");
    /** Días que dura publicado un anuncio (y cada renovación). */
    public static final int DIAS_PUBLICADO = 30;
    /** Días que un VENDIDO sigue en los listados públicos. */
    public static final int DIAS_VENDIDO_VISIBLE = 7;
    public static final int MAX_RENOVACIONES = 3;
    public static final int MAX_FOTOS = 8;

    /** Las pruebas lo reemplazan para simular fechas. */
    public static Clock reloj = Clock.system(ZONA);

    private static final SecureRandom AZAR = new SecureRandom();

    private Tianguis() {
    }

    public static LocalDateTime ahora() {
        return LocalDateTime.now(reloj).withNano(0);
    }

    public static Negocio negocio() {
        return Negocio.<Negocio>find("slug", SLUG).firstResultOptional()
                .orElseThrow(() -> Errores.de(Status.NOT_FOUND, "El tianguis no está disponible."));
    }

    /** Sin acentos, minúsculas y espacios sencillos: «Celular  Motorola» → «celular motorola». */
    public static String normalizar(String texto) {
        if (texto == null) {
            return "";
        }
        return Normalizer.normalize(texto, Normalizer.Form.NFD).replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT).replaceAll("\\s+", " ").trim();
    }

    /** «Sofá de 3 plazas, café» → «sofa-de-3-plazas-cafe» (para la URL de la ficha). */
    public static String slug(String texto) {
        String s = normalizar(texto).replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", "");
        return s.length() > 60 ? s.substring(0, 60).replaceAll("-$", "") : s;
    }

    /** Token aleatorio para el enlace privado de gestión (32 bytes, base64 para URL). */
    public static String nuevoToken() {
        byte[] b = new byte[32];
        AZAR.nextBytes(b);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(b);
    }

    /** Lo que se guarda: SHA-256 en hexadecimal (el token nunca se guarda). */
    public static String hash(String token) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    public static String ip(HttpServerRequest peticion) {
        if (peticion == null) {
            return null;
        }
        String reenviada = peticion.getHeader("X-Forwarded-For");
        if (reenviada != null && !reenviada.isBlank()) {
            return reenviada.split(",")[0].trim();
        }
        return peticion.remoteAddress() == null ? null : peticion.remoteAddress().host();
    }

    /** 10 dígitos (o 52 + 10) → 52XXXXXXXXXX; si no, 400. */
    public static String whatsapp(String texto) {
        String d = texto == null ? "" : texto.replaceAll("\\D", "");
        if (d.length() == 13 && d.startsWith("521")) {
            d = "52" + d.substring(3);
        }
        if (d.length() == 12 && d.startsWith("52")) {
            d = d.substring(2);
        }
        if (d.length() != 10) {
            throw Errores.de(Status.BAD_REQUEST, "El WhatsApp debe tener 10 dígitos.");
        }
        return "52" + d;
    }

    static String limpio(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
