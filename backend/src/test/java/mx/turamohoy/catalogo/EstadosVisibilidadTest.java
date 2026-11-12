package mx.turamohoy.catalogo;

import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import io.restassured.specification.RequestSpecification;
import mx.turamohoy.admin.Sesiones;
import mx.turamohoy.clientes.Clientes;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;

@QuarkusTest
class EstadosVisibilidadTest {

    private static RequestSpecification como(String token) {
        return given().auth().oauth2(token).contentType(ContentType.JSON);
    }

    private static void estado(String dueno, String negocio, String estado) {
        como(dueno).body(Map.of("estado", estado)).when().put("/api/admin/negocios/" + negocio + "/estado")
                .then().statusCode(200).body("estado", equalTo(estado));
    }

    /** Cliente marcado como probador por el administrador. */
    private static String probador(String dueno) {
        String tel = Clientes.telefonoNuevo();
        String token = Clientes.registrar("Probadora", tel, "clave-cliente-1");
        int id = como(dueno).when().get("/api/admin/clientes?q=" + tel).then().extract().path("clientes[0].id");
        como(dueno).body(Map.of("probador", true)).when().put("/api/admin/clientes/" + id + "/probador")
                .then().statusCode(200).body("probador", equalTo(true));
        return token;
    }

    @Test
    void enPruebasSoloLoVenLosProbadores() {
        String dueno = Sesiones.dueno();
        String probador = probador(dueno);
        String cliente = Clientes.nuevo("Cliente normal");
        int producto = given().when().get("/api/negocios/belleza/productos").then().extract().path("[0].id");
        estado(dueno, "belleza", "PRUEBAS");
        try {
            // El público no lo ve (ni sin sesión ni con una cuenta normal).
            given().when().get("/api/negocios").then().body("slug", not(hasItem("belleza")));
            given().when().get("/api/negocios/belleza").then().statusCode(404);
            given().when().get("/api/productos/" + producto).then().statusCode(404);
            como(cliente).when().get("/api/negocios/belleza").then().statusCode(404);
            // El probador sí, y sabe que está en pruebas.
            como(probador).when().get("/api/negocios").then().body("slug", hasItem("belleza"));
            como(probador).when().get("/api/negocios/belleza").then().statusCode(200).body("estado", equalTo("PRUEBAS"));
            como(probador).when().get("/api/negocios/belleza/productos").then().statusCode(200);
            como(probador).when().get("/api/productos/" + producto).then().statusCode(200);

            // Pedidos: el cliente normal no puede; el del probador queda marcado como prueba.
            Map<String, Object> pedido = Map.of("negocio", "belleza",
                    "lineas", List.of(Map.of("productoId", producto, "cantidad", 1)),
                    "entrega", "RECOGER", "mensaje", "Hola");
            como(cliente).body(pedido).when().post("/api/pedidos/carrito").then().statusCode(400);
            int id = como(probador).body(pedido).when().post("/api/pedidos/carrito").then().statusCode(201)
                    .extract().path("id");
            como(dueno).when().get("/api/admin/pedidos").then().body("find { it.id == " + id + " }.prueba", equalTo(true));

            // Oculto: ni el probador lo ve.
            estado(dueno, "belleza", "OCULTO");
            como(probador).when().get("/api/negocios/belleza").then().statusCode(404);
        } finally {
            estado(dueno, "belleza", "PUBLICO");
        }
        given().when().get("/api/negocios/belleza").then().statusCode(200).body("estado", equalTo("PUBLICO"));
        como(dueno).body(Map.of("estado", "RARO")).when().put("/api/admin/negocios/belleza/estado").then().statusCode(400);
    }

    @Test
    void losPedidosDePruebaNoCuentanEnElTablero() {
        String dueno = Sesiones.dueno();
        String probador = probador(dueno);
        int antes = como(dueno).when().get("/api/admin/tablero?dias=7&negocio=autos").then().extract().path("pedidos");
        Object auto = given().when().get("/api/negocios/autos/productos").then().extract().path("[0].id");
        como(probador).body(Map.of("negocio", "autos", "lineas", List.of(Map.of("productoId", auto, "cantidad", 1)),
                        "cuando", "Viernes", "mensaje", "Hola"))
                .when().post("/api/pedidos/carrito").then().statusCode(201);
        como(dueno).when().get("/api/admin/tablero?dias=7&negocio=autos").then().body("pedidos", equalTo(antes));
    }
}
