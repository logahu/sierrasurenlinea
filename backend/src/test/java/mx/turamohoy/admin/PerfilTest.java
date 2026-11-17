package mx.turamohoy.admin;

import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import io.restassured.specification.RequestSpecification;
import mx.turamohoy.clientes.Clientes;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.nullValue;
import static org.hamcrest.Matchers.startsWith;

/** Mi perfil (equipo del panel) y avatar o foto de perfil (equipo y clientes). */
@QuarkusTest
class PerfilTest {

    private static RequestSpecification como(String token) {
        return given().auth().oauth2(token).contentType(ContentType.JSON);
    }

    private static Map<String, Object> perfil(String nombre, String correo, String avatar) {
        Map<String, Object> m = new HashMap<>();
        m.put("nombre", nombre);
        m.put("correo", correo);
        m.put("avatar", avatar);
        return m;
    }

    @Test
    void unEncargadoEditaSuPerfilYEligeUnDibujo() {
        String dueno = Sesiones.dueno();
        int id = como(dueno).body(Map.of("telefono", Clientes.telefonoNuevo(), "nombre", "Encargado perfil",
                        "correo", "perfil@sierrasur.local", "contrasena", "clave-segura-1", "negocioSlug", "autos"))
                .when().post("/api/admin/usuarios").then().statusCode(201).extract().path("id");
        try {
            String encargado = Sesiones.entrar("perfil@sierrasur.local", "clave-segura-1");
            como(encargado).body(perfil("  Rosa Encargada  ", "rosa.perfil@sierrasur.local", "avatar:colibri"))
                    .when().put("/api/auth/yo").then().statusCode(200)
                    .body("nombre", equalTo("Rosa Encargada"))
                    .body("correo", equalTo("rosa.perfil@sierrasur.local"))
                    .body("avatar", equalTo("avatar:colibri"))
                    // Rol y negocio no cambian.
                    .body("rol", equalTo(Rol.ENCARGADO)).body("negocioSlug", equalTo("autos"));
            como(encargado).when().get("/api/auth/yo").then().body("avatar", equalTo("avatar:colibri"));

            // Correo de otro usuario, dibujo inventado o nombre vacío: no.
            como(encargado).body(perfil("Rosa", Sesiones.DUENO, null)).when().put("/api/auth/yo").then().statusCode(409);
            como(encargado).body(perfil("Rosa", null, "avatar:dragon")).when().put("/api/auth/yo").then().statusCode(400);
            como(encargado).body(perfil(" ", null, null)).when().put("/api/auth/yo").then().statusCode(400);

            // Sin avatar vuelve a las iniciales.
            como(encargado).body(perfil("Rosa Encargada", null, null)).when().put("/api/auth/yo").then().statusCode(200)
                    .body("avatar", nullValue()).body("correo", nullValue());
        } finally {
            como(dueno).body(Map.of("nombre", "Encargado perfil", "activo", false))
                    .when().put("/api/admin/usuarios/" + id).then().statusCode(200);
        }
    }

    @Test
    void laFotoDePerfilSeSubeASuCarpetaYSoloSePuedeUsarLaPropia() {
        String dueno = Sesiones.dueno();
        Map<String, Object> yo = como(dueno).when().get("/api/auth/yo").then().statusCode(200).extract().as(Map.class);
        String nombre = (String) yo.get("nombre");
        Object correo = yo.get("correo");
        int id = ((Number) yo.get("id")).intValue();
        try {
            String url = como(dueno).body(Map.of("tipo", "image/webp", "bytes", 20000)).when().post("/api/auth/yo/foto")
                    .then().statusCode(200)
                    .body("url", startsWith("https://fotos.ejemplo.mx/perfiles/usuarios/" + id + "/"))
                    .body("subirUrl", startsWith("https://cuentaprueba.r2.cloudflarestorage.com/fotos-prueba/perfiles/usuarios/" + id + "/"))
                    .extract().path("url");
            como(dueno).body(perfil(nombre, (String) correo, url)).when().put("/api/auth/yo").then().statusCode(200)
                    .body("avatar", equalTo(url));
            // La carpeta de otra persona, otra web o un tipo no permitido: no.
            como(dueno).body(perfil(nombre, (String) correo,
                            "https://fotos.ejemplo.mx/perfiles/usuarios/999999/00000000-0000-0000-0000-000000000000.webp"))
                    .when().put("/api/auth/yo").then().statusCode(400);
            como(dueno).body(perfil(nombre, (String) correo, "https://otro.com/yo.jpg")).when().put("/api/auth/yo")
                    .then().statusCode(400);
            como(dueno).body(Map.of("tipo", "image/gif", "bytes", 2000)).when().post("/api/auth/yo/foto").then().statusCode(400);
            como(dueno).body(Map.of("tipo", "image/jpeg", "bytes", 5_000_000)).when().post("/api/auth/yo/foto")
                    .then().statusCode(400);
        } finally {
            como(dueno).body(perfil(nombre, (String) correo, null)).when().put("/api/auth/yo").then().statusCode(200);
        }
    }

    @Test
    void elClienteEligeDibujoOFotoDePerfil() {
        String cliente = Clientes.nuevo("Cliente con avatar");
        int id = como(cliente).when().get("/api/clientes/yo").then().statusCode(200).body("avatar", nullValue())
                .extract().path("id");
        como(cliente).body(Map.of("avatar", "avatar:maguey")).when().put("/api/clientes/yo/avatar").then().statusCode(200)
                .body("avatar", equalTo("avatar:maguey"));
        String url = como(cliente).body(Map.of("tipo", "image/jpeg", "bytes", 30000)).when().post("/api/clientes/yo/foto")
                .then().statusCode(200).body("url", startsWith("https://fotos.ejemplo.mx/perfiles/clientes/" + id + "/"))
                .extract().path("url");
        como(cliente).body(Map.of("avatar", url)).when().put("/api/clientes/yo/avatar").then().statusCode(200)
                .body("avatar", equalTo(url));
        // La foto de un usuario del panel no le sirve al cliente.
        como(cliente).body(Map.of("avatar", url.replace("/clientes/" + id + "/", "/usuarios/1/")))
                .when().put("/api/clientes/yo/avatar").then().statusCode(400);
        // Un cliente no entra al perfil del panel.
        como(cliente).body(perfil("X", null, null)).when().put("/api/auth/yo").then().statusCode(401);
        given().contentType(ContentType.JSON).body(Map.of("avatar", "avatar:sol")).when().put("/api/clientes/yo/avatar")
                .then().statusCode(401);
    }
}
