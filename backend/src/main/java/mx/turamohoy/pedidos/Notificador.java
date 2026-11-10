package mx.turamohoy.pedidos;

import io.quarkus.narayana.jta.QuarkusTransaction;
import jakarta.enterprise.context.ApplicationScoped;
import org.jboss.logging.Logger;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.time.Duration;
import java.time.Instant;
import java.util.List;

/**
 * Notificaciones push a los celulares del panel (Web Push con VAPID). Las llaves VAPID
 * se generan solas la primera vez y se guardan en la base (tabla ajuste).
 */
@ApplicationScoped
public class Notificador {

    private static final Logger LOG = Logger.getLogger(Notificador.class);
    static final String CONTACTO = "https://sierrasurenlinea.com.mx";

    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    private volatile KeyPair vapid;

    /** Llave pública VAPID (base64url) que el navegador necesita para suscribirse. */
    public String clavePublica() {
        return WebPushCifrado.base64url(WebPushCifrado.crudo((java.security.interfaces.ECPublicKey) llaves().getPublic()));
    }

    synchronized KeyPair llaves() {
        if (vapid == null) {
            vapid = QuarkusTransaction.requiringNew().call(() -> {
                Ajuste a = Ajuste.findById("vapid");
                if (a == null) {
                    a = new Ajuste();
                    a.clave = "vapid";
                    a.valor = WebPushCifrado.aTexto(WebPushCifrado.nuevoPar());
                    a.persist();
                }
                return WebPushCifrado.deTexto(a.valor);
            });
        }
        return vapid;
    }

    public record Destino(String endpoint, String p256dh, String auth) {
    }

    /** Avisa de un pedido nuevo a quienes atienden ese negocio. No bloquea ni falla. */
    public void pedidoNuevo(Long pedidoId) {
        try {
            record Datos(String titulo, String cuerpo, List<Destino> destinos) {
            }
            Datos d = QuarkusTransaction.requiringNew().call(() -> {
                Pedido p = Pedido.findById(pedidoId);
                // Administradores, el encargado y los repartidores del negocio; si hay que
                // llevarlo, también los repartidores generales (sin negocio).
                String quienes = "usuario.activo = true and (usuario.rol = 'DUENO' or usuario.negocio = ?1"
                        + (p.aDomicilio() ? " or (usuario.rol = 'REPARTIDOR' and usuario.negocio is null)" : "") + ")";
                List<Destino> destinos = PushSuscripcion.<PushSuscripcion>list(quienes, p.negocio)
                        .stream().map(s -> new Destino(s.endpoint, s.p256dh, s.auth)).toList();
                String titulo = p.negocio.nombre + ": " + p.tipo + " · " + p.folio;
                String cuerpo = p.clienteNombre + " · " + p.entregar
                        + (p.totalEstimado != null ? " · aprox. $" + p.totalEstimado.stripTrailingZeros().toPlainString() : "");
                return new Datos(titulo, cuerpo, destinos);
            });
            enviar(d.titulo(), d.cuerpo(), "pedido-" + pedidoId, d.destinos());
        } catch (RuntimeException e) {
            LOG.warnf(e, "No se pudo avisar del pedido %d", pedidoId);
        }
    }

    void enviar(String titulo, String cuerpo, String etiqueta, List<Destino> destinos) {
        if (destinos.isEmpty()) {
            return;
        }
        byte[] contenido = carga(titulo, cuerpo, etiqueta).getBytes(StandardCharsets.UTF_8);
        long expira = Instant.now().plus(Duration.ofHours(12)).getEpochSecond();
        for (Destino s : destinos) {
            try {
                HttpRequest req = HttpRequest.newBuilder(URI.create(s.endpoint()))
                        .timeout(Duration.ofSeconds(15))
                        .header("TTL", "86400")
                        .header("Urgency", "high")
                        .header("Content-Encoding", "aes128gcm")
                        .header("Content-Type", "application/octet-stream")
                        .header("Authorization", WebPushCifrado.autorizacionVapid(s.endpoint(), llaves(), CONTACTO, expira))
                        .POST(HttpRequest.BodyPublishers.ofByteArray(WebPushCifrado.cifrar(contenido, s.p256dh(), s.auth())))
                        .build();
                http.sendAsync(req, HttpResponse.BodyHandlers.discarding()).thenAccept(r -> {
                    if (r.statusCode() == 404 || r.statusCode() == 410) {
                        // El celular ya no acepta notificaciones: se borra la suscripción.
                        QuarkusTransaction.requiringNew().run(() -> PushSuscripcion.delete("endpoint", s.endpoint()));
                    } else if (r.statusCode() >= 300) {
                        LOG.warnf("Push rechazado (%d) por %s", r.statusCode(), URI.create(s.endpoint()).getHost());
                    }
                });
            } catch (RuntimeException e) {
                LOG.warnf(e, "No se pudo enviar push a %s", s.endpoint());
            }
        }
    }

    /** Formato que entiende el service worker de Angular (ngsw). */
    static String carga(String titulo, String cuerpo, String etiqueta) {
        return "{\"notification\":{"
                + "\"title\":" + json(titulo) + ","
                + "\"body\":" + json(cuerpo) + ","
                + "\"icon\":\"icons/icon-192x192.png\","
                + "\"badge\":\"icons/icon-96x96.png\","
                + "\"tag\":" + json(etiqueta) + ","
                + "\"renotify\":true,\"requireInteraction\":true,\"vibrate\":[300,100,300,100,300],"
                + "\"data\":{\"onActionClick\":{\"default\":{\"operation\":\"navigateLastFocusedOrOpen\",\"url\":\"/admin/pedidos\"}}}"
                + "}}";
    }

    static String json(String s) {
        StringBuilder b = new StringBuilder("\"");
        for (char c : s.toCharArray()) {
            switch (c) {
                case '"' -> b.append("\\\"");
                case '\\' -> b.append("\\\\");
                case '\n' -> b.append("\\n");
                case '\r' -> b.append("\\r");
                case '\t' -> b.append("\\t");
                default -> {
                    if (c < 0x20) {
                        b.append(String.format("\\u%04x", (int) c));
                    } else {
                        b.append(c);
                    }
                }
            }
        }
        return b.append('"').toString();
    }
}
