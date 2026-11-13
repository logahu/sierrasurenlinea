package mx.turamohoy.colonias;

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
import static org.hamcrest.Matchers.greaterThan;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.junit.jupiter.api.Assertions.assertEquals;

@QuarkusTest
class ColoniasTest {

    private static RequestSpecification como(String token) {
        return given().auth().oauth2(token).contentType(ContentType.JSON);
    }

    private static Map<String, Object> pedido(String colonia, boolean otra) {
        Object flor = given().when().get("/api/negocios/turamohoy/productos").then().extract().path("[0].id");
        Map<String, Object> m = new HashMap<>();
        m.put("negocio", "turamohoy");
        m.put("lineas", List.of(Map.of("productoId", flor, "cantidad", 1)));
        m.put("entrega", "DOMICILIO");
        m.put("entregar", "Calle Hidalgo 4");
        m.put("mensaje", "Hola");
        m.put("colonia", colonia);
        m.put("coloniaOtra", otra);
        return m;
    }

    @Test
    void elCatalogoTraeLasColoniasDeSepomex() {
        given().when().get("/api/colonias").then().statusCode(200)
                .body("size()", greaterThan(80))
                .body("nombre", hasItem("Benito Juárez"))
                .body("find { it.nombre == 'Arriba' }.tipo", equalTo("Barrio"));
    }

    @Test
    void elAdministradorAgregaEditaYElimina() {
        String dueno = Sesiones.dueno();
        given().contentType(ContentType.JSON).body(Map.of("nombre", "X", "tipo", "Colonia"))
                .when().post("/api/admin/colonias").then().statusCode(401);

        Integer id = como(dueno).body(Map.of("nombre", "Los Pinos Prueba", "tipo", "Colonia", "codigoPostal", "70805",
                        "zona", "Centro"))
                .when().post("/api/admin/colonias").then().statusCode(201).body("estado", equalTo("ACTIVA"))
                .extract().path("id");
        // Repetida (sin importar acentos ni mayúsculas).
        como(dueno).body(Map.of("nombre", "los  pinos prueba", "tipo", "Colonia"))
                .when().post("/api/admin/colonias").then().statusCode(409);
        // Código postal inválido.
        como(dueno).body(Map.of("nombre", "Otra Prueba", "tipo", "Colonia", "codigoPostal", "123"))
                .when().post("/api/admin/colonias").then().statusCode(400);

        given().when().get("/api/colonias").then().body("find { it.id == " + id + " }.zona", equalTo("Centro"));
        como(dueno).body(Map.of("nombre", "Los Pinos Prueba", "tipo", "Fraccionamiento", "zona", ""))
                .when().put("/api/admin/colonias/" + id).then().statusCode(200)
                .body("tipo", equalTo("Fraccionamiento")).body("zona", equalTo(null));
        como(dueno).when().get("/api/admin/colonias").then().statusCode(200).body("zonas", not(equalTo(null)));

        como(dueno).when().delete("/api/admin/colonias/" + id).then().statusCode(204);
        given().when().get("/api/colonias").then().body("id", not(hasItem(id)));
    }

    @Test
    void laColoniaOtraQuedaComoSolicitudYElAdministradorLaAgrega() {
        String cliente = Clientes.nuevo("Vecina Nueva");
        String dueno = Sesiones.dueno();
        String nombre = "Colonia Inventada " + Clientes.telefonoNuevo().substring(5);

        int p1 = como(cliente).body(pedido(nombre, true)).when().post("/api/pedidos/carrito")
                .then().statusCode(201).extract().path("id");
        // La misma, escrita distinto, suma otra solicitud.
        como(cliente).body(pedido(nombre.toUpperCase(), true)).when().post("/api/pedidos/carrito").then().statusCode(201);

        var lista = como(dueno).when().get("/api/admin/colonias").then().statusCode(200).extract().jsonPath();
        Map<String, Object> solicitada = lista.getMap("colonias.find { it.nombre == '" + nombre + "' }");
        assertEquals("SOLICITADA", solicitada.get("estado"));
        assertEquals(2, solicitada.get("solicitudes"));
        // No se ofrece todavía a los clientes.
        given().when().get("/api/colonias").then().body("nombre", not(hasItem(nombre)));

        var p = como(dueno).when().get("/api/admin/pedidos").then().extract().jsonPath()
                .getMap("find { it.id == " + p1 + " }");
        assertEquals(nombre, p.get("colonia"));
        assertEquals(true, p.get("coloniaOtra"));

        // Al guardarla, queda en el catálogo.
        como(dueno).body(Map.of("nombre", nombre, "tipo", "Colonia"))
                .when().put("/api/admin/colonias/" + solicitada.get("id")).then().statusCode(200)
                .body("estado", equalTo("ACTIVA"));
        given().when().get("/api/colonias").then().body("nombre", hasItem(nombre));

        // Si escribe en «Otra» una que ya está, se toma la del catálogo y no hay solicitud.
        int p3 = como(cliente).body(pedido("benito juarez", true)).when().post("/api/pedidos/carrito")
                .then().statusCode(201).extract().path("id");
        var p3dto = como(dueno).when().get("/api/admin/pedidos").then().extract().jsonPath()
                .getMap("find { it.id == " + p3 + " }");
        assertEquals("Benito Juárez", p3dto.get("colonia"));
        assertEquals(false, p3dto.get("coloniaOtra"));

        como(dueno).when().delete("/api/admin/colonias/" + solicitada.get("id")).then().statusCode(204);
    }
}
