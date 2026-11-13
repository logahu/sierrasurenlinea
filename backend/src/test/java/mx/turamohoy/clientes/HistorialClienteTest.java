package mx.turamohoy.clientes;

import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import io.restassured.path.json.JsonPath;
import io.restassured.specification.RequestSpecification;
import mx.turamohoy.admin.Sesiones;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasItems;
import static org.hamcrest.Matchers.not;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

@QuarkusTest
class HistorialClienteTest {

    private static RequestSpecification como(String token) {
        return given().auth().oauth2(token).contentType(ContentType.JSON);
    }

    private static int pedir(String cliente) {
        Object flor = given().when().get("/api/negocios/turamohoy/productos").then().extract().path("[0].id");
        return como(cliente).body(Map.of("negocio", "turamohoy", "lineas", List.of(Map.of("productoId", flor, "cantidad", 2)),
                        "entrega", "RECOGER", "mensaje", "Hola"))
                .when().post("/api/pedidos/carrito").then().statusCode(201).extract().path("id");
    }

    @Test
    void elClienteVeSusPedidosYSuActividad() {
        String tel = Clientes.telefonoNuevo();
        String cliente = Clientes.registrar("Marta Historial", tel, "clave-cliente-1");
        String dueno = Sesiones.dueno();

        int entregado = pedir(cliente);
        int cancelado = pedir(cliente);
        int enCurso = pedir(cliente);
        como(dueno).body(Map.of("estado", "ACEPTADO")).when().put("/api/admin/pedidos/" + entregado + "/estado").then().statusCode(200);
        como(dueno).body(Map.of("estado", "EN_CAMINO")).when().put("/api/admin/pedidos/" + entregado + "/estado").then().statusCode(200);
        como(dueno).body(Map.of("estado", "ENTREGADO")).when().put("/api/admin/pedidos/" + entregado + "/estado").then().statusCode(200);
        como(dueno).body(Map.of("estado", "CANCELADO")).when().put("/api/admin/pedidos/" + cancelado + "/estado").then().statusCode(200);
        como(dueno).body(Map.of("nueva", "otra-clave-22")).when().put("/api/admin/clientes/" + idDe(dueno, tel) + "/contrasena")
                .then().statusCode(204);
        como(cliente).body(Map.of("nombre", "Marta Historial", "correo", "")).when().put("/api/clientes/yo").then().statusCode(200);

        // Pedidos, con conteos y filtros.
        JsonPath todos = como(cliente).when().get("/api/clientes/historial").then().statusCode(200).extract().jsonPath();
        assertEquals(3, todos.getInt("total"));
        assertEquals(1, todos.getInt("conteos.entregados"));
        assertEquals(1, todos.getInt("conteos.cancelados"));
        assertEquals(1, todos.getInt("conteos.enCurso"));
        assertEquals(enCurso, todos.getInt("pedidos[0].id"));
        assertEquals(2, todos.getInt("pedidos[0].lineas[0].cantidad"));
        assertTrue(todos.getDouble("totalEntregado") > 0);
        como(cliente).when().get("/api/clientes/historial?estado=cancelados").then()
                .body("total", equalTo(1)).body("pedidos[0].id", equalTo(cancelado));
        como(cliente).when().get("/api/clientes/historial?estado=entregados").then()
                .body("pedidos[0].estado", equalTo("ENTREGADO"));

        // Actividad: lo suyo y lo del equipo, sin nombres del equipo.
        JsonPath act = como(cliente).when().get("/api/clientes/actividad").then().statusCode(200).extract().jsonPath();
        List<String> textos = act.getList("eventos.texto");
        assertTrue(textos.contains("Creaste tu cuenta"), textos.toString());
        assertTrue(textos.contains("Actualizaste tus datos"), textos.toString());
        assertTrue(textos.contains("El equipo te asignó una contraseña nueva"), textos.toString());
        assertTrue(textos.stream().anyMatch(t -> t.startsWith("Hiciste el pedido ")), textos.toString());
        assertTrue(textos.stream().anyMatch(t -> t.endsWith("cambió a «listo para recoger»")), textos.toString());
        assertTrue(textos.stream().anyMatch(t -> t.endsWith("cambió a «cancelado»")), textos.toString());
        assertEquals("Actualizaste tus datos", textos.get(0));
        assertTrue(act.getList("eventos.quien").containsAll(List.of("TU", "EQUIPO")));

        // Nadie más ve lo suyo.
        String otro = Clientes.nuevo("Otra Persona");
        como(otro).when().get("/api/clientes/historial").then().body("total", equalTo(0));
        como(otro).when().get("/api/clientes/actividad").then()
                .body("eventos.texto", hasItems("Creaste tu cuenta"))
                .body("eventos.texto", not(hasItem("Actualizaste tus datos")));
        given().when().get("/api/clientes/historial").then().statusCode(401);
    }

    private static Object idDe(String dueno, String tel) {
        return como(dueno).when().get("/api/admin/clientes?q=" + tel).then().extract().path("clientes[0].id");
    }
}
