package mx.turamohoy.tianguis;

import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.nullValue;
import static org.junit.jupiter.api.Assertions.assertEquals;

/** Servicios de particulares: sin condición, precio fijo/desde/a cotizar, fotos opcionales y sin «vendido». */
@QuarkusTest
class TianguisServiciosTest extends BaseTianguis {

    private static Map<String, Object> servicio(String titulo, String tipoPrecio, Object precio) {
        Map<String, Object> m = new HashMap<>();
        m.put("categoria", "oficios");
        m.put("titulo", titulo);
        m.put("descripcion", "Reparaciones de plomería a domicilio, trabajo garantizado.");
        m.put("tipoPrecio", tipoPrecio);
        m.put("precio", precio);
        m.put("atributos", new HashMap<>(Map.of("oficio", "plomería", "aDomicilio", "si")));
        m.put("ubicacion", "Centro, Miahuatlán");
        m.put("fotos", List.of());
        String w = whatsappNuevo();
        m.put("vendedorNombre", "Don " + w.substring(6));
        m.put("vendedorWhatsapp", w);
        m.put("aceptaReglas", true);
        m.put("sitioWeb", "");
        return m;
    }

    private static io.restassured.response.ValidatableResponse publicar(Map<String, Object> m) {
        return given().contentType(ContentType.JSON).header("X-Forwarded-For", "10.0.0.9").body(m)
                .when().post("/api/tianguis/anuncios").then();
    }

    @Test
    void unServicioACotizarSinFotosNiCondicionSePublicaYNoSeMarcaVendido() {
        String w = palabra();
        Map<String, Object> p = publicar(servicio("Plomero " + w, "COTIZAR", null)).statusCode(201)
                .extract().as(Map.class);
        int id = (Integer) p.get("id");
        estado(id, "PUBLICADO", null);
        given().when().get("/api/tianguis/anuncios/" + id).then().statusCode(200)
                .body("tipoPrecio", equalTo("COTIZAR")).body("precio", nullValue())
                .body("condicion", nullValue()).body("negociable", equalTo(false))
                .body("categoria.tipo", equalTo("SERVICIO")).body("fotos.size()", equalTo(0))
                .body("atributos.valor", contains("Plomería", "Sí"));
        given().when().get("/api/tianguis/gestion/" + p.get("token")).then()
                .body("puedeMarcarVendido", equalTo(false)).body("puedePausar", equalTo(true));
        given().contentType(ContentType.JSON).when().post("/api/tianguis/gestion/" + p.get("token") + "/vendido")
                .then().statusCode(409);
        Map<String, Object> cambio = new HashMap<>();
        cambio.put("estado", "VENDIDO");
        como(dueno).body(cambio).when().patch("/api/admin/tianguis/anuncios/" + id + "/estado").then().statusCode(409);
    }

    @Test
    void reglasDePrecioCondicionYFotosSegunElTipo() {
        // Servicio «desde» sin cifra: falta el precio.
        publicar(servicio("Electricista", "DESDE", null)).statusCode(400);
        publicar(servicio("Electricista", "INVENTADO", 100)).statusCode(400);
        // Si llega una condición en un servicio, se ignora.
        Map<String, Object> conCondicion = servicio("Albañil " + palabra(), "DESDE", 300);
        conCondicion.put("condicion", "USADO");
        int id = (Integer) publicar(conCondicion).statusCode(201).extract().path("id");
        estado(id, "PUBLICADO", null);
        given().when().get("/api/tianguis/anuncios/" + id).then().body("condicion", nullValue())
                .body("tipoPrecio", equalTo("DESDE")).body("precio", equalTo(300.0f));
        // Un artículo: precio fijo, condición y al menos una foto.
        Map<String, Object> auto = vehiculo("Auto " + palabra(), 50000, whatsappNuevo());
        auto.put("aceptaReglas", true);
        auto.put("tipoPrecio", "DESDE");
        publicar(auto).statusCode(400);
        auto.put("tipoPrecio", "FIJO");
        auto.remove("condicion");
        publicar(auto).statusCode(400);
        auto.put("condicion", "NUEVO_SIN_USO");
        auto.put("fotos", List.of());
        publicar(auto).statusCode(400);
    }

    @Test
    void filtroPorTipoYLosACotizarVanAlFinalAlOrdenarPorPrecio() {
        String w = palabra();
        int cotizar = crearDesdePanel(servicioPanel("Flete " + w, "COTIZAR", null), true);
        int desde = crearDesdePanel(servicioPanel("Mudanza " + w, "DESDE", 800), true);
        Map<String, Object> auto = vehiculo("Camioneta " + w, 90000, whatsappNuevo());
        int articulo = crearDesdePanel(auto, true);
        given().queryParam("q", w).queryParam("orden", "precioAsc").when().get("/api/tianguis/anuncios").then()
                .body("anuncios.id", contains(desde, articulo, cotizar));
        given().queryParam("q", w).queryParam("orden", "precioDesc").when().get("/api/tianguis/anuncios").then()
                .body("anuncios.id", contains(articulo, desde, cotizar));
        given().queryParam("q", w).queryParam("tipo", "servicio").when().get("/api/tianguis/anuncios").then()
                .body("total", equalTo(2));
        given().queryParam("q", w).queryParam("tipo", "ARTICULO").when().get("/api/tianguis/anuncios").then()
                .body("anuncios.id", contains(articulo));
        given().queryParam("tipo", "otro").when().get("/api/tianguis/anuncios").then().statusCode(400);
    }

    private static Map<String, Object> servicioPanel(String titulo, String tipoPrecio, Object precio) {
        Map<String, Object> m = servicio(titulo, tipoPrecio, precio);
        m.put("categoria", "fletes");
        m.put("atributos", new HashMap<>(Map.of("servicio", "Flete")));
        return m;
    }

    @Test
    void lasCategoriasDeServiciosYNoSeCambiaElTipoConAnuncios() {
        given().when().get("/api/tianguis/categorias").then()
                .body("findAll { it.tipo == 'SERVICIO' }.slug", contains("oficios", "belleza", "clases", "fletes"))
                .body("find { it.slug == 'vehiculos' }.tipo", equalTo("ARTICULO"));
        crearDesdePanel(vehiculo("Para la categoría " + palabra(), 1000, whatsappNuevo()), false);
        Map<String, Object> cat = como(dueno).when().get("/api/admin/tianguis/categorias").then()
                .extract().path("find { it.slug == 'vehiculos' }");
        Map<String, Object> e = new HashMap<>(cat);
        e.put("tipo", "SERVICIO");
        como(dueno).body(e).when().put("/api/admin/tianguis/categorias/" + cat.get("id")).then().statusCode(409);
        // Una categoría nueva de servicios.
        Map<String, Object> nueva = new HashMap<>(Map.of("nombre", "Cuidado de mascotas", "slug", "mascotas-" + palabra(),
                "orden", 14, "activa", true, "tipo", "SERVICIO", "campos", List.of()));
        String slug = como(dueno).body(nueva).when().post("/api/admin/tianguis/categorias").then().statusCode(201)
                .body("tipo", equalTo("SERVICIO")).extract().path("slug");
        assertEquals(nueva.get("slug"), slug);
        como(dueno).when().get("/api/admin/tianguis/categorias").then().body("slug", hasItem(slug));
    }
}
