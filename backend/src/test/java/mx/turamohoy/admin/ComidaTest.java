package mx.turamohoy.admin;

import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import io.restassured.specification.RequestSpecification;
import mx.turamohoy.catalogo.model.Platillo;
import mx.turamohoy.catalogo.model.Restaurante;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.not;

@QuarkusTest
class ComidaTest {

    private static RequestSpecification como(String token) {
        return given().auth().oauth2(token).contentType(ContentType.JSON);
    }

    @Test
    void elSitioMuestraLugaresConSuMenu() {
        given().when().get("/api/negocios/encarguitos/restaurantes")
                .then().statusCode(200)
                .body("$", hasSize(2))
                .body("[0].nombre", equalTo("Fonda de ejemplo"))
                .body("[1].platillos.nombre", hasItem("Tlayuda con tasajo"));
        // La opción existe pero está oculta hasta cargar los lugares reales.
        como(Sesiones.dueno()).when().get("/api/admin/negocios/encarguitos/tipos-encargo")
                .then().body("find { it.modo == 'COMIDA' }.visible", equalTo(false))
                .body("find { it.modo == 'COMIDA' }.icono", equalTo("plato"));
    }

    @Test
    void altaDeLugarYPlatillosDesdeElPanel() {
        String dueno = Sesiones.dueno();
        Integer lugar = null;
        try {
            lugar = como(dueno).body(Map.of("nombre", "Tamales Doña Lupe", "horario", "Diario 7:00 – 11:00"))
                    .when().post("/api/admin/negocios/encarguitos/restaurantes")
                    .then().statusCode(201).body("visible", equalTo(true)).extract().path("id");

            // Sin platillos no aparece en el sitio.
            given().when().get("/api/negocios/encarguitos/restaurantes")
                    .then().body("nombre", not(hasItem("Tamales Doña Lupe")));

            Integer platillo = como(dueno).body(Map.of("nombre", "Tamal de mole", "precio", 25))
                    .when().post("/api/admin/negocios/encarguitos/restaurantes/" + lugar + "/platillos")
                    .then().statusCode(201).body("disponible", equalTo(true)).extract().path("id");
            given().when().get("/api/negocios/encarguitos/restaurantes")
                    .then().body("nombre", hasItem("Tamales Doña Lupe"));

            // Agotado: se marca no disponible y el lugar deja de verse (ya no tiene nada).
            Map<String, Object> agotado = new HashMap<>(Map.of("nombre", "Tamal de mole", "precio", 25, "disponible", false));
            como(dueno).body(agotado)
                    .when().put("/api/admin/negocios/encarguitos/restaurantes/" + lugar + "/platillos/" + platillo)
                    .then().statusCode(200).body("disponible", equalTo(false));
            given().when().get("/api/negocios/encarguitos/restaurantes")
                    .then().body("nombre", not(hasItem("Tamales Doña Lupe")));

            como(dueno).body(Map.of("nombre", "Sin precio"))
                    .when().post("/api/admin/negocios/encarguitos/restaurantes/" + lugar + "/platillos")
                    .then().statusCode(400);
            como(dueno).when().get("/api/admin/negocios/turamohoy/restaurantes").then().statusCode(400);
        } finally {
            Integer borrar = lugar;
            if (borrar != null) {
                QuarkusTransaction.requiringNew().run(() -> {
                    Platillo.delete("restaurante.id", borrar.longValue());
                    Restaurante.delete("id", borrar.longValue());
                });
            }
        }
    }
}
