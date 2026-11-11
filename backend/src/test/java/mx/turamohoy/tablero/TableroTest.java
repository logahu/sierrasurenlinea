package mx.turamohoy.tablero;

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
import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.greaterThanOrEqualTo;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasSize;

@QuarkusTest
class TableroTest {

    private static RequestSpecification como(String token) {
        return given().auth().oauth2(token).contentType(ContentType.JSON);
    }

    private static void visitar(String ruta) {
        given().contentType(ContentType.JSON).body(Map.of("ruta", ruta, "contar", true))
                .when().post("/api/visitas").then().statusCode(200);
    }

    @Test
    void muestraVisitasYPedidosDelPeriodo() {
        int producto = given().when().get("/api/negocios/turamohoy/productos").then().extract().path("[0].id");
        visitar("/turamohoy");
        visitar("/turamohoy/producto/" + producto);
        visitar("/turamohoy/producto/" + producto);
        String cliente = Clientes.nuevo("Tablero");
        como(cliente).body(Map.of("negocio", "turamohoy", "lineas", List.of(Map.of("productoId", producto, "cantidad", 1)),
                        "entrega", "RECOGER", "mensaje", "Hola"))
                .when().post("/api/pedidos/carrito").then().statusCode(201);

        String dueno = Sesiones.dueno();
        como(dueno).when().get("/api/admin/tablero").then().statusCode(200)
                .body("dias", equalTo(30))
                .body("serie", hasSize(30))
                .body("visitas", greaterThanOrEqualTo(3))
                .body("pedidos", greaterThanOrEqualTo(1))
                .body("serie[29].visitas", greaterThanOrEqualTo(3))
                .body("negocios.find { it.slug == 'turamohoy' }.visitas", greaterThanOrEqualTo(3))
                .body("negocios.find { it.slug == 'turamohoy' }.pedidos", greaterThanOrEqualTo(1))
                .body("productos.id", hasItem(producto));
        como(dueno).when().get("/api/admin/tablero?dias=7&negocio=belleza").then().statusCode(200)
                .body("serie", hasSize(7))
                .body("negocios.slug", everyItem(equalTo("belleza")));
    }

    @Test
    void elEncargadoVeSoloSuNegocio() {
        String dueno = Sesiones.dueno();
        int id = como(dueno).body(Map.of("nombre", "Encargada tablero", "correo", "tablero@sierrasur.local",
                        "contrasena", "clave-segura-1", "negocioSlug", "belleza"))
                .when().post("/api/admin/usuarios").then().statusCode(201).extract().path("id");
        try {
            String encargada = Sesiones.entrar("tablero@sierrasur.local", "clave-segura-1");
            como(encargada).when().get("/api/admin/tablero?negocio=turamohoy").then().statusCode(200)
                    .body("negocios.slug", everyItem(equalTo("belleza")))
                    .body("productos.negocioSlug", everyItem(equalTo("belleza")));
            como(Clientes.nuevo("Curioso tablero")).when().get("/api/admin/tablero").then().statusCode(403);
        } finally {
            como(dueno).body(Map.of("nombre", "Encargada tablero", "activo", false))
                    .when().put("/api/admin/usuarios/" + id).then().statusCode(200);
        }
    }
}
