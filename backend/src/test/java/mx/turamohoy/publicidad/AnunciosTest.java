package mx.turamohoy.publicidad;

import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import io.restassured.path.json.JsonPath;
import io.restassured.specification.RequestSpecification;
import mx.turamohoy.admin.Sesiones;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.nullValue;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;

/** Banners de publicidad: vigencia, posición, permisos, validaciones y clics. */
@QuarkusTest
class AnunciosTest {

    private static final LocalDate HOY = LocalDate.of(2026, 11, 17);
    private final List<Integer> creados = new ArrayList<>();

    private static RequestSpecification como(String token) {
        return given().auth().oauth2(token).contentType(ContentType.JSON);
    }

    @BeforeEach
    void martesDiecisiete() {
        Anuncio.reloj = Clock.fixed(HOY.atTime(12, 0).atZone(mx.turamohoy.agenda.Agenda.ZONA).toInstant(),
                mx.turamohoy.agenda.Agenda.ZONA);
    }

    @AfterEach
    void pausarLosCreados() {
        Anuncio.reloj = Clock.system(mx.turamohoy.agenda.Agenda.ZONA);
        String dueno = Sesiones.dueno();
        for (Integer id : creados) {
            como(dueno).body(Map.of("activo", false)).when().put("/api/admin/anuncios/" + id + "/activo")
                    .then().statusCode(200);
        }
    }

    private static Map<String, Object> anuncio(String titulo, String posicion, Object... extra) {
        Map<String, Object> m = new HashMap<>();
        m.put("titulo", titulo);
        m.put("texto", "Texto de " + titulo);
        m.put("imagenUrl", "img/anuncio-prueba.jpg");
        m.put("enlace", "/turamohoy");
        m.put("posicion", posicion);
        for (int i = 0; i < extra.length; i += 2) {
            m.put((String) extra[i], extra[i + 1]);
        }
        return m;
    }

    private int crear(String dueno, Map<String, Object> datos) {
        int id = como(dueno).body(datos).when().post("/api/admin/anuncios")
                .then().statusCode(201).body("titulo", equalTo(datos.get("titulo"))).extract().path("id");
        creados.add(id);
        return id;
    }

    @Test
    void soloSeVenLosActivosDentroDeSusFechasYEnSuPosicion() {
        String dueno = Sesiones.dueno();
        crear(dueno, anuncio("Vigente arriba", "PORTADA_ARRIBA", "inicio", HOY.toString(), "fin", HOY.toString()));
        crear(dueno, anuncio("Ya terminó", "PORTADA_ARRIBA", "fin", HOY.minusDays(1).toString()));
        crear(dueno, anuncio("Aún no empieza", "PORTADA_ARRIBA", "inicio", HOY.plusDays(1).toString()));
        crear(dueno, anuncio("Patrocinio inflables", "DIRECTORIO", "negocioSlug", "inflables", "colorFondo", "#1E2A5A"));
        int pausado = crear(dueno, anuncio("Pausado", "PORTADA_ARRIBA", "activo", false));

        given().when().get("/api/anuncios?posicion=PORTADA_ARRIBA").then().statusCode(200)
                .body("titulo", hasItem("Vigente arriba"))
                .body("titulo", not(hasItem("Ya terminó")))
                .body("titulo", not(hasItem("Aún no empieza")))
                .body("titulo", not(hasItem("Pausado")))
                .body("titulo", not(hasItem("Patrocinio inflables")))
                // Lo público no trae fechas ni estado.
                .body("find { it.titulo == 'Vigente arriba' }.inicio", equalTo(null))
                .body("find { it.titulo == 'Vigente arriba' }.enlace", equalTo("/turamohoy"));
        given().when().get("/api/anuncios?posicion=directorio").then().statusCode(200)
                .body("titulo", hasItem("Patrocinio inflables"))
                .body("find { it.titulo == 'Patrocinio inflables' }.colorFondo", equalTo("#1e2a5a"));
        // Ya no existe «entre calles».
        given().when().get("/api/anuncios?posicion=ENTRE_CALLES").then().statusCode(200).body("size()", equalTo(0));

        // Reactivado, aparece.
        como(dueno).body(Map.of("activo", true)).when().put("/api/admin/anuncios/" + pausado + "/activo")
                .then().statusCode(200).body("vigente", equalTo(true));
        given().when().get("/api/anuncios?posicion=PORTADA_ARRIBA").then().body("titulo", hasItem("Pausado"));

        // El panel los lista todos, con si se ven hoy.
        como(dueno).when().get("/api/admin/anuncios").then().statusCode(200)
                .body("find { it.titulo == 'Ya terminó' }.vigente", equalTo(false))
                .body("find { it.titulo == 'Vigente arriba' }.vigente", equalTo(true));
    }

