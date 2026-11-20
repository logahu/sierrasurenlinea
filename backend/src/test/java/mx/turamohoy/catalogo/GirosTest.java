package mx.turamohoy.catalogo;

import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import io.restassured.specification.RequestSpecification;
import mx.turamohoy.admin.Sesiones;
import mx.turamohoy.clientes.Clientes;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;

/** Portada «calles por giro»: los giros, su conteo y el filtro de negocios por giro. */
@QuarkusTest
class GirosTest {

    private static RequestSpecification como(String token) {
        return given().auth().oauth2(token).contentType(ContentType.JSON);
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> edicion(String slug, Object... cambios) {
        Map<String, Object> m = new HashMap<>(como(Sesiones.dueno()).when().get("/api/admin/negocios/" + slug)
                .then().statusCode(200).extract().as(Map.class));
        for (int i = 0; i < cambios.length; i += 2) {
            m.put((String) cambios[i], cambios[i + 1]);
        }
        return m;
    }

    @Test
    void losGirosVanEnOrdenConCuantosNegociosVisiblesTienen() {
        given().when().get("/api/giros").then().statusCode(200)
                .body("slug", contains("flores", "belleza", "fiestas", "bebidas", "comida", "autos", "servicios", "tianguis"))
                .body("[0].nombre", equalTo("Flores y regalos"))
                .body("[0].icono", equalTo("flor"))
                .body("find { it.slug == 'flores' }.negocios", equalTo(1))
                // Estudio Melgarejo está en pruebas: el público solo cuenta Belleza.
                .body("find { it.slug == 'belleza' }.negocios", equalTo(1))
                .body("find { it.slug == 'comida' }.negocios", equalTo(0))
                // El tianguis nace en pruebas.
                .body("find { it.slug == 'tianguis' }.negocios", equalTo(0));
    }

    @Test
    void cadaNegocioTraeSuGiroYSeFiltraPorGiro() {
        given().when().get("/api/negocios/turamohoy").then().statusCode(200)
                .body("giro.slug", equalTo("flores")).body("giro.nombre", equalTo("Flores y regalos"));
        given().when().get("/api/negocios").then().statusCode(200)
                .body("find { it.slug == 'inflables' }.giro.slug", equalTo("fiestas"))
                .body("find { it.slug == 'vinateria' }.giro.slug", equalTo("bebidas"))
                .body("find { it.slug == 'encarguitos' }.giro.slug", equalTo("servicios"))
                .body("find { it.slug == 'autos' }.giro.slug", equalTo("autos"));
        given().when().get("/api/negocios?giro=belleza").then().statusCode(200)
                .body("slug", contains("belleza"));
        given().when().get("/api/negocios?giro=comida").then().statusCode(200).body("$", empty());
        given().when().get("/api/negocios?giro=no-existe").then().statusCode(200).body("$", empty());
    }

    @Test
    void elDuenoCambiaElGiroDeUnNegocio() {
        String dueno = Sesiones.dueno();
        try {
            como(dueno).body(edicion("inflables", "giro", "comida")).when().put("/api/admin/negocios/inflables")
                    .then().statusCode(200).body("giro", equalTo("comida"));
            given().when().get("/api/negocios?giro=comida").then().body("slug", contains("inflables"));
            given().when().get("/api/negocios?giro=fiestas").then().body("slug", not(hasItem("inflables")));
            como(dueno).body(edicion("inflables", "giro", "no-existe")).when().put("/api/admin/negocios/inflables")
                    .then().statusCode(400);
        } finally {
            como(dueno).body(edicion("inflables", "giro", "fiestas")).when().put("/api/admin/negocios/inflables")
                    .then().statusCode(200).body("giro", equalTo("fiestas"));
        }
    }

    @Test
    void elEncargadoNoPuedeCambiarElGiro() {
        String dueno = Sesiones.dueno();
        int id = como(dueno).body(Map.of("telefono", Clientes.telefonoNuevo(), "nombre", "Encargado autos giro",
                        "correo", "autos-giro@sierrasur.local", "contrasena", "clave-segura-1", "negocioSlug", "autos"))
                .when().post("/api/admin/usuarios").then().statusCode(201).extract().path("id");
        try {
            String encargado = Sesiones.entrar("autos-giro@sierrasur.local", "clave-segura-1");
            como(encargado).body(edicion("autos", "giro", "comida")).when().put("/api/admin/negocios/autos")
                    .then().statusCode(200).body("giro", equalTo("autos"));
        } finally {
            como(dueno).body(Map.of("nombre", "Encargado autos giro", "activo", false))
                    .when().put("/api/admin/usuarios/" + id).then().statusCode(200);
        }
    }
}
