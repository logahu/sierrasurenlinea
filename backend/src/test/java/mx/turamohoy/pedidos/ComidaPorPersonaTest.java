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
import static org.hamcrest.Matchers.hasSize;
import static org.junit.jupiter.api.Assertions.assertEquals;

@QuarkusTest
class ComidaPorPersonaTest {

    private static final String BASE = "/api/admin/negocios/encarguitos/restaurantes";

    private static RequestSpecification como(String token) {
        return given().auth().oauth2(token).contentType(ContentType.JSON);
    }

    private static Map<String, Object> grupo(String nombre, boolean multiple, boolean obligatorio, Integer maximo,
                                             List<Map<String, Object>> opciones) {
        Map<String, Object> g = new HashMap<>();
        g.put("nombre", nombre);
        g.put("multiple", multiple);
        g.put("obligatorio", obligatorio);
        g.put("maximo", maximo);
        g.put("opciones", opciones);
        return g;
    }

    private static Map<String, Object> op(String nombre, double precio, boolean disponible) {
        return Map.of("nombre", nombre, "precio", precio, "disponible", disponible);
    }

    private static Map<String, Object> renglon(Object platillo, int cantidad, List<Map<String, String>> opciones, String nota) {
        Map<String, Object> r = new HashMap<>();
        r.put("platilloId", platillo);
        r.put("cantidad", cantidad);
        r.put("opciones", opciones);
        r.put("nota", nota);
        return r;
    }

    private static Map<String, String> el(String grupo, String opcion) {
        return Map.of("grupo", grupo, "opcion", opcion);
    }

    private static Map<String, Object> pedido(Object lugar, List<Map<String, Object>> ordenes) {
        Map<String, Object> m = new HashMap<>();
        m.put("negocio", "encarguitos");
        m.put("tipo", "Comida a domicilio · Taquería de prueba");
        m.put("modo", "COMIDA");
        m.put("entregar", "Av. Juárez 10");
        m.put("zona", "Centro");
        m.put("total", 1);   // lo que diga el navegador no cuenta
        m.put("mensaje", "Hola, quiero pedir comida");
        m.put("comida", Map.of("restauranteId", lugar, "ordenes", ordenes));
        return m;
    }

