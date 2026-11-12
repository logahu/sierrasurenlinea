package mx.turamohoy.admin;

import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import mx.turamohoy.catalogo.model.Negocio;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static io.restassured.RestAssured.given;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

@QuarkusTest
class UsuariosDePruebaTest {

    private static List<Map<String, Object>> crear(String token) {
        return given().auth().oauth2(token).contentType(ContentType.JSON)
                .when().post("/api/admin/pruebas/usuarios")
                .then().statusCode(200)
                .extract().jsonPath().getList("$");
    }

    private static Map<String, Object> fila(List<Map<String, Object>> filas, String nombre) {
        return filas.stream().filter(f -> nombre.equals(f.get("nombre"))).findFirst().orElseThrow();
    }

    @Test
    void creaClientesEncargadosYRepartidoresQueSePuedenDarDeBaja() {
        String token = Sesiones.dueno();
        long negocios = io.quarkus.narayana.jta.QuarkusTransaction.requiringNew().call(Negocio::count);
        try {
            List<Map<String, Object>> filas = crear(token);
            assertEquals(10 + negocios + 8, filas.size());
            assertEquals(10, filas.stream().filter(f -> "Cliente".equals(f.get("tipo"))).count());
            assertEquals(8, filas.stream().filter(f -> "Repartidor".equals(f.get("tipo"))).count());

            // El cliente entra con la contraseña generada y es probador.
            Map<String, Object> cliente = fila(filas, "🧪 PRUEBA Cliente 01");
            assertEquals("5550000001", cliente.get("telefono"));
            String claveCliente = (String) cliente.get("contrasena");
            assertNotNull(claveCliente);
            String tokenCliente = given().contentType(ContentType.JSON)
                    .body(Map.of("telefono", "5550000001", "contrasena", claveCliente))
                    .when().post("/api/clientes/entrar")
                    .then().statusCode(200).extract().path("token");
            given().auth().oauth2(tokenCliente).when().get("/api/clientes/yo")
                    .then().statusCode(200);

            // El repartidor entra al panel con su teléfono.
            Map<String, Object> repartidor = fila(filas, "🧪 PRUEBA Repartidor 01");
            Sesiones.entrar((String) repartidor.get("telefono"), (String) repartidor.get("contrasena"));

            // El negocio con encargado real no se toca.
            assertTrue(filas.stream().anyMatch(f -> "Encargado".equals(f.get("tipo"))
                    && "Omitido: ya tiene encargado".equals(f.get("estado")) && f.get("contrasena") == null));
            assertTrue(filas.stream().anyMatch(f -> "Encargado".equals(f.get("tipo"))
                    && String.valueOf(f.get("nombre")).startsWith("🧪 PRUEBA Encargado ")));

            // Pulsar otra vez no duplica: renueva la contraseña.
            List<Map<String, Object>> otraVez = crear(token);
            assertEquals(filas.size(), otraVez.size());
            Map<String, Object> mismo = fila(otraVez, "🧪 PRUEBA Cliente 01");
            assertEquals("Contraseña nueva", mismo.get("estado"));
            assertNotEquals(claveCliente, mismo.get("contrasena"));
        } finally {
            Map<String, Object> baja = given().auth().oauth2(token).contentType(ContentType.JSON)
                    .when().post("/api/admin/pruebas/baja")
                    .then().statusCode(200).extract().as(Map.class);
            assertEquals(10, ((Number) baja.get("clientes")).intValue());
            assertTrue(((Number) baja.get("usuarios")).intValue() >= 8);
        }

        // Ya sin acceso.
        given().contentType(ContentType.JSON)
                .body(Map.of("correo", "5550000101", "contrasena", "lo-que-sea-123"))
                .when().post("/api/auth/entrar")
                .then().statusCode(401);
    }

    @Test
    void soloElAdministrador() {
        given().contentType(ContentType.JSON).when().post("/api/admin/pruebas/usuarios").then().statusCode(401);
    }
}