    @Test
    void siElNegocioAnunciadoNoSeVeTampocoSuAnuncio() {
        String dueno = Sesiones.dueno();
        crear(dueno, anuncio("Promo vinatería", "PORTADA_ARRIBA", "negocioSlug", "vinateria", "enlace", "/vinateria"));
        given().when().get("/api/anuncios").then().body("titulo", hasItem("Promo vinatería"))
                .body("find { it.titulo == 'Promo vinatería' }.negocioSlug", equalTo("vinateria"));
        try {
            como(dueno).body(Map.of("estado", "OCULTO")).when().put("/api/admin/negocios/vinateria/estado")
                    .then().statusCode(200);
            given().when().get("/api/anuncios").then().body("titulo", not(hasItem("Promo vinatería")));
        } finally {
            como(dueno).body(Map.of("estado", "PUBLICO")).when().put("/api/admin/negocios/vinateria/estado")
                    .then().statusCode(200);
        }
    }

    @Test
    void validaEnlaceFechasPosicionImagenYNegocio() {
        String dueno = Sesiones.dueno();
        como(dueno).body(anuncio("Mal enlace", "PORTADA_ARRIBA", "enlace", "javascript:alert(1)"))
                .when().post("/api/admin/anuncios").then().statusCode(400).body("mensaje", containsString("https://"));
        como(dueno).body(anuncio("Otro mal enlace", "PORTADA_ARRIBA", "enlace", "//otro.com"))
                .when().post("/api/admin/anuncios").then().statusCode(400);
        como(dueno).body(anuncio("Fechas al revés", "PORTADA_ARRIBA", "inicio", "2026-12-10", "fin", "2026-12-01"))
                .when().post("/api/admin/anuncios").then().statusCode(400);
        como(dueno).body(anuncio("Sin lugar", "EN_EL_PIE"))
                .when().post("/api/admin/anuncios").then().statusCode(400);
        como(dueno).body(anuncio("Entre calles ya no", "ENTRE_CALLES"))
                .when().post("/api/admin/anuncios").then().statusCode(400);
        como(dueno).body(anuncio("Patrocinio sin negocio", "DIRECTORIO"))
                .when().post("/api/admin/anuncios").then().statusCode(400).body("mensaje", containsString("negocio"));
        como(dueno).body(anuncio("Foto ajena", "PORTADA_ARRIBA", "imagenUrl", "https://otro.com/foto.jpg"))
                .when().post("/api/admin/anuncios").then().statusCode(400);
        como(dueno).body(anuncio("Negocio inventado", "PORTADA_ARRIBA", "negocioSlug", "no-existe"))
                .when().post("/api/admin/anuncios").then().statusCode(400);
        como(dueno).body(anuncio("", "PORTADA_ARRIBA"))
                .when().post("/api/admin/anuncios").then().statusCode(400);
        // Una URL https y la edición sí pasan.
        int id = crear(dueno, anuncio("Enlace externo", "PORTADA_ARRIBA", "enlace", "https://example.com/promo"));
        como(dueno).body(anuncio("Enlace externo editado", "DIRECTORIO", "enlace", "/turamohoy", "negocioSlug", "turamohoy"))
                .when().put("/api/admin/anuncios/" + id).then().statusCode(200)
                .body("titulo", equalTo("Enlace externo editado")).body("posicion", equalTo("DIRECTORIO"));
        como(dueno).body(anuncio("No existe", "PORTADA_ARRIBA")).when().put("/api/admin/anuncios/999999")
                .then().statusCode(404);
    }

