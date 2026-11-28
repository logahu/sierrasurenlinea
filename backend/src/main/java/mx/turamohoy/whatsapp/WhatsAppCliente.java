package mx.turamohoy.whatsapp;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentLinkedQueue;

/**
 * Envía mensajes por la WhatsApp Cloud API de Meta.
 *
 * <p>Sin {@code WHATSAPP_TOKEN} trabaja en <b>modo simulado</b>: no llama a Meta, escribe el mensaje
 * en el log y lo guarda en {@link #simulados()} (desarrollo local y pruebas).
 */
@ApplicationScoped
public class WhatsAppCliente {

    private static final Logger LOG = Logger.getLogger(WhatsAppCliente.class);

    /** Un mensaje que se habría enviado (modo simulado). */
    public record Enviado(String phoneNumberId, String para, String texto, String wamid) {
    }

    /** Meta rechazó el envío; {@code codigo} es el de Meta (p. ej. 131047: fuera de la ventana de 24 h). */
    public static class ErrorWhatsApp extends RuntimeException {
        public final int codigo;

        public ErrorWhatsApp(int codigo, String mensaje) {
            super(mensaje);
            this.codigo = codigo;
        }
    }

    @ConfigProperty(name = "sierrasur.whatsapp.token")
    Optional<String> token;

    @ConfigProperty(name = "sierrasur.whatsapp.api-version", defaultValue = "v25.0")
    String version;

    @ConfigProperty(name = "sierrasur.whatsapp.graph-url", defaultValue = "https://graph.facebook.com")
    String graphUrl;

    @Inject
    ObjectMapper json;

    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    private final ConcurrentLinkedQueue<Enviado> simulados = new ConcurrentLinkedQueue<>();

    public boolean simulado() {
        return token.map(String::isBlank).orElse(true);
    }

    /** Lo que se "envió" en modo simulado, en orden. */
    public List<Enviado> simulados() {
        return List.copyOf(simulados);
    }

    /**
     * Envía un texto libre (solo dentro de la ventana de 24 h). Devuelve el wamid que asigna Meta.
     *
     * @param para número con lada y sin "+", p. ej. "529511234567"
     */
    public String enviarTexto(String phoneNumberId, String para, String texto) {
        if (simulado()) {
            String wamid = "wamid.simulado-" + UUID.randomUUID();
            simulados.add(new Enviado(phoneNumberId, para, texto, wamid));
            LOG.infof("[WhatsApp simulado] %s → %s: %s", phoneNumberId, para, texto);
            return wamid;
        }
        Map<String, Object> cuerpo = Map.of(
                "messaging_product", "whatsapp",
                "recipient_type", "individual",
                "to", para,
                "type", "text",
                "text", Map.of("preview_url", false, "body", texto));
        try {
            HttpRequest req = HttpRequest.newBuilder(URI.create(graphUrl + "/" + version + "/" + phoneNumberId + "/messages"))
                    .timeout(Duration.ofSeconds(20))
                    .header("Authorization", "Bearer " + token.get())
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(cuerpo)))
                    .build();
            HttpResponse<String> r = http.send(req, HttpResponse.BodyHandlers.ofString());
            JsonNode respuesta = json.readTree(r.body() == null || r.body().isBlank() ? "{}" : r.body());
            if (r.statusCode() / 100 != 2) {
                JsonNode e = respuesta.path("error");
                throw new ErrorWhatsApp(e.path("code").asInt(r.statusCode()),
                        e.path("message").asText("Meta respondió " + r.statusCode()));
            }
            return respuesta.path("messages").path(0).path("id").asText(null);
        } catch (ErrorWhatsApp e) {
            throw e;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new ErrorWhatsApp(0, "Envío interrumpido");
        } catch (Exception e) {
            throw new ErrorWhatsApp(0, "No se pudo llamar a Meta: " + e.getMessage());
        }
    }
}
