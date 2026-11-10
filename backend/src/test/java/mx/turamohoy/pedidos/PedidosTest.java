package mx.turamohoy.pedidos;

import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import io.restassured.specification.RequestSpecification;
import mx.turamohoy.admin.Sesiones;
import mx.turamohoy.clientes.Clientes;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.matchesPattern;
import static org.hamcrest.Matchers.not;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

@QuarkusTest
class PedidosTest {

    private static RequestSpecification como(String token) {
        return given().auth().oauth2(token).contentType(ContentType.JSON);
    }

    private static Map<String, Object> pedido(String nombre) {
        Map<String, Object> m = new HashMap<>();
        m.put("negocio", "encarguitos");
        m.put("tipo", "Súper o mercado");
        m.put("modo", "MANDADO");
        m.put("nombre", nombre);
        m.put("telefono", "+52 55 1234 5678");
        m.put("entregar", "Av. Juárez 10, frente al parque");
        m.put("zona", "Centro");
        m.put("total", 230);
        m.put("mensaje", "Hola Encarguitos, quiero hacer un encargo:\n*Qué necesito:* tortillas");
        return m;
    }

    private static int crear(String nombre) {
        return como(Clientes.nuevo(nombre)).body(pedido(nombre))
                .when().post("/api/pedidos")
                .then().statusCode(201)
                .body("folio", matchesPattern("ENC-\\d{5}"))
                .extract().path("id");
    }

    private static int repartidor(String dueno, String correo) {
        return como(dueno).body(Map.of("nombre", "Repartidor " + correo, "correo", correo,
                        "contrasena", "clave-segura-1", "negocioSlug", "encarguitos", "rol", "REPARTIDOR"))
                .when().post("/api/admin/usuarios").then().statusCode(201)
                .body("rol", equalTo("REPARTIDOR")).extract().path("id");
    }

    @Test
    void elSitioRegistraElPedidoYValida() {
        // Sin cuenta no se puede pedir.
        given().contentType(ContentType.JSON).body(pedido("Ana")).when().post("/api/pedidos").then().statusCode(401);
        String ana = Clientes.nuevo("Ana");
        int id = como(ana).body(pedido("Ana")).when().post("/api/pedidos").then().statusCode(201).extract().path("id");
        // Aparece en "mis pedidos".
        como(ana).when().get("/api/clientes/pedidos").then().statusCode(200).body("id", hasItem(id));
        Map<String, Object> malo = pedido("Ana");
        malo.put("telefono", "123");
        como(ana).body(malo).when().post("/api/pedidos").then().statusCode(400);
        Map<String, Object> otro = pedido("Ana");
        otro.put("negocio", "turamohoy");
        como(ana).body(otro).when().post("/api/pedidos").then().statusCode(400);
        // Sin nombre ni teléfono se usan los de la cuenta.
        Map<String, Object> corto = pedido("x");
        corto.remove("nombre");
        corto.remove("telefono");
        como(ana).body(corto).when().post("/api/pedidos").then().statusCode(201);
    }

