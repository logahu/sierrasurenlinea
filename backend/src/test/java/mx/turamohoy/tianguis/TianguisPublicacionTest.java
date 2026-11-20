package mx.turamohoy.tianguis;

import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.Map;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.nullValue;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Fase 2: publicar sin cuenta, moderación, enlace privado de gestión, vencimientos, reportes y antispam. */
@QuarkusTest
class TianguisPublicacionTest extends BaseTianguis {

    private static Map<String, Object> publicacion(String titulo, String whatsapp) {
        Map<String, Object> m = vehiculo(titulo, 45000, whatsapp);
        m.put("aceptaReglas", true);
        m.put("sitioWeb", "");
        return m;
    }

    private static io.restassured.response.ValidatableResponse publicar(Map<String, Object> m, String ip) {
        return given().contentType(ContentType.JSON).header("X-Forwarded-For", ip).body(m)
                .when().post("/api/tianguis/anuncios").then();
    }

    /** Publica y devuelve {id, token}. */
    private static Map<String, Object> publicado(String titulo, String whatsapp) {
        return publicar(publicacion(titulo, whatsapp), "10.0.0.1").statusCode(201)
                .body("estado", equalTo("PENDIENTE")).extract().as(Map.class);
    }

    private static io.restassured.response.ValidatableResponse gestion(Object token) {
        return given().when().get("/api/tianguis/gestion/" + token).then();
    }

    private static io.restassured.response.ValidatableResponse accion(Object token, String accion) {
        return given().contentType(ContentType.JSON).when().post("/api/tianguis/gestion/" + token + "/" + accion).then();
    }

    @Test
    void unVisitantePublicaQuedaEnRevisionYRecibeSuEnlace() {
        String w = palabra();
        String tel = whatsappNuevo();
        Map<String, Object> p = publicado("Vocho " + w, "+52 1 " + tel);
        int id = (Integer) p.get("id");
        String token = (String) p.get("token");
        assertTrue(token.length() >= 40);
        // No se ve hasta que lo aprueben.
        assertTrue(idsPublicos(w).isEmpty());
        given().when().get("/api/tianguis/anuncios/" + id).then().statusCode(404);
        gestion(token).statusCode(200).body("estado", equalTo("PENDIENTE")).body("vendedorWhatsapp", equalTo("52" + tel))
                .body("puedeEditar", equalTo(true)).body("puedeRenovar", equalTo(false));
        // Solo se guarda el hash del token.
        String guardado = QuarkusTransaction.requiringNew().call(() ->
                AnuncioTianguis.<AnuncioTianguis>findById((long) id).tokenHash);
        assertNotEquals(token, guardado);
        assertEquals(Tianguis.hash(token), guardado);
        // Aparece en la bandeja de pendientes; al aprobarlo se ve.
        como(dueno).when().get("/api/admin/tianguis/anuncios?estado=PENDIENTE&q=" + w).then()
                .body("anuncios.id", hasItem(id)).body("anuncios[0].delPublico", equalTo(true));
        estado(id, "PUBLICADO", null);
        assertEquals(java.util.List.of(id), idsPublicos(w));
        gestion(token).body("estado", equalTo("PUBLICADO")).body("fechaVencimiento", equalTo("2026-12-19T12:00:00"));
        gestion("token-inventado-que-no-existe-123456").statusCode(404);
    }

    @Test
    void elRechazoMuestraElMotivoYEditarLoRegresaARevision() {
        Map<String, Object> p = publicado("Rechazable " + palabra(), whatsappNuevo());
        int id = (Integer) p.get("id");
        estado(id, "RECHAZADO", "Las fotos no son del artículo");
        gestion(p.get("token")).body("estado", equalTo("RECHAZADO"))
                .body("motivoRechazo", equalTo("Las fotos no son del artículo"));
        Map<String, Object> corregido = publicacion("Ya con fotos reales", whatsappNuevo());
        given().contentType(ContentType.JSON).body(corregido).when().put("/api/tianguis/gestion/" + p.get("token"))
                .then().statusCode(200).body("estado", equalTo("PENDIENTE")).body("motivoRechazo", nullValue())
                .body("titulo", equalTo("Ya con fotos reales"));
    }

    @Test
    void editarUnAnuncioPublicadoLoRegresaARevision() {
        String w = palabra();
        Map<String, Object> p = publicado("Editable " + w, whatsappNuevo());
        estado((Integer) p.get("id"), "PUBLICADO", null);
        Map<String, Object> cambio = publicacion("Editable " + w + " rebajado", whatsappNuevo());
        cambio.put("precio", 40000);
        given().contentType(ContentType.JSON).body(cambio).when().put("/api/tianguis/gestion/" + p.get("token"))
                .then().statusCode(200).body("estado", equalTo("PENDIENTE"));
        assertTrue(idsPublicos(w).isEmpty());
    }

