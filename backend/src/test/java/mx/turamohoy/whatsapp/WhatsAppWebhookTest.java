package mx.turamohoy.whatsapp;

import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import jakarta.inject.Inject;
import mx.turamohoy.admin.Sesiones;
import mx.turamohoy.catalogo.model.Negocio;
import mx.turamohoy.clientes.Clientes;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.BooleanSupplier;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Webhook de WhatsApp (fase 2): verificación, firma, mensajes sin duplicar, estados, pausa por humano y bot eco. */
@QuarkusTest
class WhatsAppWebhookTest {

    private static final String WEBHOOK = "/api/whatsapp/webhook";
    private static final String SLUG = "estudio-melgarejo";
    private static final String CONEXION = "/api/admin/negocios/" + SLUG + "/whatsapp";
    private static final String SECRETO = "secreto-de-prueba";

    @Inject
    WhatsAppCliente cliente;

    private String phoneNumberId;

    @BeforeEach
    void conectarMelgarejo() {
        phoneNumberId = String.valueOf(1_000_000_000_000L + Math.abs(UUID.randomUUID().getMostSignificantBits() % 1_000_000_000_000L));
        given().auth().oauth2(Sesiones.dueno()).contentType(ContentType.JSON)
                .body(Map.of("phoneNumberId", phoneNumberId, "botActivo", true))
                .when().put(CONEXION).then().statusCode(200)
                .body("phoneNumberId", equalTo(phoneNumberId)).body("botActivo", equalTo(true)).body("simulado", equalTo(true));
    }

    @AfterEach
    void desconectar() {
        Map<String, Object> c = new HashMap<>();
        c.put("phoneNumberId", null);
        c.put("botActivo", false);
        given().auth().oauth2(Sesiones.dueno()).contentType(ContentType.JSON).body(c)
                .when().put(CONEXION).then().statusCode(200).body("botActivo", equalTo(false));
    }

    // ------------------------------------------------------------------ apoyo

