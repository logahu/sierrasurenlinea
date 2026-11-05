package mx.turamohoy.admin;

import io.restassured.http.ContentType;

import java.util.Map;

import static io.restassured.RestAssured.given;

/** Entra al panel desde las pruebas y devuelve el token. */
public final class Sesiones {

    public static final String DUENO = "dueno@sierrasur.local";
    public static final String DUENO_CONTRASENA = "dueno-local-123";

    private Sesiones() {
    }

    public static String dueno() {
        return entrar(DUENO, DUENO_CONTRASENA);
    }

    public static String entrar(String correo, String contrasena) {
        return given().contentType(ContentType.JSON)
                .body(Map.of("correo", correo, "contrasena", contrasena))
                .when().post("/api/auth/entrar")
                .then().statusCode(200)
                .extract().path("token");
    }
}
