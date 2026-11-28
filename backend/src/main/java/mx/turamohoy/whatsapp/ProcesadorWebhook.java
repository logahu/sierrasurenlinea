package mx.turamohoy.whatsapp;

import com.fasterxml.jackson.databind.JsonNode;
import io.quarkus.narayana.jta.QuarkusTransaction;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import mx.turamohoy.catalogo.model.Negocio;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Lo que hace el sistema con cada aviso (webhook) de Meta:
 * <ul>
 *   <li>{@code messages} → mensajes de clientes: se guardan (sin duplicar) y se pasan a la recepcionista;
 *       y estados de los mensajes enviados (entregado, leído, fallido).</li>
 *   <li>{@code smb_message_echoes} → lo que escribió alguien del negocio en la app WhatsApp Business
 *       (coexistencia): se guarda y el bot se pausa en esa conversación.</li>
 * </ul>
 * El negocio se reconoce por {@code metadata.phone_number_id}; si no es de ningún negocio, se ignora.
 */
@ApplicationScoped
public class ProcesadorWebhook {

    private static final Logger LOG = Logger.getLogger(ProcesadorWebhook.class);

    /** Orden de los estados: uno que llega tarde (entregado después de leído) no regresa el estado. */
    private static final Map<String, Integer> RANGO = Map.of(
            WaMensaje.ENVIADO, 1, WaMensaje.ENTREGADO, 2, WaMensaje.LEIDO, 3, WaMensaje.FALLIDO, 4);

    @ConfigProperty(name = "sierrasur.whatsapp.pausa-humano-horas", defaultValue = "12")
    int pausaHumanoHoras;

    @Inject
    Recepcionista recepcionista;

    @Inject
    WhatsAppCliente cliente;

    /** Guarda lo que trae el aviso y devuelve los ids de los mensajes que la recepcionista debe contestar. */
    public List<Long> registrar(JsonNode raiz) {
        return QuarkusTransaction.requiringNew().call(() -> {
            List<Long> porContestar = new ArrayList<>();
            Instant ahora = Instant.now();
            for (JsonNode entrada : raiz.path("entry")) {
                for (JsonNode cambio : entrada.path("changes")) {
                    JsonNode valor = cambio.path("value");
                    String phoneNumberId = valor.path("metadata").path("phone_number_id").asText("");
                    Negocio n = phoneNumberId.isEmpty() ? null
                            : Negocio.<Negocio>find("waPhoneNumberId", phoneNumberId).firstResult();
                    if (n == null) {
                        LOG.warnf("Aviso de WhatsApp para un número sin negocio (%s); se ignora.", phoneNumberId);
                        continue;
                    }
                    switch (cambio.path("field").asText()) {
                        case "messages" -> {
                            mensajesEntrantes(n, valor, ahora, porContestar);
                            estados(valor);
                        }
                        case "smb_message_echoes" -> ecosDelNegocio(n, valor, ahora);
                        default -> LOG.debugf("Aviso de WhatsApp sin manejar: %s", cambio.path("field").asText());
                    }
                }
            }
            return porContestar;
        });
    }

    private void mensajesEntrantes(Negocio n, JsonNode valor, Instant ahora, List<Long> porContestar) {
        Map<String, JsonNode> contactos = new HashMap<>();
        for (JsonNode c : valor.path("contacts")) {
            contactos.put(c.path("wa_id").asText(), c);
        }
        for (JsonNode m : valor.path("messages")) {
            String wamid = m.path("id").asText(null);
            String waId = m.path("from").asText("");
            if (waId.isEmpty() || WaMensaje.existe(wamid)) {
                continue; // reintento de Meta: ya lo teníamos
            }
            WaConversacion c = WaConversacion.obtener(n, waId, ahora);
            JsonNode contacto = contactos.get(waId);
            if (contacto != null) {
                String nombre = contacto.path("profile").path("name").asText("");
                if (!nombre.isBlank()) {
                    c.nombrePerfil = nombre.substring(0, Math.min(120, nombre.length()));
                }
                String userId = contacto.path("user_id").asText("");
                if (!userId.isBlank()) {
                    c.userId = userId.substring(0, Math.min(60, userId.length()));
                }
            }
            c.ultimoEntrante = ahora;
            c.actualizado = ahora;
            WaMensaje nuevo = WaMensaje.nuevo(c, WaMensaje.ENTRANTE, wamid, m.path("type").asText(), textoDe(m), ahora);
            if (n.botActivo && !c.atiendeHumano(ahora)) {
                porContestar.add(nuevo.id);
            }
        }
    }

