package mx.turamohoy.clientes;

import io.restassured.http.ContentType;

import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

import static io.restassured.RestAssured.given;

/** Crea clientes de prueba con teléfonos únicos y devuelve su token. */
public final class Clientes {

    private static final AtomicInteger SIGUIENTE = new AtomicInteger((int) (System.nanoTime() % 100000));

    private Clientes() {
    }

    public static String telefonoNuevo() {
        return "55" + String.format("%08d", SIGUIENTE.incrementAndGet() % 100_000_000);
    }

    /** Registra una cuenta y devuelve el token. */
    public static String nuevo(String nombre) {
        return registrar(nombre, telefonoNuevo(), "clave-cliente-1");
    }

    public static String registrar(String nombre, String telefono, String contrasena) {
        return given().contentType(ContentType.JSON)
                .body(Map.of("nombre", nombre, "telefono", telefono, "contrasena", contrasena,
                        "aceptaPrivacidad", true))
                .when().post("/api/clientes/registro")
                .then().statusCode(201)
                .extract().path("token");
    }
}