    @Test
    void desdeElEnlacePausaReanudaRenuevaYMarcaVendido() {
        String w = palabra();
        Map<String, Object> p = publicado("Gestionable " + w, whatsappNuevo());
        Object token = p.get("token");
        accion(token, "pausar").statusCode(409); // aún pendiente
        estado((Integer) p.get("id"), "PUBLICADO", null);
        accion(token, "pausar").statusCode(200).body("estado", equalTo("PAUSADO")).body("puedeReanudar", equalTo(true));
        assertTrue(idsPublicos(w).isEmpty());
        accion(token, "reanudar").statusCode(200).body("estado", equalTo("PUBLICADO"));
        assertEquals(1, idsPublicos(w).size());
        for (int i = 1; i <= 3; i++) {
            reloj(HOY.plusDays(i));
            accion(token, "renovar").statusCode(200).body("renovaciones", equalTo(i))
                    .body("fechaVencimiento", equalTo(HOY.plusDays(i + 30).toString() + ":00"));
        }
        accion(token, "renovar").statusCode(409).body("mensaje", containsString("3 veces"));
        accion(token, "vendido").statusCode(200).body("estado", equalTo("VENDIDO"));
        given().when().get("/api/tianguis/anuncios/" + p.get("id")).then().statusCode(200).body("estado", equalTo("VENDIDO"));
        given().contentType(ContentType.JSON).body(publicacion("Otra vez", whatsappNuevo()))
                .when().put("/api/tianguis/gestion/" + token).then().statusCode(409);
        accion(token, "inventada").statusCode(404);
    }

    @Test
    void laTareaDeVencimientosYLaRenovacion() {
        String w = palabra();
        Map<String, Object> p = publicado("Vence " + w, whatsappNuevo());
        int id = (Integer) p.get("id");
        estado(id, "PUBLICADO", null);
        reloj(HOY.plusDays(31));
        // Aunque la tarea no haya corrido, ya no se ve.
        assertTrue(idsPublicos(w).isEmpty());
        gestion(p.get("token")).body("estado", equalTo("VENCIDO")).body("puedeRenovar", equalTo(true));
        servicio.vencer();
        como(dueno).when().get("/api/admin/tianguis/anuncios/" + id).then().body("estado", equalTo("VENCIDO"));
        accion(p.get("token"), "renovar").statusCode(200).body("estado", equalTo("PUBLICADO"));
        assertEquals(java.util.List.of(id), idsPublicos(w));
    }

    @Test
    void tresReportesPausanElAnuncio() {
        String w = palabra();
        int id = crearDesdePanel(vehiculo("Reportado " + w, 1, whatsappNuevo()), true);
        String url = "/api/tianguis/anuncios/" + id + "/reportes";
        given().contentType(ContentType.JSON).header("X-Forwarded-For", "10.1.0.1").body(Map.of("motivo", "INVENTADO"))
                .when().post(url).then().statusCode(400);
        for (int i = 1; i <= 2; i++) {
            given().contentType(ContentType.JSON).header("X-Forwarded-For", "10.1.0." + i)
                    .body(Map.of("motivo", "FRAUDE", "comentario", "Pide anticipo")).when().post(url).then().statusCode(201);
        }
        // La misma IP no reporta dos veces el mismo anuncio.
        given().contentType(ContentType.JSON).header("X-Forwarded-For", "10.1.0.1").body(Map.of("motivo", "OTRO"))
                .when().post(url).then().statusCode(429);
        assertEquals(1, idsPublicos(w).size());
        given().contentType(ContentType.JSON).header("X-Forwarded-For", "10.1.0.3").body(Map.of("motivo", "VENDIDO"))
                .when().post(url).then().statusCode(201);
        assertTrue(idsPublicos(w).isEmpty());
        como(dueno).when().get("/api/admin/tianguis/anuncios/" + id).then()
                .body("estado", equalTo("PAUSADO")).body("pausadoPor", equalTo("REPORTES")).body("reportesSinAtender", equalTo(3));
        como(dueno).when().get("/api/admin/tianguis/reportes").then().body("anuncioId", hasItem(id))
                .body("find { it.anuncioId == " + id + " }.motivoTexto", equalTo("Fraude o estafa"));
        // Al revisarlo y publicarlo de nuevo, los reportes quedan atendidos.
        estado(id, "PUBLICADO", null);
        como(dueno).when().get("/api/admin/tianguis/anuncios/" + id).then().body("reportesSinAtender", equalTo(0));
    }

    @Test
    void elHoneypotYLasReglasBloqueanEnvios() {
        Map<String, Object> m = publicacion("Spam " + palabra(), whatsappNuevo());
        m.put("sitioWeb", "http://spam.example");
        publicar(m, "10.2.0.1").statusCode(400);
        m.put("sitioWeb", null);
        m.put("aceptaReglas", false);
        publicar(m, "10.2.0.1").statusCode(400).body("mensaje", containsString("reglas"));
        m.put("aceptaReglas", true);
        m.put("vendedorWhatsapp", "12345");
        publicar(m, "10.2.0.1").statusCode(400).body("mensaje", containsString("10 dígitos"));
    }

