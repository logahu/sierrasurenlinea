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

    @Test
    void estudioMelgarejoYaTraeSusEnlacesDeGoogleYSuPin() {
        Map<?, ?> n = como(Sesiones.dueno()).when().get("/api/admin/negocios/estudio-melgarejo").then().statusCode(200)
                .body("googleMapsUrl", equalTo("https://maps.app.goo.gl/bpEujxaGgXyRK41H8"))
                .body("googleResenasUrl", equalTo("https://g.page/r/CYv59KJmIXj6EBM/review"))
                .body("atencionEnLocal", equalTo(true))
                .extract().as(Map.class);
        org.junit.jupiter.api.Assertions.assertEquals(16.323368, ((Number) n.get("lat")).doubleValue(), 0.000001);
        org.junit.jupiter.api.Assertions.assertEquals(-96.588286, ((Number) n.get("lng")).doubleValue(), 0.000001);
    }

    @Test
    void losEnlacesDeGoogleSeGuardanSeMuestranYSoloAceptanGoogle() {
        String dueno = Sesiones.dueno();
        Map<String, Object> antes = actual(dueno);
        try {
            Map<String, Object> m = actual(dueno);
            m.put("googleMapsUrl", " https://maps.app.goo.gl/abc123 ");
            m.put("googleResenasUrl", "https://g.page/r/XYZ/review");
            como(dueno).body(m).when().put("/api/admin/negocios/" + SLUG).then().statusCode(200)
                    .body("googleMapsUrl", equalTo("https://maps.app.goo.gl/abc123"))
                    .body("googleResenasUrl", equalTo("https://g.page/r/XYZ/review"));
            // Se muestran aunque el negocio sea solo en línea: son de su perfil, no de su local.
            given().when().get("/api/negocios/" + SLUG).then().statusCode(200)
                    .body("googleMapsUrl", equalTo("https://maps.app.goo.gl/abc123"))
                    .body("googleResenasUrl", equalTo("https://g.page/r/XYZ/review"));

            // Otro sitio o sin https: no.
            for (String malo : new String[] {"https://ejemplo.com/maps", "http://maps.app.goo.gl/abc", "https://goo.gl/xyz", "javascript:alert(1)"}) {
                Map<String, Object> x = new HashMap<>(m);
                x.put("googleMapsUrl", malo);
                como(dueno).body(x).when().put("/api/admin/negocios/" + SLUG).then().statusCode(400);
            }
            // Vacíos los quitan.
            m.put("googleMapsUrl", "");
            m.put("googleResenasUrl", null);
            como(dueno).body(m).when().put("/api/admin/negocios/" + SLUG).then().statusCode(200)
                    .body("googleMapsUrl", nullValue()).body("googleResenasUrl", nullValue());
        } finally {
            como(dueno).body(antes).when().put("/api/admin/negocios/" + SLUG).then().statusCode(200);
        }
    }
}