    @Test
    void ordenesPorPersonaConOpcionesYPreciosDelMenu() {
        String dueno = Sesiones.dueno();
        Integer lugar = como(dueno).body(Map.of("nombre", "Taquería de prueba"))
                .when().post(BASE).then().statusCode(201).extract().path("id");
        try {
            List<Map<String, Object>> grupos = List.of(
                    grupo("Carne", false, true, null, List.of(op("Pastor", 0, true), op("Suadero", 0, true),
                            op("Lengua", 5, false))),
                    grupo("Extras", true, false, 2, List.of(op("Queso", 15, true), op("Piña", 5, true), op("Nopal", 3, true))));
            Map<String, Object> taco = new HashMap<>(Map.of("nombre", "Taco", "precio", 15, "opciones", grupos));
            Integer tacoId = como(dueno).body(taco).when().post(BASE + "/" + lugar + "/platillos")
                    .then().statusCode(201).body("opciones", hasSize(2))
                    .body("opciones[0].opciones[2].disponible", equalTo(false)).extract().path("id");
            Integer aguaId = como(dueno).body(Map.of("nombre", "Agua de jamaica", "precio", 20))
                    .when().post(BASE + "/" + lugar + "/platillos").then().statusCode(201).extract().path("id");

            // Editar sin mandar opciones no las borra.
            como(dueno).body(Map.of("nombre", "Taco", "precio", 15))
                    .when().put(BASE + "/" + lugar + "/platillos/" + tacoId).then().statusCode(200).body("opciones", hasSize(2));
            // Grupos repetidos: no.
            como(dueno).body(Map.of("nombre", "Taco", "precio", 15, "opciones", List.of(grupos.get(0), grupos.get(0))))
                    .when().put(BASE + "/" + lugar + "/platillos/" + tacoId).then().statusCode(400);

            // El sitio ve las opciones.
            given().when().get("/api/negocios/encarguitos/restaurantes").then()
                    .body("find { it.id == " + lugar + " }.platillos.find { it.nombre == 'Taco' }.opciones.nombre",
                            equalTo(List.of("Carne", "Extras")));

            String cliente = Clientes.nuevo("Hugo Comida");
            // 3 tacos para él (cada uno distinto) y 6 para su amigo.
            List<Map<String, Object>> ordenes = List.of(
                    Map.of("persona", "", "renglones", List.of(
                            renglon(tacoId, 1, List.of(el("Carne", "Pastor"), el("Extras", "Queso")), "Sin cebolla"),
                            renglon(tacoId, 1, List.of(el("Carne", "Suadero")), null),
                            renglon(tacoId, 1, List.of(el("carne", "pastor"), el("Extras", "Piña"), el("Extras", "Nopal")), null),
                            renglon(aguaId, 1, List.of(), null))),
                    Map.of("persona", "Luis", "renglones", List.of(
                            renglon(tacoId, 6, List.of(el("Carne", "Suadero")), "Con todo"))));
            int id = como(cliente).body(pedido(lugar, ordenes)).when().post("/api/pedidos")
                    .then().statusCode(201).extract().path("id");

            // 30 + 15 + 23 + 20 + 90 = 178 de comida, más la tarifa «Centro».
            double centro = given().when().get("/api/negocios/encarguitos/productos").then().extract().jsonPath()
                    .getDouble("find { it.nombre == 'Centro' }.precio");
            var p = como(dueno).when().get("/api/admin/pedidos").then().extract().jsonPath()
                    .getMap("find { it.id == " + id + " }");
            assertEquals(178 + centro, ((Number) p.get("totalEstimado")).doubleValue(), 0.001);
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> lineas = (List<Map<String, Object>>) p.get("lineas");
            assertEquals(5, lineas.size());
            assertEquals("Hugo Comida", lineas.get(0).get("persona"));
            assertEquals("Pastor · Queso (+$15)", lineas.get(0).get("detalle"));
            assertEquals("Sin cebolla", lineas.get(0).get("nota"));
            assertEquals(30.0, ((Number) lineas.get(0).get("precioUnitario")).doubleValue(), 0.001);
            assertEquals("Luis", lineas.get(4).get("persona"));
            assertEquals(6, lineas.get(4).get("cantidad"));

            // Falta la carne (obligatoria).
            como(cliente).body(pedido(lugar, List.of(Map.of("renglones", List.of(renglon(tacoId, 1, List.of(), null))))))
                    .when().post("/api/pedidos").then().statusCode(409).body("mensaje", equalTo("Elige «Carne» para Taco."));
            // Dos carnes en «elige una».
            como(cliente).body(pedido(lugar, List.of(Map.of("renglones", List.of(
                            renglon(tacoId, 1, List.of(el("Carne", "Pastor"), el("Carne", "Suadero")), null))))))
                    .when().post("/api/pedidos").then().statusCode(409);
            // Más extras que el máximo.
            como(cliente).body(pedido(lugar, List.of(Map.of("renglones", List.of(renglon(tacoId, 1,
                            List.of(el("Carne", "Pastor"), el("Extras", "Queso"), el("Extras", "Piña"), el("Extras", "Nopal")), null))))))
                    .when().post("/api/pedidos").then().statusCode(409);
            // Opción agotada.
            como(cliente).body(pedido(lugar, List.of(Map.of("renglones", List.of(
                            renglon(tacoId, 1, List.of(el("Carne", "Lengua")), null))))))
                    .when().post("/api/pedidos").then().statusCode(409);
            // Dos órdenes para la misma persona.
            como(cliente).body(pedido(lugar, List.of(
                            Map.of("persona", "Luis", "renglones", List.of(renglon(aguaId, 1, List.of(), null))),
                            Map.of("persona", "luis", "renglones", List.of(renglon(aguaId, 1, List.of(), null))))))
                    .when().post("/api/pedidos").then().statusCode(400);
        } finally {
            // Se oculta para no estorbar a otras pruebas (sus renglones de pedido lo siguen usando).
            como(dueno).body(Map.of("nombre", "Taquería de prueba", "visible", false))
                    .when().put(BASE + "/" + lugar).then().statusCode(200);
        }
    }
}
