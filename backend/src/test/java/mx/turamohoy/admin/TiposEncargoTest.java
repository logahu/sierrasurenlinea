package mx.turamohoy.admin;

import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import io.restassured.specification.RequestSpecification;
import mx.turamohoy.catalogo.model.TipoEncargo;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.not;

@QuarkusTest
class TiposEncargoTest {

    private static RequestSpecification como(String token) {
        return given().auth().oauth2(token).contentType(ContentType.JSON);
    }

    @Test
    void elSitioMuestraSoloLasOpcionesVisibles() {
        given().when().get("/api/negocios/encarguitos")
                .then().statusCode(200)
                .body("tiposEncargo", hasSize(4))
                .body("tiposEncargo.titulo", hasItem("Súper o mercado"))
                .body("tiposEncargo.titulo", not(hasItem("Viaje en moto")));
        // Los demás negocios no tienen lista del mandado.
        given().when().get("/api/negocios/turamohoy").then().body("tiposEncargo", hasSize(0));
        // Las tarifas de viaje de ejemplo ya existen.
        given().when().get("/api/negocios/encarguitos/productos?categoria=viajes")
                .then().statusCode(200).body("$", hasSize(3)).body("unidadPrecio", hasItem("por viaje"));
    }

    @Test
    void elDuenoActivaElViajeYEditaLaLista() {
        String dueno = Sesiones.dueno();
        @SuppressWarnings("unchecked")
        Map<String, Object> viaje = new HashMap<>(como(dueno).when().get("/api/admin/negocios/encarguitos/tipos-encargo")
                .then().statusCode(200).body("$", hasSize(5))
                .extract().jsonPath().getMap("find { it.modo == 'VIAJE' }"));
        Object id = viaje.get("id");
        try {
            viaje.put("visible", true);
            viaje.put("manejaDinero", true); // en un viaje no aplica: se ignora
            como(dueno).body(viaje).when().put("/api/admin/negocios/encarguitos/tipos-encargo/" + id)
                    .then().statusCode(200)
                    .body("visible", equalTo(true))
                    .body("manejaDinero", equalTo(false));
            given().when().get("/api/negocios/encarguitos")
                    .then().body("tiposEncargo.titulo", hasItem("Viaje en moto"));

            viaje.put("icono", "cohete");
            como(dueno).body(viaje).when().put("/api/admin/negocios/encarguitos/tipos-encargo/" + id)
                    .then().statusCode(400);
        } finally {
            viaje.put("visible", false);
            viaje.put("icono", "moto");
            como(dueno).body(viaje).when().put("/api/admin/negocios/encarguitos/tipos-encargo/" + id)
                    .then().statusCode(200);
        }
    }

    @Test
    void seAgreganOpcionesNuevas() {
        String dueno = Sesiones.dueno();
        Integer id = null;
        try {
            id = como(dueno).body(Map.of("titulo", "Farmacia", "ayuda", "Medicinas con receta",
                            "etiquetaRecoger", "Qué farmacia (opcional)", "modo", "MANDADO", "icono", "pastilla",
                            "manejaDinero", true))
                    .when().post("/api/admin/negocios/encarguitos/tipos-encargo")
                    .then().statusCode(201).body("orden", equalTo(6)).body("visible", equalTo(true))
                    .extract().path("id");
            given().when().get("/api/negocios/encarguitos").then().body("tiposEncargo.titulo", hasItem("Farmacia"));
        } finally {
            Integer borrar = id;
            if (borrar != null) {
                QuarkusTransaction.requiringNew().run(() -> TipoEncargo.delete("id", borrar.longValue()));
            }
        }
    }

    @Test
    void soloEnNegociosDeServicio() {
        como(Sesiones.dueno()).when().get("/api/admin/negocios/turamohoy/tipos-encargo").then().statusCode(400);
        given().when().get("/api/admin/negocios/encarguitos/tipos-encargo").then().statusCode(401);
    }
}
