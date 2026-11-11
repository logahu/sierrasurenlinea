package mx.turamohoy.historial;

import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import io.restassured.specification.RequestSpecification;
import mx.turamohoy.admin.Sesiones;
import mx.turamohoy.clientes.Clientes;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.startsWith;

@QuarkusTest
class HistorialTest {

    private static RequestSpecification como(String token) {
        return given().auth().oauth2(token).contentType(ContentType.JSON);
    }

    @Test
    void quedaRegistradoQuienCambioQue() {
        String dueno = Sesiones.dueno();
        int id = como(dueno).when().get("/api/admin/negocios/turamohoy/productos").then().statusCode(200)
                .extract().path("[0].id");
        String nombre = como(dueno).when().get("/api/admin/negocios/turamohoy/productos/" + id).then()
                .extract().path("nombre");
        como(dueno).body(Map.of("disponible", false))
                .when().put("/api/admin/negocios/turamohoy/productos/" + id + "/disponible").then().statusCode(200);
        como(dueno).body(Map.of("disponible", true))
                .when().put("/api/admin/negocios/turamohoy/productos/" + id + "/disponible").then().statusCode(200);

        como(dueno).when().get("/api/admin/historial?entidad=PRODUCTO&id=" + id).then().statusCode(200)
                .body("renglones[0].accion", equalTo("Mostró el producto " + nombre))
                .body("renglones[1].accion", equalTo("Ocultó el producto " + nombre))
                .body("renglones[0].actorTipo", equalTo("USUARIO"))
                .body("renglones[0].negocioSlug", equalTo("turamohoy"));
        // Búsqueda por texto.
        como(dueno).when().get("/api/admin/historial?q=" + nombre.substring(0, 5)).then().statusCode(200)
                .body("renglones.accion", hasItem("Ocultó el producto " + nombre));
    }

    @Test
    void losPedidosYSusCambiosSeRegistran() {
        String cliente = Clientes.nuevo("Historia");
        Object flor = given().when().get("/api/negocios/turamohoy/productos").then().extract().path("[0].id");
        int pedido = como(cliente).body(Map.of("negocio", "turamohoy", "lineas", List.of(Map.of("productoId", flor, "cantidad", 1)),
                        "entrega", "RECOGER", "mensaje", "Hola"))
                .when().post("/api/pedidos/carrito").then().statusCode(201).extract().path("id");
        String dueno = Sesiones.dueno();
        como(dueno).body(Map.of("estado", "ACEPTADO")).when().put("/api/admin/pedidos/" + pedido + "/estado")
                .then().statusCode(200);
        como(dueno).when().get("/api/admin/historial?entidad=PEDIDO&id=" + pedido).then().statusCode(200)
                .body("renglones[0].accion", startsWith("Pedido TUR-"))
                .body("renglones[0].accion", org.hamcrest.Matchers.endsWith("nuevo → aceptado"))
                .body("renglones[1].actorTipo", equalTo("CLIENTE"))
                .body("renglones[1].actorNombre", equalTo("Historia"));
    }

    @Test
    void elEncargadoSoloVeSuNegocioYLosClientesNada() {
        String dueno = Sesiones.dueno();
        int id = como(dueno).body(Map.of("telefono", mx.turamohoy.clientes.Clientes.telefonoNuevo(), "nombre", "Encargada belleza", "correo", "belleza-historial@sierrasur.local",
                        "contrasena", "clave-segura-1", "negocioSlug", "belleza"))
                .when().post("/api/admin/usuarios").then().statusCode(201).extract().path("id");
        try {
            String encargada = Sesiones.entrar("belleza-historial@sierrasur.local", "clave-segura-1");
            como(encargada).when().get("/api/admin/historial").then().statusCode(200)
                    .body("renglones.negocioSlug", everyItem(equalTo("belleza")));
            como(encargada).when().get("/api/admin/historial?negocio=turamohoy").then().statusCode(200)
                    .body("renglones.negocioSlug", everyItem(equalTo("belleza")));
            como(Clientes.nuevo("Curiosa")).when().get("/api/admin/historial").then().statusCode(403);
        } finally {
            como(dueno).body(Map.of("nombre", "Encargada belleza", "activo", false))
                    .when().put("/api/admin/usuarios/" + id).then().statusCode(200);
        }
        // El alta y la baja quedaron en el historial.
        como(dueno).when().get("/api/admin/historial?entidad=USUARIO&id=" + id).then()
                .body("renglones.accion", hasItem("Dio de alta a Encargada belleza como encargado de Belleza"))
                .body("renglones.accion", hasItem("Quitó el acceso a Encargada belleza"));
    }
}
