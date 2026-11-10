package mx.turamohoy.pedidos;

import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import io.restassured.specification.RequestSpecification;
import mx.turamohoy.admin.Sesiones;
import mx.turamohoy.clientes.Clientes;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.matchesPattern;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.startsWith;
import static org.junit.jupiter.api.Assertions.assertEquals;

@QuarkusTest
class CarritoTest {

    private static RequestSpecification como(String token) {
        return given().auth().oauth2(token).contentType(ContentType.JSON);
    }

    /** Ids y precios del catálogo público de un negocio. */
    private static List<Map<String, Object>> productos(String negocio) {
        return given().when().get("/api/negocios/" + negocio + "/productos").then().statusCode(200)
                .extract().jsonPath().getList("$");
    }

    private static Map<String, Object> pedido(String negocio, List<Map<String, Object>> lineas) {
        Map<String, Object> m = new HashMap<>();
        m.put("negocio", negocio);
        m.put("lineas", lineas);
        m.put("entrega", "DOMICILIO");
        m.put("entregar", "Calle Hidalgo 4, casa azul");
        m.put("mensaje", "Hola, quiero hacer un pedido");
        return m;
    }

    private static Map<String, Object> linea(Object id, int cantidad) {
        return Map.of("productoId", id, "cantidad", cantidad);
    }

    @Test
    void compraConCarritoCalculaElTotalConLosPreciosDelCatalogo() {
        var flores = productos("turamohoy");
        Object a = flores.get(0).get("id");
        Object b = flores.get(1).get("id");
        double esperado = ((Number) flores.get(0).get("precio")).doubleValue() * 2
                + ((Number) flores.get(1).get("precio")).doubleValue();

        String cliente = Clientes.nuevo("Marta Carrito");
        // Sin cuenta, no.
        given().contentType(ContentType.JSON).body(pedido("turamohoy", List.of(linea(a, 1))))
                .when().post("/api/pedidos/carrito").then().statusCode(401);

        Map<String, Object> body = pedido("turamohoy", List.of(linea(a, 1), linea(b, 1), linea(a, 1)));
        body.put("cuando", "Sábado a las 10");
        body.put("notas", "Con tarjeta: Feliz cumpleaños");
        int id = como(cliente).body(body).when().post("/api/pedidos/carrito").then().statusCode(201)
                .body("folio", matchesPattern("TUR-\\d{5}"))
                .extract().path("id");

        String dueno = Sesiones.dueno();
        var p = como(dueno).when().get("/api/admin/pedidos").then().statusCode(200)
                .extract().jsonPath().getMap("find { it.id == " + id + " }");
        assertEquals("COMPRA", p.get("modo"));
        assertEquals("DOMICILIO", p.get("entrega"));
        assertEquals("Sábado a las 10", p.get("cuando"));
        assertEquals("Con tarjeta: Feliz cumpleaños", p.get("notas"));
        assertEquals(esperado, ((Number) p.get("totalEstimado")).doubleValue(), 0.001);
        // Los repetidos se suman en un renglón.
        como(dueno).when().get("/api/admin/pedidos").then()
                .body("find { it.id == " + id + " }.lineas", hasSize(2))
                .body("find { it.id == " + id + " }.lineas[0].cantidad", equalTo(2));
        // Aparece en "mis pedidos" del cliente.
        como(cliente).when().get("/api/clientes/pedidos").then().body("id", hasItem(id))
                .body("find { it.id == " + id + " }.modo", equalTo("COMPRA"));
    }

    @Test
    void validaElCarrito() {
        String cliente = Clientes.nuevo("Validaciones");
        Object flor = productos("turamohoy").get(0).get("id");
        Object inflable = productos("inflables").get(0).get("id");
        // Producto de otro negocio.
        como(cliente).body(pedido("turamohoy", List.of(linea(inflable, 1))))
                .when().post("/api/pedidos/carrito").then().statusCode(409);
        // Vacío.
        como(cliente).body(pedido("turamohoy", List.of())).when().post("/api/pedidos/carrito").then().statusCode(400);
        // Cantidad fuera de rango.
        como(cliente).body(pedido("turamohoy", List.of(linea(flor, 0)))).when().post("/api/pedidos/carrito")
                .then().statusCode(400);
        // A domicilio sin dirección.
        Map<String, Object> sinDireccion = pedido("turamohoy", List.of(linea(flor, 1)));
        sinDireccion.remove("entregar");
        como(cliente).body(sinDireccion).when().post("/api/pedidos/carrito").then().statusCode(400);
        // Recoger en el negocio no pide dirección.
        sinDireccion.put("entrega", "RECOGER");
        como(cliente).body(sinDireccion).when().post("/api/pedidos/carrito").then().statusCode(201);
        // Encarguitos usa su propio formulario.
        como(cliente).body(pedido("encarguitos", List.of(linea(flor, 1)))).when().post("/api/pedidos/carrito")
                .then().statusCode(400);
    }

