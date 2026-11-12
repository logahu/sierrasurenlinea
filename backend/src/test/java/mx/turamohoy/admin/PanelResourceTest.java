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
                .body(Map.of("telefono", mx.turamohoy.clientes.Clientes.telefonoNuevo(), "nombre", "Encargado " + negocio, "correo", correo,
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
                .body("mensaje", equalTo("Teléfono, correo o contraseña incorrectos."));
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
                .body("$", hasSize(6))
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
            como(token).body(edicion(token, "vinateria", "estado", "OCULTO"))
                    .when().put("/api/admin/negocios/vinateria")
                    .then().statusCode(200).body("visible", equalTo(false)).body("estado", equalTo("OCULTO"));
            given().when().get("/api/negocios").then().statusCode(200)
                    .body("slug", not(hasItem("vinateria")));
            given().when().get("/api/negocios/vinateria").then().statusCode(404);
            given().when().get("/api/productos").then().statusCode(200)
                    .body("negocioSlug", not(hasItem("vinateria")));
        } finally {
            como(token).body(edicion(token, "vinateria", "estado", "PUBLICO"))
                    .when().put("/api/admin/negocios/vinateria")
                    .then().statusCode(200).body("visible", equalTo(true)).body("estado", equalTo("PUBLICO"));
        }
    }

    @Test
    void elEncargadoSoloTocaSuNegocio() {
        String dueno = Sesiones.dueno();
        int id = crearEncargado(dueno, "belleza@sierrasur.local", "belleza");
        try {
            String encargado = Sesiones.entrar("belleza@sierrasur.local", "clave-segura-1");

            como(encargado).when().get("/api/admin/negocios")
                    .then().statusCode(200)
                    .body("$", hasSize(1))
                    .body("[0].slug", equalTo("belleza"))
                    .body("[0].encargado", equalTo("Encargado belleza"));
            como(encargado).when().get("/api/admin/negocios/vinateria").then().statusCode(403);
            como(encargado).body(edicion(dueno, "vinateria", "horario", "nunca"))
                    .when().put("/api/admin/negocios/vinateria").then().statusCode(403);

            // Puede cambiar su horario, pero no el nombre ni ocultar el negocio.
            Map<String, Object> antes = edicion(dueno, "belleza");
            try {
                como(encargado).body(edicion(dueno, "belleza",
                                "horario", "9 a 7", "nombre", "Otro nombre", "visible", false))
                        .when().put("/api/admin/negocios/belleza")
                        .then().statusCode(200)
                        .body("horario", equalTo("9 a 7"))
                        .body("nombre", equalTo(antes.get("nombre")))
                        .body("visible", equalTo(true));
            } finally {
                como(dueno).body(antes).when().put("/api/admin/negocios/belleza").then().statusCode(200);
            }

            como(encargado).when().get("/api/admin/usuarios").then().statusCode(403);
            como(encargado).when().get("/api/visitas").then().statusCode(403);

            // Un encargado por negocio.
            como(dueno).body(Map.of("telefono", mx.turamohoy.clientes.Clientes.telefonoNuevo(), "nombre", "Otra", "correo", "otra@sierrasur.local",
                            "contrasena", "clave-segura-1", "negocioSlug", "belleza"))
                    .when().post("/api/admin/usuarios")
                    .then().statusCode(409)
                    .body("mensaje", containsString("ya tiene encargado"));

            // Al desactivarlo, su sesión deja de servir de inmediato.
            como(dueno).body(Map.of("nombre", "Encargado belleza", "activo", false))
                    .when().put("/api/admin/usuarios/" + id)
                    .then().statusCode(200).body("activo", equalTo(false));
            como(encargado).when().get("/api/admin/negocios").then().statusCode(401);
        } finally {
            como(dueno).body(Map.of("nombre", "Encargado belleza", "activo", false))
                    .when().put("/api/admin/usuarios/" + id).then().statusCode(200);
        }
    }

    @Test
    void reglasDeAltaDeUsuarios() {
        String dueno = Sesiones.dueno();
        como(dueno).body(Map.of("telefono", mx.turamohoy.clientes.Clientes.telefonoNuevo(), "nombre", "Corta", "correo", "corta@sierrasur.local",
                        "contrasena", "corta", "negocioSlug", "turamohoy"))
                .when().post("/api/admin/usuarios")
                .then().statusCode(400)
                .body("mensaje", containsString("al menos 10"));
        como(dueno).body(Map.of("telefono", mx.turamohoy.clientes.Clientes.telefonoNuevo(), "nombre", "Repetido", "correo", Sesiones.DUENO,
                        "contrasena", "clave-segura-1", "negocioSlug", "turamohoy"))
                .when().post("/api/admin/usuarios")
                .then().statusCode(409);
        como(dueno).body(Map.of("telefono", mx.turamohoy.clientes.Clientes.telefonoNuevo(), "nombre", "Sin negocio", "correo", "sin@sierrasur.local",
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

    @Test
    void elDuenoOcultaYMuestraUnNegocioConUnToque() {
        String dueno = Sesiones.dueno();
        try {
            como(dueno).body(Map.of("visible", false)).when().put("/api/admin/negocios/inflables/visible")
                    .then().statusCode(200).body("visible", equalTo(false));
            given().when().get("/api/negocios").then().body("slug", not(hasItem("inflables")));
        } finally {
            como(dueno).body(Map.of("visible", true)).when().put("/api/admin/negocios/inflables/visible")
                    .then().statusCode(200).body("visible", equalTo(true));
        }
        given().when().get("/api/negocios").then().body("slug", hasItem("inflables"));
        given().contentType(ContentType.JSON).body(Map.of("visible", false))
                .when().put("/api/admin/negocios/inflables/visible").then().statusCode(401);
    }

    @Test
    void elEncargadoNoPuedeOcultarSuNegocio() {
        String dueno = Sesiones.dueno();
        int id = crearEncargado(dueno, "vinos@sierrasur.local", "vinateria");
        try {
            como(Sesiones.entrar("vinos@sierrasur.local", "clave-segura-1")).body(Map.of("visible", false))
                    .when().put("/api/admin/negocios/vinateria/visible").then().statusCode(403);
        } finally {
            como(dueno).body(Map.of("nombre", "Encargado vinateria", "activo", false))
                    .when().put("/api/admin/usuarios/" + id).then().statusCode(200);
        }
    }

    @Test
    void laVinateriaNoSeMuestraEnLaAppPeroSiEnLaWeb() {
        given().when().get("/api/negocios/vinateria").then().statusCode(200).body("visibleApp", equalTo(false));
        given().when().get("/api/negocios/turamohoy").then().body("visibleApp", equalTo(true));
        String dueno = Sesiones.dueno();
        try {
            como(dueno).body(Map.of("visible", true)).when().put("/api/admin/negocios/vinateria/visible-app")
                    .then().statusCode(200).body("visibleApp", equalTo(true)).body("visible", equalTo(true));
        } finally {
            como(dueno).body(Map.of("visible", false)).when().put("/api/admin/negocios/vinateria/visible-app")
                    .then().statusCode(200).body("visibleApp", equalTo(false));
        }
    }

    @Test
    void hastaDosAdministradores() {
        String dueno = Sesiones.dueno();
        int id = como(dueno).body(Map.of("telefono", mx.turamohoy.clientes.Clientes.telefonoNuevo(), "nombre", "Segunda admin", "correo", "admin2@sierrasur.local",
                        "contrasena", "clave-segura-1", "rol", Rol.DUENO))
                .when().post("/api/admin/usuarios").then().statusCode(201)
                .body("rol", equalTo(Rol.DUENO)).extract().path("id");
        try {
            // Ya hay dos: no cabe un tercero.
            como(dueno).body(Map.of("telefono", mx.turamohoy.clientes.Clientes.telefonoNuevo(), "nombre", "Tercero", "correo", "admin3@sierrasur.local",
                            "contrasena", "clave-segura-1", "rol", Rol.DUENO))
                    .when().post("/api/admin/usuarios").then().statusCode(409);
            // La segunda entra al panel y administra usuarios.
            String admin2 = Sesiones.entrar("admin2@sierrasur.local", "clave-segura-1");
            como(admin2).when().get("/api/admin/usuarios").then().statusCode(200);
            // Nadie se quita el acceso a sí mismo.
            como(admin2).body(Map.of("nombre", "Segunda admin", "activo", false))
                    .when().put("/api/admin/usuarios/" + id).then().statusCode(409);
        } finally {
            como(dueno).body(Map.of("nombre", "Segunda admin", "activo", false))
                    .when().put("/api/admin/usuarios/" + id).then().statusCode(200).body("activo", equalTo(false));
        }
    }

    @Test
    void elEquipoEntraConSuTelefono() {
        String dueno = Sesiones.dueno();
        String tel = mx.turamohoy.clientes.Clientes.telefonoNuevo();
        // Sin teléfono no se da de alta.
        como(dueno).body(Map.of("nombre", "Sin tel", "contrasena", "clave-segura-1", "rol", "REPARTIDOR"))
                .when().post("/api/admin/usuarios").then().statusCode(400);
        // El correo es opcional.
        int id = como(dueno).body(Map.of("nombre", "Moto por teléfono", "telefono", tel, "contrasena", "clave-segura-1",
                        "rol", "REPARTIDOR"))
                .when().post("/api/admin/usuarios").then().statusCode(201)
                .body("telefono", equalTo(tel)).body("correo", equalTo(null)).extract().path("id");
        try {
            // Mismo teléfono, otra persona: no.
            como(dueno).body(Map.of("nombre", "Copia", "telefono", tel, "contrasena", "clave-segura-1", "rol", "REPARTIDOR"))
                    .when().post("/api/admin/usuarios").then().statusCode(409);
            // Entra al panel con el teléfono, con o sin espacios.
            given().contentType(ContentType.JSON)
                    .body(Map.of("correo", tel.substring(0, 3) + " " + tel.substring(3), "contrasena", "clave-segura-1"))
                    .when().post("/api/auth/entrar").then().statusCode(200).body("usuario.telefono", equalTo(tel));
            // Se le puede cambiar el teléfono y agregar correo.
            String otro = mx.turamohoy.clientes.Clientes.telefonoNuevo();
            como(dueno).body(Map.of("nombre", "Moto por teléfono", "telefono", otro, "correo", "moto-tel@sierrasur.local"))
                    .when().put("/api/admin/usuarios/" + id).then().statusCode(200)
                    .body("telefono", equalTo(otro)).body("correo", equalTo("moto-tel@sierrasur.local"));
            given().contentType(ContentType.JSON).body(Map.of("correo", "moto-tel@sierrasur.local", "contrasena", "clave-segura-1"))
                    .when().post("/api/auth/entrar").then().statusCode(200);
        } finally {
            como(dueno).body(Map.of("nombre", "Moto por teléfono", "activo", false))
                    .when().put("/api/admin/usuarios/" + id).then().statusCode(200);
        }
    }
}