    @Test
    void losLimitesPorIpYPorWhatsappFrenanAbusos() {
        limites.publicarPorIp = new LimiteVentana(2, Duration.ofDays(1));
        publicar(publicacion("Ip uno " + palabra(), whatsappNuevo()), "10.3.0.9").statusCode(201);
        publicar(publicacion("Ip dos " + palabra(), whatsappNuevo()), "10.3.0.9").statusCode(201);
        publicar(publicacion("Ip tres " + palabra(), whatsappNuevo()), "10.3.0.9").statusCode(429);

        limites.publicarPorIp = new LimiteVentana(1000, Duration.ofDays(1));
        limites.porWhatsappAlDia = 3;
        String tel = whatsappNuevo();
        for (int i = 0; i < 3; i++) {
            publicar(publicacion("Mismo tel " + i + " " + palabra(), tel), "10.4.0." + i).statusCode(201);
        }
        publicar(publicacion("Mismo tel cuarto " + palabra(), tel), "10.4.0.9").statusCode(429)
                .body("mensaje", containsString("hoy"));
        // Al otro día puede publicar, pero no más de los activos permitidos.
        reloj(HOY.plusDays(2));
        limites.activosPorVendedor = 3;
        publicar(publicacion("Mismo tel activos " + palabra(), tel), "10.4.0.10").statusCode(429)
                .body("mensaje", containsString("activos"));
    }

    @Test
    void bloquearAUnVendedorPausaSusAnunciosYNoLoDejaPublicar() {
        String w = palabra();
        String tel = whatsappNuevo();
        Map<String, Object> p = publicado("Bloqueable " + w, tel);
        int id = (Integer) p.get("id");
        estado(id, "PUBLICADO", null);
        int vendedor = como(dueno).when().get("/api/admin/tianguis/anuncios/" + id).then().extract().path("vendedor.id");
        como(dueno).body(Map.of("valor", true)).when().put("/api/admin/tianguis/vendedores/" + vendedor + "/bloqueado")
                .then().statusCode(200).body("bloqueado", equalTo(true));
        assertTrue(idsPublicos(w).isEmpty());
        gestion(p.get("token")).body("estado", equalTo("PAUSADO")).body("vendedorBloqueado", equalTo(true))
                .body("puedeEditar", equalTo(false));
        publicar(publicacion("Otro " + w, tel), "10.5.0.1").statusCode(403);
        como(dueno).body(Map.of("estado", "PUBLICADO")).when().patch("/api/admin/tianguis/anuncios/" + id + "/estado")
                .then().statusCode(409);
        como(dueno).body(Map.of("valor", false)).when().put("/api/admin/tianguis/vendedores/" + vendedor + "/bloqueado")
                .then().statusCode(200);
        // Al desbloquearlo, sus anuncios vuelven a revisión.
        gestion(p.get("token")).body("estado", equalTo("PENDIENTE"));
    }

    @Test
    void lasFotosSinCuentaPidenPermisoConTipoYTamanoExactos() {
        given().contentType(ContentType.JSON).header("X-Forwarded-For", "10.6.0.1").body(Map.of("tipo", "image/webp", "bytes", 250000))
                .when().post("/api/tianguis/fotos").then().statusCode(200)
                .body("url", containsString("/negocios/tianguis/")).body("subirUrl", containsString("X-Amz-Signature"));
        given().contentType(ContentType.JSON).header("X-Forwarded-For", "10.6.0.1").body(Map.of("tipo", "image/gif", "bytes", 1000))
                .when().post("/api/tianguis/fotos").then().statusCode(400);
        given().contentType(ContentType.JSON).header("X-Forwarded-For", "10.6.0.1").body(Map.of("tipo", "image/jpeg", "bytes", 9_000_000))
                .when().post("/api/tianguis/fotos").then().statusCode(400);
        limites.fotosPorIp = new LimiteVentana(1, Duration.ofHours(1));
        given().contentType(ContentType.JSON).header("X-Forwarded-For", "10.6.0.2").body(Map.of("tipo", "image/webp", "bytes", 1000))
                .when().post("/api/tianguis/fotos").then().statusCode(200);
        given().contentType(ContentType.JSON).header("X-Forwarded-For", "10.6.0.2").body(Map.of("tipo", "image/webp", "bytes", 1000))
                .when().post("/api/tianguis/fotos").then().statusCode(429);
        limites.fotosPorIp = new LimiteVentana(40, Duration.ofHours(1));
    }

    @Test
    void laMismaCuentaDeWhatsappReusaAlVendedor() {
        String tel = whatsappNuevo();
        Map<String, Object> a = publicado("Primero " + palabra(), tel);
        Map<String, Object> b = publicado("Segundo " + palabra(), "52" + tel);
        int va = como(dueno).when().get("/api/admin/tianguis/anuncios/" + a.get("id")).then().extract().path("vendedor.id");
        int vb = como(dueno).when().get("/api/admin/tianguis/anuncios/" + b.get("id")).then().extract().path("vendedor.id");
        assertEquals(va, vb);
    }
}
