package mx.turamohoy.fotos;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.HexFormat;
import java.util.Map;
import java.util.TreeMap;
import java.util.stream.Collectors;

/**
 * URLs prefirmadas de S3 (AWS Signature Version 4, firma en la query), que es lo que
 * acepta Cloudflare R2. Sin dependencias: el navegador sube la foto directo a R2 con
 * la URL y el backend nunca recibe el archivo.
 *
 * @see <a href="https://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-query-string-auth.html">SigV4 en query string</a>
 */
public final class FirmaS3 {

    private static final DateTimeFormatter FECHA_HORA =
            DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss'Z'").withZone(ZoneOffset.UTC);
    private static final String ALGORITMO = "AWS4-HMAC-SHA256";

    private FirmaS3() {
    }

    /**
     * @param metodo         GET o PUT
     * @param host           p. ej. {@code <cuenta>.r2.cloudflarestorage.com}
     * @param ruta           ruta ya con el bucket: {@code /bucket/carpeta/foto.webp} (sin codificar)
     * @param region         {@code auto} en R2
     * @param encabezados    encabezados que el cliente debe mandar tal cual, además de host
     *                       (p. ej. content-type y content-length); nombres en minúsculas
     * @param segundosValida cuánto dura la URL
     */
    public static String prefirmar(String metodo, String host, String ruta, String region,
                                   Map<String, String> encabezados, long segundosValida,
                                   String llaveAcceso, String llaveSecreta, Instant ahora) {
        String fechaHora = FECHA_HORA.format(ahora);
        String fecha = fechaHora.substring(0, 8);
        String alcance = fecha + "/" + region + "/s3/aws4_request";

        TreeMap<String, String> firmados = new TreeMap<>();
        encabezados.forEach((k, v) -> firmados.put(k.toLowerCase(), v.trim()));
        firmados.put("host", host);
        String nombresFirmados = String.join(";", firmados.keySet());

        TreeMap<String, String> query = new TreeMap<>();
        query.put("X-Amz-Algorithm", ALGORITMO);
        query.put("X-Amz-Credential", llaveAcceso + "/" + alcance);
        query.put("X-Amz-Date", fechaHora);
        query.put("X-Amz-Expires", String.valueOf(segundosValida));
        query.put("X-Amz-SignedHeaders", nombresFirmados);
        String queryCanonica = query.entrySet().stream()
                .map(e -> codificar(e.getKey(), true) + "=" + codificar(e.getValue(), true))
                .collect(Collectors.joining("&"));

        String rutaCanonica = codificar(ruta, false);
        String encabezadosCanonicos = firmados.entrySet().stream()
                .map(e -> e.getKey() + ":" + e.getValue() + "\n")
                .collect(Collectors.joining());

        String peticionCanonica = metodo + "\n" + rutaCanonica + "\n" + queryCanonica + "\n"
                + encabezadosCanonicos + "\n" + nombresFirmados + "\nUNSIGNED-PAYLOAD";
        String aFirmar = ALGORITMO + "\n" + fechaHora + "\n" + alcance + "\n" + sha256Hex(peticionCanonica);

        byte[] llave = hmac(("AWS4" + llaveSecreta).getBytes(StandardCharsets.UTF_8), fecha);
        llave = hmac(llave, region);
        llave = hmac(llave, "s3");
        llave = hmac(llave, "aws4_request");
        String firma = HexFormat.of().formatHex(hmac(llave, aFirmar));

        return "https://" + host + rutaCanonica + "?" + queryCanonica + "&X-Amz-Signature=" + firma;
    }

    /** Codificación URI de AWS: todo menos A-Z a-z 0-9 - _ . ~ (y "/" en rutas). */
    static String codificar(String texto, boolean codificarDiagonal) {
        StringBuilder sb = new StringBuilder();
        for (byte b : texto.getBytes(StandardCharsets.UTF_8)) {
            char c = (char) (b & 0xff);
            if ((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9')
                    || c == '-' || c == '_' || c == '.' || c == '~' || (c == '/' && !codificarDiagonal)) {
                sb.append(c);
            } else {
                sb.append('%').append(String.format("%02X", b & 0xff));
            }
        }
        return sb.toString();
    }

    private static String sha256Hex(String texto) {
        try {
            return HexFormat.of().formatHex(
                    MessageDigest.getInstance("SHA-256").digest(texto.getBytes(StandardCharsets.UTF_8)));
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }

    private static byte[] hmac(byte[] llave, String texto) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(llave, "HmacSHA256"));
            return mac.doFinal(texto.getBytes(StandardCharsets.UTF_8));
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }
}
