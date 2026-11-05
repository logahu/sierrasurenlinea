package mx.turamohoy.admin;

import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import io.restassured.specification.RequestSpecification;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.greaterThan;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.notNullValue;

@QuarkusTest
class PanelResourceTest {

    private static RequestSpecification como(String token) {
        return given().auth().oauth2(token).contentType(ContentType.JSON);
    }

    /** Lo que hoy tiene el negocio, con los cambios indicados encima (como hace la pantalla). */
    @SuppressWarnings("unchecked")
    private static Map<String, Object> edicion(String token, String slug, Object... cambios) {
        Map<String, Object> m = new java.util.HashMap<>(como(Sesiones.dueno())
                .when().get("/api/admin/negocios/" + slug)
                .then().statusCode(200).extract().as(Map.class));
        for (int i = 0; i < cambios.length; i += 2) {
            m.put((String) cambios[i], cambios[i + 1]);
        }
        return m;
    }

    private static int crearEncargado(String dueno, String correo, String negocio) {
        return como(dueno)
                .body(Map.of("nombre", "Encargado " + negocio, "correo", correo,
                        "contrasena", "clave-segura-1", "negocioSlug", negocio))
                .when().post("/api/admin/usuarios")
                .then().statusCode(201)
                .body("rol", equalTo(Rol.ENCARGADO))
                .body("negocioSlug", equalTo(negocio))
                .extract().path("id");
    }

    @Test
    void elDuenoEntraYVeSusDatos() {
        String token = Sesiones.dueno();
        como(token).when().get("/api/auth/yo")
                .then().statusCode(200)
                .body("correo", equalTo(Sesiones.DUENO))
                .body("rol", equalTo(Rol.DUENO));
        // El correo no distingue mayúsculas ni espacios.
        Sesiones.entrar("  Dueno@SierraSur.local ", Sesiones.DUENO_CONTRASENA);
    }

    @Test
    void contrasenaIncorrectaNoEntra() {
        given().contentType(ContentType.JSON)
                .body(Map.of("correo", Sesiones.DUENO, "contrasena", "otra-cosa-123"))
                .when().post("/api/auth/entrar")
                .then().statusCode(401)
                .body("mensaje", equalTo("Correo o contraseña incorrectos."));
        given().contentType(ContentType.JSON)
                .body(Map.of("correo", "nadie@sierrasur.local", "contrasena", "otra-cosa-123"))
                .when().post("/api/auth/entrar")
                .then().statusCode(401);
    }

    @Test
    void sinSesionNoHayPanel() {
        given().when().get("/api/admin/negocios").then().statusCode(401);
        given().when().get("/api/admin/usuarios").then().statusCode(401);
        given().auth().oauth2("no.es.token").when().get("/api/admin/negocios").then().statusCode(401);
    }

    @Test
    void elDuenoVeLosCincoNegociosConSusProductos() {
        como(Sesiones.dueno()).when().get("/api/admin/negocios")
                .then().statusCode(200)
                .body("$", hasSize(5))
                .body("slug", hasItem("encarguitos"))
                .body("productosActivos", everyItem(greaterThan(0)));
    }

    @Test
    void elDuenoEditaElContactoYElWhatsappSeNormaliza() {
        String token = Sesiones.dueno();
        Map<String, Object> original = edicion(token, "inflables");
        try {
            como(token).body(edicion(token, "inflables", "whatsapp", "55 1234 5678", "horario", "  Todos los días  "))
                    .when().put("/api/admin/negocios/inflables")
                    .then().statusCode(200)
                    .body("whatsapp", equalTo("525512345678"))
                    .body("horario", equalTo("Todos los días"));
            given().when().get("/api/negocios/inflables")
                    .then().statusCode(200)
                    .body("whatsapp", equalTo("525512345678"));

            como(token).body(edicion(token, "inflables", "whatsapp", "123"))
                    .when().put("/api/admin/negocios/inflables")
                    .then().statusCode(400)
                    .body("mensaje", containsString("10 dígitos"));
        } finally {
            como(token).body(original)
                    .when().put("/api/admin/negocios/inflables")
                    .then().statusCode(200);
        }
    }

    @Test
    void unNegocioOcultoDesapareceDelSitio() {
        String token = Sesiones.dueno();
        try {
            como(token).body(edicion(token, "vinateria", "visible", false))
                    .when().put("/api/admin/negocios/vinateria")
                    .then().statusCode(200).body("visible", equalTo(false));
            given().when().get("/api/negocios").then().statusCode(200)
                    .body("slug", not(hasItem("vinateria")));
            given().when().get("/api/negocios/vinateria").then().statusCode(404);
            given().when().get("/api/productos").then().statusCode(200)
                    .body("negocioSlug", not(hasItem("vinateria")));
        } finally {
            como(token).body(edicion(token, "vinateria", "visible", true))
                    .when().put("/api/admin/negocios/vinateria")
                    .then().statusCode(200).body("visible", equalTo(true));
        }
    }