    @Test
    void rentaCitaYMayoresDeEdad() {
        String cliente = Clientes.nuevo("Fiesta");
        Object inflable = productos("inflables").get(0).get("id");
        Map<String, Object> renta = pedido("inflables", List.of(linea(inflable, 1)));
        renta.put("entrega", "RECOGER"); // en renta siempre se lleva al evento
        como(cliente).body(renta).when().post("/api/pedidos/carrito").then().statusCode(400); // falta la fecha
        renta.put("cuando", "2026-12-20");
        int idRenta = como(cliente).body(renta).when().post("/api/pedidos/carrito").then().statusCode(201)
                .extract().path("id");

        var auto = productos("autos").get(0);
        Map<String, Object> cita = pedido("autos", List.of(linea(auto.get("id"), 3)));
        cita.put("cuando", "Viernes por la tarde");
        int idCita = como(cliente).body(cita).when().post("/api/pedidos/carrito").then().statusCode(201)
                .extract().path("id");

        String dueno = Sesiones.dueno();
        como(dueno).when().get("/api/admin/pedidos").then()
                .body("find { it.id == " + idRenta + " }.modo", equalTo("RENTA"))
                .body("find { it.id == " + idRenta + " }.entrega", equalTo("DOMICILIO"))
                .body("find { it.id == " + idCita + " }.modo", equalTo("CITA"))
                .body("find { it.id == " + idCita + " }.entrega", equalTo("RECOGER"))
                .body("find { it.id == " + idCita + " }.tipo", startsWith("Cita · "))
                .body("find { it.id == " + idCita + " }.lineas[0].cantidad", equalTo(1));

        Object mezcal = productos("vinateria").get(0).get("id");
        Map<String, Object> vino = pedido("vinateria", List.of(linea(mezcal, 1)));
        como(cliente).body(vino).when().post("/api/pedidos/carrito").then().statusCode(400);
        vino.put("mayorDeEdad", true);
        como(cliente).body(vino).when().post("/api/pedidos/carrito").then().statusCode(201);
    }

    @Test
    void elRepartidorGeneralVeLosPedidosADomicilioDeTodos() {
        String dueno = Sesiones.dueno();
        int r = como(dueno).body(Map.of("nombre", "Moto general", "correo", "general@sierrasur.local",
                        "contrasena", "clave-segura-1", "rol", "REPARTIDOR"))
                .when().post("/api/admin/usuarios").then().statusCode(201)
                .body("negocioSlug", equalTo(null)).extract().path("id");
        try {
            String cliente = Clientes.nuevo("Reparto");
            Object flor = productos("turamohoy").get(0).get("id");
            int casa = como(cliente).body(pedido("turamohoy", List.of(linea(flor, 1))))
                    .when().post("/api/pedidos/carrito").then().statusCode(201).extract().path("id");
            Map<String, Object> recoge = pedido("turamohoy", List.of(linea(flor, 1)));
            recoge.put("entrega", "RECOGER");
            int tienda = como(cliente).body(recoge).when().post("/api/pedidos/carrito").then().statusCode(201)
                    .extract().path("id");

            String moto = Sesiones.entrar("general@sierrasur.local", "clave-segura-1");
            como(moto).when().get("/api/admin/pedidos").then().statusCode(200)
                    .body("id", hasItem(casa)).body("id", not(hasItem(tienda)));
            como(moto).body(Map.of("estado", "ACEPTADO")).when().put("/api/admin/pedidos/" + casa + "/estado")
                    .then().statusCode(200).body("repartidorNombre", equalTo("Moto general"));
            como(moto).body(Map.of("estado", "ACEPTADO")).when().put("/api/admin/pedidos/" + tienda + "/estado")
                    .then().statusCode(404);
        } finally {
            como(dueno).body(Map.of("nombre", "Moto general", "activo", false))
                    .when().put("/api/admin/usuarios/" + r).then().statusCode(200);
        }
    }
}
