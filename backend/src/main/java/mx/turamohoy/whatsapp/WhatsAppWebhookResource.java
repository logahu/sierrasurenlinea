package mx.turamohoy.whatsapp;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.security.PermitAll;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.Response.Status;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;

/**
 * Webhook de la WhatsApp Cloud API. En Meta (caso de uso de WhatsApp → Configuración / Paso 2) se
 * registra la URL {@code https://<backend>/api/whatsapp/webhook} con el mismo token de verificación que
 * {@code WHATSAPP_VERIFY_TOKEN}, y se suscribe el campo {@code messages} (y {@code smb_message_echoes}
 * para la coexistencia con la app WhatsApp Business).
 */
@Path("/api/whatsapp/webhook")
@PermitAll
public class WhatsAppWebhookResource {

    private static final Logger LOG = Logger.getLogger(WhatsAppWebhookResource.class);

    @ConfigProperty(name = "sierrasur.whatsapp.verify-token")
    Optional<String> tokenVerificacion;

    /** "Clave secreta de la app" (Configuración de la app → Básica): firma cada aviso de Meta. */
    @ConfigProperty(name = "sierrasur.whatsapp.app-secret")
    Optional<String> secretoApp;

    @Inject
    ObjectMapper json;

    @Inject
    ProcesadorWebhook procesador;

    /** Meta verifica la URL al guardarla: hay que devolver hub.challenge si el token coincide. */
    @GET
    @Produces(MediaType.TEXT_PLAIN)
    public Response verificar(@QueryParam("hub.mode") String modo,
                              @QueryParam("hub.verify_token") String token,
                              @QueryParam("hub.challenge") String reto) {
        String esperado = tokenVerificacion.orElse("");
        if ("subscribe".equals(modo) && !esperado.isBlank() && iguales(esperado, token) && reto != null) {
            return Response.ok(reto).build();
        }
        LOG.warn("Verificación del webhook de WhatsApp rechazada (token distinto o sin configurar).");
        return Response.status(Status.FORBIDDEN).build();
    }

    /**
     * Avisos de Meta. Se valida la firma, se guarda lo recibido y se contesta 200 de inmediato
     * (Meta reintenta si tardamos); las respuestas del bot se envían aparte.
     */
    @POST
    @Consumes(MediaType.WILDCARD)
    public Response recibir(@HeaderParam("X-Hub-Signature-256") String firma, byte[] cuerpo) {
        if (!firmaValida(firma, cuerpo)) {
            LOG.warn("Aviso de WhatsApp con firma inválida; se rechaza.");
            return Response.status(Status.UNAUTHORIZED).build();
        }
        JsonNode raiz;
        try {
            raiz = json.readTree(cuerpo);
        } catch (Exception e) {
            return Response.status(Status.BAD_REQUEST).build();
        }
        if (!"whatsapp_business_account".equals(raiz.path("object").asText())) {
            return Response.ok().build();
        }
        List<Long> porContestar = procesador.registrar(raiz);
        for (Long id : porContestar) {
            CompletableFuture.runAsync(() -> procesador.atender(id)).exceptionally(e -> {
                LOG.errorf(e, "Falló la respuesta del bot al mensaje %d", id);
                return null;
            });
        }
        return Response.ok().build();
    }

    /** X-Hub-Signature-256 = "sha256=" + HMAC-SHA256(cuerpo, clave secreta de la app), en hexadecimal. */
    boolean firmaValida(String firma, byte[] cuerpo) {
        String secreto = secretoApp.orElse("");
        if (secreto.isBlank() || firma == null || !firma.startsWith("sha256=") || cuerpo == null) {
            return false;
        }
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secreto.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] esperada = mac.doFinal(cuerpo);
            byte[] recibida = HexFormat.of().parseHex(firma.substring("sha256=".length()));
            return MessageDigest.isEqual(esperada, recibida);
        } catch (IllegalArgumentException e) {
            return false; // no es hexadecimal
        } catch (Exception e) {
            LOG.error("No se pudo calcular la firma del webhook", e);
            return false;
        }
    }

    private static boolean iguales(String a, String b) {
        return b != null && MessageDigest.isEqual(a.getBytes(StandardCharsets.UTF_8), b.getBytes(StandardCharsets.UTF_8));
    }
}
