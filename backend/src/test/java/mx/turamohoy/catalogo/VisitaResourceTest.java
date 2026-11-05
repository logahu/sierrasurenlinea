package mx.turamohoy.catalogo;

import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasItem;

@QuarkusTest
class VisitaResourceTest {

    private static long visitar(String ruta, Boolean contar) {
        String cuerpo = contar == null
                ? "{\"ruta\":\"" + ruta + "\"}"
                : "{\"ruta\":\"" + ruta + "\",\"contar\":" + contar + "}";
        return given().contentType(ContentType.JSON).body(cuerpo)
                .when().post("/api/visitas")
                .then().statusCode(200)
                .body("ruta", equalTo(ruta))
                .extract().jsonPath().getLong("total");
    }

    @Test
    void laPrimeraVisitaCreaElContadorYLasSiguientesSuman() {
        assertEquals(1, visitar("/cosmeticos/producto/16", null));
        assertEquals(2, visitar("/cosmeticos/producto/16", true));
        assertEquals(3, visitar("/cosmeticos/producto/16", null));
    }

    @Test
    void conContarFalseSoloConsulta() {
        long antes = visitar("/vinateria", true);
        assertEquals(antes, visitar("/vinateria", false));
    }

    @Test
    void unaPaginaSinVisitasDevuelveCero() {
        assertEquals(0, visitar("/inflables/producto/99", false));
    }

    @Test
    void cadaPaginaLlevaSuPropioContador() {
        visitar("/turamohoy", true);
        long portada = visitar("/", true);
        assertEquals(portada, visitar("/", false));
        given().when().get("/api/visitas")
                .then().statusCode(200)
                .body("ruta", hasItem("/turamohoy"))
                .body("ruta", hasItem("/"));
    }

    @Test
    void rechazaRutasQueNoSonDelSitio() {
        for (String mala : new String[]{"", "turamohoy", "/../etc", "/TuRamo", "/a/b", "/x?y=1",
                "/" + "a".repeat(61), "/turamohoy/producto/abc"}) {
            given().contentType(ContentType.JSON).body("{\"ruta\":\"" + mala + "\"}")
                    .when().post("/api/visitas")
                    .then().statusCode(400);
        }
        given().contentType(ContentType.JSON).body("{}")
                .when().post("/api/visitas")
                .then().statusCode(400);
    }

    private static void assertEquals(long esperado, long real) {
        org.junit.jupiter.api.Assertions.assertEquals(esperado, real);
    }
}