    /** Estados de lo que enviamos: sent, delivered, read, failed. */
    private void estados(JsonNode valor) {
        for (JsonNode s : valor.path("statuses")) {
            WaMensaje m = WaMensaje.porWamid(s.path("id").asText(null));
            if (m == null) {
                continue;
            }
            String estado = switch (s.path("status").asText()) {
                case "sent" -> WaMensaje.ENVIADO;
                case "delivered" -> WaMensaje.ENTREGADO;
                case "read" -> WaMensaje.LEIDO;
                case "failed" -> WaMensaje.FALLIDO;
                default -> null;
            };
            if (estado == null || RANGO.get(estado) <= RANGO.getOrDefault(m.estado, 0)) {
                continue;
            }
            m.estado = estado;
            if (WaMensaje.FALLIDO.equals(estado)) {
                JsonNode e = s.path("errors").path(0);
                String error = e.path("code").asText("") + " " + e.path("title").asText("");
                m.error = error.trim().substring(0, Math.min(300, error.trim().length()));
            }
        }
    }

    /** Lo que escribió alguien del negocio desde la app: se guarda y el bot se pausa en esa conversación. */
    private void ecosDelNegocio(Negocio n, JsonNode valor, Instant ahora) {
        for (JsonNode m : valor.path("message_echoes")) {
            String wamid = m.path("id").asText(null);
            String waId = m.path("to").asText("");
            if (waId.isEmpty() || WaMensaje.existe(wamid)) {
                continue;
            }
            WaConversacion c = WaConversacion.obtener(n, waId, ahora);
            c.humanoHasta = ahora.plus(Duration.ofHours(pausaHumanoHoras));
            c.actualizado = ahora;
            WaMensaje.nuevo(c, WaMensaje.NEGOCIO, wamid, m.path("type").asText(), textoDe(m), ahora);
        }
    }

    /** El texto legible de un mensaje: texto, botón o lista elegidos; null en fotos, audios, etc. */
    static String textoDe(JsonNode m) {
        return switch (m.path("type").asText()) {
            case "text" -> m.path("text").path("body").asText(null);
            case "button" -> m.path("button").path("text").asText(null);
            case "interactive" -> {
                JsonNode i = m.path("interactive");
                JsonNode r = i.has("button_reply") ? i.path("button_reply") : i.path("list_reply");
                yield r.path("title").asText(null);
            }
            default -> {
                String caption = m.path(m.path("type").asText()).path("caption").asText("");
                yield caption.isBlank() ? null : caption;
            }
        };
    }

    /** Lo que se va a enviar, armado dentro de una transacción. */
    private record Respuesta(Long conversacionId, String phoneNumberId, String para, String texto) {
    }

    /**
     * Pide la respuesta a la recepcionista y la envía. Revisa otra vez que el bot siga prendido, que nadie
     * del negocio haya tomado la conversación y que la ventana de 24 h siga abierta.
     */
    public void atender(Long mensajeId) {
        Instant ahora = Instant.now();
        Respuesta r = QuarkusTransaction.requiringNew().call(() -> {
            WaMensaje m = WaMensaje.findById(mensajeId);
            if (m == null) {
                return null;
            }
            WaConversacion c = m.conversacion;
            Negocio n = c.negocio;
            if (!n.botActivo || n.waPhoneNumberId == null || c.atiendeHumano(ahora) || !c.ventanaAbierta(ahora)) {
                return null;
            }
            return recepcionista.responder(c, m)
                    .filter(t -> !t.isBlank())
                    .map(t -> new Respuesta(c.id, n.waPhoneNumberId, c.destino(), t))
                    .orElse(null);
        });
        if (r == null) {
            return;
        }
        String wamid = null;
        String error = null;
        try {
            wamid = cliente.enviarTexto(r.phoneNumberId(), r.para(), r.texto());
        } catch (WhatsAppCliente.ErrorWhatsApp e) {
            error = (e.codigo + " " + e.getMessage()).trim();
            LOG.warnf("No se pudo contestar por WhatsApp (conversación %d): %s", r.conversacionId(), error);
        }
        String id = wamid;
        String falla = error;
        QuarkusTransaction.requiringNew().run(() -> {
            WaConversacion c = WaConversacion.findById(r.conversacionId());
            WaMensaje s = WaMensaje.nuevo(c, WaMensaje.SALIENTE, id, "text", r.texto(), Instant.now());
            s.estado = falla == null ? WaMensaje.ENVIADO : WaMensaje.FALLIDO;
            s.error = falla == null ? null : falla.substring(0, Math.min(300, falla.length()));
            c.actualizado = s.creado;
        });
    }
}