    private static String firma(String cuerpo) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(SECRETO.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return "sha256=" + java.util.HexFormat.of().formatHex(mac.doFinal(cuerpo.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private static int enviar(String cuerpo) {
        // Bytes UTF-8 exactos: la firma se calcula sobre lo que viaja.
        return given().header("X-Hub-Signature-256", firma(cuerpo)).contentType(ContentType.JSON)
                .body(cuerpo.getBytes(StandardCharsets.UTF_8)).when().post(WEBHOOK).then().extract().statusCode();
    }

    /** Igual al aviso real que manda Meta cuando un cliente escribe (con número ficticio). */
    private String mensaje(String para, String waId, String wamid, String texto) {
        return """
                {"object":"whatsapp_business_account","entry":[{"id":"1696325115279722","changes":[{"value":{
                  "messaging_product":"whatsapp",
                  "metadata":{"display_phone_number":"15551739508","phone_number_id":"%s"},
                  "contacts":[{"profile":{"name":"Lucía"},"wa_id":"%s","user_id":"MX.1000000000000001","country_code":"MX"}],
                  "messages":[{"from":"%s","from_user_id":"MX.1000000000000001","id":"%s","timestamp":"1795842497",
                    "text":{"body":"%s"},"type":"text",
                    "internal_1p_only_data":{"account_context":{"account_context_type":"non_paid_messaging"}}}]
                },"field":"messages"}]}]}
                """.formatted(para, waId, waId, wamid, texto);
    }

    private String estado(String wamid, String status, String waId) {
        return """
                {"object":"whatsapp_business_account","entry":[{"id":"1696325115279722","changes":[{"value":{
                  "messaging_product":"whatsapp",
                  "metadata":{"display_phone_number":"15551739508","phone_number_id":"%s"},
                  "statuses":[{"id":"%s","status":"%s","timestamp":"1795842500","recipient_id":"%s"}]
                },"field":"messages"}]}]}
                """.formatted(phoneNumberId, wamid, status, waId);
    }

    private String ecoDelNegocio(String waId, String texto) {
        return """
                {"object":"whatsapp_business_account","entry":[{"id":"1696325115279722","changes":[{"value":{
                  "messaging_product":"whatsapp",
                  "metadata":{"display_phone_number":"15551739508","phone_number_id":"%s"},
                  "message_echoes":[{"from":"15551739508","to":"%s","id":"wamid.eco-%s","timestamp":"1795842600",
                    "type":"text","text":{"body":"%s"}}]
                },"field":"smb_message_echoes"}]}]}
                """.formatted(phoneNumberId, waId, UUID.randomUUID(), texto);
    }

    private static void esperar(BooleanSupplier condicion) {
        long limite = System.currentTimeMillis() + 5000;
        while (!condicion.getAsBoolean()) {
            if (System.currentTimeMillis() > limite) {
                throw new AssertionError("No pasó en 5 s");
            }
            try {
                Thread.sleep(50);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return;
            }
        }
    }

    private List<WhatsAppCliente.Enviado> enviadosA(String para) {
        return cliente.simulados().stream().filter(e -> e.para().equals(para)).toList();
    }

    private static long mensajes(String waId, String direccion) {
        return QuarkusTransaction.requiringNew().call(() ->
                WaMensaje.count("conversacion.waId = ?1 and direccion = ?2", waId, direccion));
    }

    // ------------------------------------------------------------------ pruebas

    @Test
    void metaVerificaLaUrlSoloConElTokenCorrecto() {
        given().queryParam("hub.mode", "subscribe").queryParam("hub.verify_token", "verificacion-de-prueba")
                .queryParam("hub.challenge", "1158201444").when().get(WEBHOOK)
                .then().statusCode(200).body(equalTo("1158201444"));
        given().queryParam("hub.mode", "subscribe").queryParam("hub.verify_token", "otro")
                .queryParam("hub.challenge", "1158201444").when().get(WEBHOOK).then().statusCode(403);
        given().when().get(WEBHOOK).then().statusCode(403);
    }

    @Test
    void sinFirmaValidaNoSeAceptaNada() {
        String cuerpo = mensaje(phoneNumberId, "521" + Clientes.telefonoNuevo(), "wamid." + UUID.randomUUID(), "Hola");
        given().contentType(ContentType.JSON).body(cuerpo).when().post(WEBHOOK).then().statusCode(401);
        given().header("X-Hub-Signature-256", "sha256=" + "0".repeat(64)).contentType(ContentType.JSON).body(cuerpo)
                .when().post(WEBHOOK).then().statusCode(401);
        given().header("X-Hub-Signature-256", "sha256=no-es-hex").contentType(ContentType.JSON).body(cuerpo)
                .when().post(WEBHOOK).then().statusCode(401);
        // Cambiar un byte del cuerpo invalida la firma.
        given().header("X-Hub-Signature-256", firma(cuerpo)).contentType(ContentType.JSON)
                .body(cuerpo.replace("Hola", "Hole").getBytes(StandardCharsets.UTF_8))
                .when().post(WEBHOOK).then().statusCode(401);
    }

    @Test
    void elBotContestaUnaVezAunqueMetaReintenteYGuardaLosEstados() {
        String tel = Clientes.telefonoNuevo();
        String waId = "521" + tel;
        String wamid = "wamid." + UUID.randomUUID();
        String cuerpo = mensaje(phoneNumberId, waId, wamid, "Quiero una cita");

        assertEquals(200, enviar(cuerpo));
        // Contesta al 52 + 10 dígitos (sin el 1 con que llega de México), con el número del negocio.
        esperar(() -> enviadosA("52" + tel).size() == 1);
        WhatsAppCliente.Enviado r = enviadosA("52" + tel).get(0);
        assertEquals(phoneNumberId, r.phoneNumberId());
        assertTrue(r.texto().contains("Lucía") && r.texto().contains("Estudio Melgarejo")
                && r.texto().contains("«Quiero una cita»"), r.texto());

        // Meta reintenta el mismo aviso: no se duplica ni se vuelve a contestar.
        assertEquals(200, enviar(cuerpo));
        esperar(() -> mensajes(waId, WaMensaje.SALIENTE) == 1);
        assertEquals(1, mensajes(waId, WaMensaje.ENTRANTE));
        assertEquals(1, enviadosA("52" + tel).size());

        QuarkusTransaction.requiringNew().run(() -> {
            WaConversacion c = WaConversacion.find("waId", waId).firstResult();
            assertEquals(tel, c.telefono);
            assertEquals("Lucía", c.nombrePerfil);
            assertEquals("MX.1000000000000001", c.userId);
            assertTrue(c.ventanaAbierta(Instant.now()));
            WaMensaje s = WaMensaje.find("conversacion = ?1 and direccion = ?2", c, WaMensaje.SALIENTE).firstResult();
            assertEquals(r.wamid(), s.wamid);
            assertEquals(WaMensaje.ENVIADO, s.estado);
        });

        // Estados del mensaje del bot: leído, y uno atrasado (entregado) no lo regresa.
        assertEquals(200, enviar(estado(r.wamid(), "read", waId)));
        assertEquals(200, enviar(estado(r.wamid(), "delivered", waId)));
        QuarkusTransaction.requiringNew().run(() -> assertEquals(WaMensaje.LEIDO, WaMensaje.porWamid(r.wamid()).estado));
    }

    @Test
    void siAlguienDelNegocioContestaDesdeLaAppElBotSeCalla() {
        String tel = Clientes.telefonoNuevo();
        String waId = "521" + tel;
        assertEquals(200, enviar(mensaje(phoneNumberId, waId, "wamid." + UUID.randomUUID(), "Hola")));
        esperar(() -> enviadosA("52" + tel).size() == 1);

        assertEquals(200, enviar(ecoDelNegocio(waId, "Hola Lucía, soy Ana del estudio. ¿Te late el jueves?")));
        QuarkusTransaction.requiringNew().run(() -> {
            WaConversacion c = WaConversacion.find("waId", waId).firstResult();
            assertTrue(c.atiendeHumano(Instant.now()));
        });
        assertEquals(1, mensajes(waId, WaMensaje.NEGOCIO));

        assertEquals(200, enviar(mensaje(phoneNumberId, waId, "wamid." + UUID.randomUUID(), "Sí, el jueves")));
        assertEquals(2, mensajes(waId, WaMensaje.ENTRANTE));
        try {
            Thread.sleep(300);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        assertEquals(1, enviadosA("52" + tel).size(), "El bot no debe contestar mientras atiende una persona");
    }

    @Test
    void conElBotApagadoSoloGuardaYUnNumeroAjenoSeIgnora() {
        given().auth().oauth2(Sesiones.dueno()).contentType(ContentType.JSON)
                .body(Map.of("phoneNumberId", phoneNumberId, "botActivo", false))
                .when().put(CONEXION).then().statusCode(200).body("botActivo", equalTo(false));
        String tel = Clientes.telefonoNuevo();
        String waId = "521" + tel;
        assertEquals(200, enviar(mensaje(phoneNumberId, waId, "wamid." + UUID.randomUUID(), "Hola")));
        assertEquals(1, mensajes(waId, WaMensaje.ENTRANTE));
        try {
            Thread.sleep(300);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        assertTrue(enviadosA("52" + tel).isEmpty());

        // Un phone_number_id que no es de ningún negocio: 200 (para que Meta no reintente) y no se guarda nada.
        String otro = "521" + Clientes.telefonoNuevo();
        assertEquals(200, enviar(mensaje("999999999999999", otro, "wamid." + UUID.randomUUID(), "Hola")));
        assertEquals(0, mensajes(otro, WaMensaje.ENTRANTE));
    }

    @Test
    void elMismoNumeroNoSeConectaADosNegociosYSoloElDuenoLoCambia() {
        given().auth().oauth2(Sesiones.dueno()).contentType(ContentType.JSON)
                .body(Map.of("phoneNumberId", phoneNumberId, "botActivo", true))
                .when().put("/api/admin/negocios/turamohoy/whatsapp").then().statusCode(409);
        given().auth().oauth2(Sesiones.dueno()).contentType(ContentType.JSON)
                .body(Map.of("phoneNumberId", "abc", "botActivo", true))
                .when().put(CONEXION).then().statusCode(400);
        given().contentType(ContentType.JSON).body(Map.of("phoneNumberId", phoneNumberId, "botActivo", true))
                .when().put(CONEXION).then().statusCode(401);
        QuarkusTransaction.requiringNew().run(() -> {
            Negocio n = Negocio.find("slug", SLUG).firstResult();
            assertNotNull(n.waPhoneNumberId);
            assertTrue(n.botActivo);
            Negocio t = Negocio.find("slug", "turamohoy").firstResult();
            assertNull(t.waPhoneNumberId);
            assertFalse(t.botActivo);
        });
    }

    @Test
    void destinoDeMexicoQuitaElUno() {
        assertEquals("529511234567", WaConversacion.destinoDe("5219511234567"));
        assertEquals("15551739508", WaConversacion.destinoDe("15551739508"));
    }
}