    @Test
    void elEncargadoSoloTocaSuNegocio() {
        String dueno = Sesiones.dueno();
        int id = crearEncargado(dueno, "cosmeticos@sierrasur.local", "cosmeticos");
        try {
            String encargado = Sesiones.entrar("cosmeticos@sierrasur.local", "clave-segura-1");

            como(encargado).when().get("/api/admin/negocios")
                    .then().statusCode(200)
                    .body("$", hasSize(1))
                    .body("[0].slug", equalTo("cosmeticos"))
                    .body("[0].encargado", equalTo("Encargado cosmeticos"));
            como(encargado).when().get("/api/admin/negocios/vinateria").then().statusCode(403);
            como(encargado).body(edicion(dueno, "vinateria", "horario", "nunca"))
                    .when().put("/api/admin/negocios/vinateria").then().statusCode(403);

            // Puede cambiar su horario, pero no el nombre ni ocultar el negocio.
            Map<String, Object> antes = edicion(dueno, "cosmeticos");
            try {
                como(encargado).body(edicion(dueno, "cosmeticos",
                                "horario", "9 a 7", "nombre", "Otro nombre", "visible", false))
                        .when().put("/api/admin/negocios/cosmeticos")
                        .then().statusCode(200)
                        .body("horario", equalTo("9 a 7"))
                        .body("nombre", equalTo(antes.get("nombre")))
                        .body("visible", equalTo(true));
            } finally {
                como(dueno).body(antes).when().put("/api/admin/negocios/cosmeticos").then().statusCode(200);
            }

            como(encargado).when().get("/api/admin/usuarios").then().statusCode(403);
            como(encargado).when().get("/api/visitas").then().statusCode(403);

            // Un encargado por negocio.
            como(dueno).body(Map.of("nombre", "Otra", "correo", "otra@sierrasur.local",
                            "contrasena", "clave-segura-1", "negocioSlug", "cosmeticos"))
                    .when().post("/api/admin/usuarios")
                    .then().statusCode(409)
                    .body("mensaje", containsString("ya tiene encargado"));

            // Al desactivarlo, su sesión deja de servir de inmediato.
            como(dueno).body(Map.of("nombre", "Encargado cosmeticos", "activo", false))
                    .when().put("/api/admin/usuarios/" + id)
                    .then().statusCode(200).body("activo", equalTo(false));
            como(encargado).when().get("/api/admin/negocios").then().statusCode(401);
        } finally {
            como(dueno).body(Map.of("nombre", "Encargado cosmeticos", "activo", false))
                    .when().put("/api/admin/usuarios/" + id).then().statusCode(200);
        }
    }

    @Test
    void reglasDeAltaDeUsuarios() {
        String dueno = Sesiones.dueno();
        como(dueno).body(Map.of("nombre", "Corta", "correo", "corta@sierrasur.local",
                        "contrasena", "corta", "negocioSlug", "turamohoy"))
                .when().post("/api/admin/usuarios")
                .then().statusCode(400)
                .body("mensaje", containsString("al menos 10"));
        como(dueno).body(Map.of("nombre", "Repetido", "correo", Sesiones.DUENO,
                        "contrasena", "clave-segura-1", "negocioSlug", "turamohoy"))
                .when().post("/api/admin/usuarios")
                .then().statusCode(409);
        como(dueno).body(Map.of("nombre", "Sin negocio", "correo", "sin@sierrasur.local",
                        "contrasena", "clave-segura-1", "negocioSlug", "no-existe"))
                .when().post("/api/admin/usuarios")
                .then().statusCode(400);
        como(dueno).when().get("/api/admin/usuarios")
                .then().statusCode(200)
                .body("correo", hasItem(Sesiones.DUENO))
                .body("[0].contrasenaHash", equalTo(null));
    }

    @Test
    void cincoIntentosFallidosBloqueanLaCuenta() {
        String dueno = Sesiones.dueno();
        int id = crearEncargado(dueno, "encarguitos@sierrasur.local", "encarguitos");
        try {
            for (int i = 0; i < 4; i++) {
                given().contentType(ContentType.JSON)
                        .body(Map.of("correo", "encarguitos@sierrasur.local", "contrasena", "equivocada-123"))
                        .when().post("/api/auth/entrar").then().statusCode(401);
            }
            given().contentType(ContentType.JSON)
                    .body(Map.of("correo", "encarguitos@sierrasur.local", "contrasena", "equivocada-123"))
                    .when().post("/api/auth/entrar").then().statusCode(429);
            // Ni con la contraseña correcta entra mientras dura el bloqueo.
            given().contentType(ContentType.JSON)
                    .body(Map.of("correo", "encarguitos@sierrasur.local", "contrasena", "clave-segura-1"))
                    .when().post("/api/auth/entrar").then().statusCode(429)
                    .body("mensaje", containsString("15 minutos"));

            // El dueño le pone contraseña nueva y eso quita el bloqueo.
            como(dueno).body(Map.of("nueva", "clave-nueva-22"))
                    .when().put("/api/admin/usuarios/" + id + "/contrasena").then().statusCode(204);
            org.junit.jupiter.api.Assertions.assertNotNull(
                    Sesiones.entrar("encarguitos@sierrasur.local", "clave-nueva-22"));
        } finally {
            como(dueno).body(Map.of("nombre", "Encargado encarguitos", "activo", false))
                    .when().put("/api/admin/usuarios/" + id).then().statusCode(200);
        }
    }

    @Test
    void cadaQuienCambiaSuContrasena() {
        String dueno = Sesiones.dueno();
        int id = crearEncargado(dueno, "flores@sierrasur.local", "turamohoy");
        try {
            String token = Sesiones.entrar("flores@sierrasur.local", "clave-segura-1");
            como(token).body(Map.of("actual", "no-es-esta-123", "nueva", "otra-clave-33"))
                    .when().put("/api/auth/contrasena").then().statusCode(400);
            como(token).body(Map.of("actual", "clave-segura-1", "nueva", "otra-clave-33"))
                    .when().put("/api/auth/contrasena").then().statusCode(204);
            org.hamcrest.MatcherAssert.assertThat(
                    Sesiones.entrar("flores@sierrasur.local", "otra-clave-33"), notNullValue());
        } finally {
            como(dueno).body(Map.of("nombre", "Encargado turamohoy", "activo", false))
                    .when().put("/api/admin/usuarios/" + id).then().statusCode(200);
        }
    }
}