    @Test
    void flujoCompletoConRepartidores() {
        String dueno = Sesiones.dueno();
        int id = crear("Luis Flujo");
        int r1 = repartidor(dueno, "moto1@sierrasur.local");
        int r2 = repartidor(dueno, "moto2@sierrasur.local");
        try {
            String moto1 = Sesiones.entrar("moto1@sierrasur.local", "clave-segura-1");
            String moto2 = Sesiones.entrar("moto2@sierrasur.local", "clave-segura-1");

            como(dueno).when().get("/api/admin/pedidos").then().statusCode(200).body("id", hasItem(id));
            como(moto1).when().get("/api/admin/pedidos").then().statusCode(200)
                    .body("find { it.id == " + id + " }.clienteTelefono", equalTo("5512345678"));

            // El repartidor no edita el catálogo.
            como(moto1).when().get("/api/admin/negocios/encarguitos/productos").then().statusCode(403);

            como(moto1).body(Map.of("estado", "ACEPTADO")).when().put("/api/admin/pedidos/" + id + "/estado")
                    .then().statusCode(200).body("repartidorNombre", equalTo("Repartidor moto1@sierrasur.local"));
            // Ya es de otro: el segundo no lo ve ni lo puede mover.
            como(moto2).when().get("/api/admin/pedidos").then().body("id", not(hasItem(id)));
            como(moto2).body(Map.of("estado", "EN_CAMINO")).when().put("/api/admin/pedidos/" + id + "/estado")
                    .then().statusCode(409);
            // Saltarse pasos no se puede; el repartidor no cancela.
            como(moto1).body(Map.of("estado", "ENTREGADO")).when().put("/api/admin/pedidos/" + id + "/estado")
                    .then().statusCode(409);
            como(moto1).body(Map.of("estado", "CANCELADO")).when().put("/api/admin/pedidos/" + id + "/estado")
                    .then().statusCode(409);

            como(moto1).body(Map.of("estado", "EN_CAMINO")).when().put("/api/admin/pedidos/" + id + "/estado")
                    .then().statusCode(200);
            como(moto1).body(Map.of("estado", "ENTREGADO")).when().put("/api/admin/pedidos/" + id + "/estado")
                    .then().statusCode(200).body("estado", equalTo("ENTREGADO"));

            como(dueno).when().get("/api/admin/pedidos").then().body("id", not(hasItem(id)));
            como(dueno).when().get("/api/admin/pedidos?activos=false").then().body("id", hasItem(id));
        } finally {
            for (int r : new int[] {r1, r2}) {
                como(dueno).body(Map.of("nombre", "Repartidor", "activo", false))
                        .when().put("/api/admin/usuarios/" + r).then().statusCode(200);
            }
        }
    }

    @Test
    void elDuenoCancela() {
        String dueno = Sesiones.dueno();
        int id = crear("Cancelado");
        como(dueno).body(Map.of("estado", "CANCELADO")).when().put("/api/admin/pedidos/" + id + "/estado")
                .then().statusCode(200).body("estado", equalTo("CANCELADO"));
        como(dueno).body(Map.of("estado", "ACEPTADO")).when().put("/api/admin/pedidos/" + id + "/estado")
                .then().statusCode(409);
        given().when().get("/api/admin/pedidos").then().statusCode(401);
    }

    @Test
    void notificacionesPush() {
        String dueno = Sesiones.dueno();
        String clave = como(dueno).when().get("/api/admin/push/clave").then().statusCode(200).extract().path("clave");
        assertEquals(87, clave.length()); // 65 bytes en base64url
        // Siempre la misma llave (se guarda en la base).
        como(dueno).when().get("/api/admin/push/clave").then().body("clave", equalTo(clave));
        Map<String, String> s = Map.of("endpoint", "https://push.ejemplo.invalid/abc",
                "p256dh", "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM",
                "auth", "tBHItJI5svbpez7KI4CCXg");
        como(dueno).body(s).when().post("/api/admin/push").then().statusCode(204);
        como(dueno).body(s).when().post("/api/admin/push").then().statusCode(204); // repetir no duplica
        // Con un pedido nuevo intenta avisar (el destino no existe; no debe fallar nada).
        crear("Con push");
        como(dueno).body(s).when().delete("/api/admin/push").then().statusCode(204);
    }

    @Test
    void limiteDePedidosPorIp() {
        LimitePedidos l = new LimitePedidos();
        l.maximo = 2;
        assertTrue(l.permitir("1.1.1.1"));
        assertTrue(l.permitir("1.1.1.1"));
        assertFalse(l.permitir("1.1.1.1"));
        assertTrue(l.permitir("2.2.2.2"));
    }

    @Test
    void cargaJsonDeLaNotificacion() {
        String c = Notificador.carga("Nuevo \"pedido\"", "Ana\nCentro", "pedido-1", "/admin/pedidos");
        assertTrue(c.contains("\"title\":\"Nuevo \\\"pedido\\\"\""));
        assertTrue(c.contains("\"body\":\"Ana\\nCentro\""));
        assertTrue(c.contains("navigateLastFocusedOrOpen"));
    }
}
