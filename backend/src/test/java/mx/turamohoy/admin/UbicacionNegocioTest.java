package mx.turamohoy.admin;

import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import io.restassured.specification.RequestSpecification;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.nullValue;

@QuarkusTest
class UbicacionNegocioTest {

    private static final String SLUG = "belleza";

    private static RequestSpecification como(String token) {
        return given().auth().oauth2(token).contentType(ContentType.JSON);
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> actual(String token) {
        return new HashMap<>(como(token).when().get("/api/admin/negocios/" + SLUG).then().statusCode(200)
                .extract().as(Map.class));
    }

    @Test
    void conLocalMuestraUbicacionYSoloEnLineaLaOculta() {
        String dueno = Sesiones.dueno();
        Map<String, Object> antes = actual(dueno);
        try {
            Map<String, Object> m = actual(dueno);
            m.put("atencionEnLocal", true);
            m.put("direccion", "Av. Juárez 25");
            m.put("colonia", "Centro");
            m.put("referencias", "Frente al parque");
            m.put("lat", 16.3301);
            m.put("lng", -96.5944);
            como(dueno).body(m).when().put("/api/admin/negocios/" + SLUG).then().statusCode(200)
                    .body("atencionEnLocal", equalTo(true)).body("colonia", equalTo("Centro"));
            Number lat = given().when().get("/api/negocios/" + SLUG).then().statusCode(200)
                    .body("atencionEnLocal", equalTo(true))
                    .body("direccion", equalTo("Av. Juárez 25"))
                    .body("referencias", equalTo("Frente al parque"))
                    .extract().path("lat");
            org.junit.jupiter.api.Assertions.assertEquals(16.3301, lat.doubleValue(), 0.000001);

            // Pin fuera de México: no.
            m.put("lat", 40.0);
            m.put("lng", -3.7);
            como(dueno).body(m).when().put("/api/admin/negocios/" + SLUG).then().statusCode(400);

            // Solo en línea: el panel conserva los datos, el sitio no los muestra.
            m.put("lat", 16.3301);
            m.put("lng", -96.5944);
            m.put("atencionEnLocal", false);
            como(dueno).body(m).when().put("/api/admin/negocios/" + SLUG).then().statusCode(200)
                    .body("direccion", equalTo("Av. Juárez 25"));
            given().when().get("/api/negocios/" + SLUG).then()
                    .body("atencionEnLocal", equalTo(false))
                    .body("direccion", nullValue())
                    .body("lat", nullValue());

            // Sin mandar atencionEnLocal no cambia; quitar el pin con los dos vacíos.
            m.remove("atencionEnLocal");
            m.put("lat", null);
            m.put("lng", null);
            como(dueno).body(m).when().put("/api/admin/negocios/" + SLUG).then().statusCode(200)
                    .body("atencionEnLocal", equalTo(false)).body("lat", nullValue());
        } finally {
            como(dueno).body(antes).when().put("/api/admin/negocios/" + SLUG).then().statusCode(200);
        }
    }
}