    @Test
    void soloElDuenoAdministraLaPublicidad() {
        given().when().get("/api/admin/anuncios").then().statusCode(401);
        given().contentType(ContentType.JSON).body(anuncio("Intruso", "PORTADA_ARRIBA"))
                .when().post("/api/admin/anuncios").then().statusCode(401);
    }

    @Test
    void losClicsSeCuentanConElContadorDeVisitas() {
        String dueno = Sesiones.dueno();
        int id = crear(dueno, anuncio("Con clics", "PORTADA_ARRIBA"));
        for (int i = 0; i < 2; i++) {
            given().contentType(ContentType.JSON).body(Map.of("ruta", "/anuncio/" + id))
                    .when().post("/api/visitas").then().statusCode(200);
        }
        como(dueno).when().get("/api/admin/anuncios").then()
                .body("find { it.id == " + id + " }.clics", equalTo(2));
        // La página de un giro también se cuenta; una ruta inventada no.
        given().contentType(ContentType.JSON).body(Map.of("ruta", "/giro/flores"))
                .when().post("/api/visitas").then().statusCode(200);
        given().contentType(ContentType.JSON).body(Map.of("ruta", "/anuncio/abc"))
                .when().post("/api/visitas").then().statusCode(400);
    }

    @Test
    void losPatrocinadosVanPrimeroEnElDirectorio() {
        String dueno = Sesiones.dueno();
        // Sin patrocinios, el orden de siempre y nadie marcado.
        List<String> antes = given().when().get("/api/negocios").then().statusCode(200)
                .body("patrocinado", not(hasItem(true))).extract().path("slug");

        int vinateria = crear(dueno, anuncio("Patrocinio vinatería", "DIRECTORIO", "negocioSlug", "vinateria", "orden", 2));
        crear(dueno, anuncio("Patrocinio inflables", "DIRECTORIO", "negocioSlug", "inflables", "orden", 1));
        // Vencido: no cuenta.
        crear(dueno, anuncio("Patrocinio vencido", "DIRECTORIO", "negocioSlug", "autos", "fin", HOY.minusDays(1).toString()));

        JsonPath r = given().when().get("/api/negocios").then().statusCode(200).extract().jsonPath();
        List<String> slugs = r.getList("slug");
        assertEquals(List.of("inflables", "vinateria"), slugs.subList(0, 2));
        assertEquals(antes.size(), slugs.size());
        assertTrue(r.getBoolean("find { it.slug == 'inflables' }.patrocinado"));
        assertFalse(r.getBoolean("find { it.slug == 'autos' }.patrocinado"));
        assertFalse(r.getBoolean("find { it.slug == 'turamohoy' }.patrocinado"));
        // El resto conserva su orden.
        assertEquals(antes.stream().filter(x -> !x.equals("inflables") && !x.equals("vinateria")).toList(), slugs.subList(2, slugs.size()));
        // Con filtro de giro también sube.
        given().when().get("/api/negocios?giro=bebidas").then().body("[0].slug", equalTo("vinateria"))
                .body("[0].patrocinado", equalTo(true));

        // Pausado, deja de subir.
        como(dueno).body(Map.of("activo", false)).when().put("/api/admin/anuncios/" + vinateria + "/activo").then().statusCode(200);
        given().when().get("/api/negocios").then().body("[0].slug", equalTo("inflables"))
                .body("find { it.slug == 'vinateria' }.patrocinado", equalTo(false));
    }

    @Test
    void cadaNegocioTraeSuFechaDeAltaYElIconoDeSuGiro() {
        given().when().get("/api/negocios").then().statusCode(200)
                .body("creadoEn", not(hasItem(nullValue())))
                .body("find { it.slug == 'turamohoy' }.giro.icono", equalTo("flor"));
        given().when().get("/api/negocios/turamohoy").then().statusCode(200).body("creadoEn", notNullValue())
                .body("patrocinado", equalTo(false));
    }
}
