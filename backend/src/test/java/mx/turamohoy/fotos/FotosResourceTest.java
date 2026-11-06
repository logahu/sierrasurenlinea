package mx.turamohoy.fotos;

import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import io.restassured.specification.RequestSpecification;
import mx.turamohoy.admin.Sesiones;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.matchesPattern;
import static org.hamcrest.Matchers.startsWith;

@QuarkusTest
class FotosResourceTest {

    private static RequestSpecification como(String token) {
        return given().auth().oauth2(token).contentType(ContentType.JSON);
    }

    @Test
    void daPermisoParaSubirUnaFotoDelNegocio() {
        como(Sesiones.dueno()).body(Map.of("tipo", "image/webp", "bytes", 98_000))
                .when().post("/api/admin/negocios/turamohoy/fotos")
                .then().statusCode(200)
                .body("subirUrl", startsWith("https://cuentaprueba.r2.cloudflarestorage.com/fotos-prueba/negocios/turamohoy/"))
                .body("subirUrl", containsString("X-Amz-SignedHeaders=content-length%3Bcontent-type%3Bhost"))
                .body("url", matchesPattern("https://fotos\\.ejemplo\\.mx/negocios/turamohoy/[0-9a-f-]{36}\\.webp"));
    }

    @Test
    void rechazaTiposYTamanosNoPermitidos() {
        String dueno = Sesiones.dueno();
        como(dueno).body(Map.of("tipo", "image/gif", "bytes", 1000))
                .when().post("/api/admin/negocios/turamohoy/fotos").then().statusCode(400);
        como(dueno).body(Map.of("tipo", "image/webp", "bytes", 5_000_000))
                .when().post("/api/admin/negocios/turamohoy/fotos").then().statusCode(400);
        given().contentType(ContentType.JSON).body(Map.of("tipo", "image/webp", "bytes", 1000))
                .when().post("/api/admin/negocios/turamohoy/fotos").then().statusCode(401);
    }

    @Test
    void soloSeAsignanFotosSubidasParaEseNegocio() {
        String dueno = Sesiones.dueno();
        String url = como(dueno).body(Map.of("tipo", "image/jpeg", "bytes", 50_000))
                .when().post("/api/admin/negocios/belleza/fotos")
                .then().statusCode(200).extract().path("url");

        @SuppressWarnings("unchecked")
        Map<String, Object> negocio = new HashMap<>(como(dueno).when().get("/api/admin/negocios/belleza")
                .then().statusCode(200).extract().as(Map.class));
        Object original = negocio.get("portadaUrl");
        try {
            negocio.put("portadaUrl", url);
            como(dueno).body(negocio).when().put("/api/admin/negocios/belleza")
                    .then().statusCode(200).body("portadaUrl", equalTo(url));

            // Una foto de otro negocio o de otro sitio no se acepta.
            negocio.put("portadaUrl", url.replace("/belleza/", "/vinateria/"));
            como(dueno).body(negocio).when().put("/api/admin/negocios/belleza").then().statusCode(400);
            negocio.put("portadaUrl", "https://otro-sitio.com/foto.jpg");
            como(dueno).body(negocio).when().put("/api/admin/negocios/belleza").then().statusCode(400);
        } finally {
            negocio.put("portadaUrl", original);
            como(dueno).body(negocio).when().put("/api/admin/negocios/belleza").then().statusCode(200);
        }
    }
}
