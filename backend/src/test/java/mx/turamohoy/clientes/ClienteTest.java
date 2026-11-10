package mx.turamohoy.clientes;

import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import mx.turamohoy.admin.Sesiones;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.notNullValue;

@QuarkusTest
class ClienteTest {

    @Test
    void registroEntrarYPerfil() {
        String tel = Clientes.telefonoNuevo();
        // Sin aceptar el aviso de privacidad no hay cuenta.
        given().contentType(ContentType.JSON)
                .body(Map.of("nombre", "Rosa", "telefono", tel, "contrasena", "clave-cliente-1", "aceptaPrivacidad", false))
                .when().post("/api/clientes/registro").then().statusCode(400);

        String token = Clientes.registrar("Rosa", tel, "clave-cliente-1");
        // Mismo teléfono, otra cuenta: no.
        given().contentType(ContentType.JSON)
                .body(Map.of("nombre", "Otra", "telefono", tel, "contrasena", "clave-cliente-1", "aceptaPrivacidad", true))
                .when().post("/api/clientes/registro").then().statusCode(409);

        given().contentType(ContentType.JSON).body(Map.of("telefono", tel, "contrasena", "mala-clave-99"))
                .when().post("/api/clientes/entrar").then().statusCode(401);
        given().contentType(ContentType.JSON).body(Map.of("telefono", tel, "contrasena", "clave-cliente-1"))
                .when().post("/api/clientes/entrar").then().statusCode(200)
                .body("token", notNullValue()).body("cliente.nombre", equalTo("Rosa"));

        Map<String, Object> edicion = new HashMap<>();
        edicion.put("nombre", "Rosa María");
        edicion.put("direccion", "Calle 5 de Mayo 3");
        given().auth().oauth2(token).contentType(ContentType.JSON).body(edicion)
                .when().put("/api/clientes/yo").then().statusCode(200).body("direccion", equalTo("Calle 5 de Mayo 3"));
        given().auth().oauth2(token).when().get("/api/clientes/yo").then().statusCode(200)
                .body("nombre", equalTo("Rosa María")).body("telefono", equalTo(tel));

        // El token del cliente no abre el panel.
        given().auth().oauth2(token).when().get("/api/admin/pedidos").then().statusCode(403);
        given().when().get("/api/clientes/yo").then().statusCode(401);
    }

    @Test
    void elAdministradorVeYDaDeBajaClientes() {
        String tel = Clientes.telefonoNuevo();
        String token = Clientes.registrar("Baja Lógica", tel, "clave-cliente-1");
        String dueno = Sesiones.dueno();
        int id = given().auth().oauth2(dueno).when().get("/api/admin/clientes?q=" + tel)
                .then().statusCode(200).body("telefono", hasItem(tel)).extract().path("[0].id");
        given().auth().oauth2(dueno).contentType(ContentType.JSON).body(Map.of("activo", false))
                .when().put("/api/admin/clientes/" + id + "/activo").then().statusCode(200).body("activo", equalTo(false));
        // Ya no entra, y su sesión deja de servir; el registro se conserva.
        given().auth().oauth2(token).when().get("/api/clientes/yo").then().statusCode(401);
        given().contentType(ContentType.JSON).body(Map.of("telefono", tel, "contrasena", "clave-cliente-1"))
                .when().post("/api/clientes/entrar").then().statusCode(401);
        given().auth().oauth2(dueno).when().get("/api/admin/clientes?q=" + tel).then().body("[0].activo", equalTo(false));
        // Un cliente no ve la lista.
        given().auth().oauth2(Clientes.nuevo("Curioso")).when().get("/api/admin/clientes").then().statusCode(403);
    }
}
