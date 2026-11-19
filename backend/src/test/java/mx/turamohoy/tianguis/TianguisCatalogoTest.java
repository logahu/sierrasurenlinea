package mx.turamohoy.tianguis;

import io.quarkus.test.junit.QuarkusTest;
import io.restassured.path.json.JsonPath;
import mx.turamohoy.admin.Sesiones;
import mx.turamohoy.clientes.Clientes;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasKey;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.nullValue;
import static org.hamcrest.Matchers.oneOf;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Fase 1: catálogo administrado (alta en el panel, listado, filtros, ficha y estados). */
@QuarkusTest
class TianguisCatalogoTest extends BaseTianguis {

    @Test
    void elTianguisEsUnGiroMasEnLaPortada() {
        given().when().get("/api/negocios").then().statusCode(200)
                .body("find { it.slug == 'tianguis' }.giro.slug", equalTo("tianguis"))
                .body("find { it.slug == 'tianguis' }.nombre", equalTo("Tianguis Sierra Sur"));
        given().when().get("/api/giros").then().statusCode(200)
                .body("find { it.slug == 'tianguis' }.negocios", equalTo(1));
    }

    @Test
    void enPruebasSoloLoVenLosProbadores() {
        estadoDelTianguis("PRUEBAS");
        given().when().get("/api/tianguis/anuncios").then().statusCode(404);
        given().when().get("/api/tianguis/categorias").then().statusCode(404);
    }

    @Test
    void lasCategoriasTraenSusCamposYCuantosAnunciosHay() {
        given().when().get("/api/tianguis/categorias").then().statusCode(200)
                .body("slug", contains("vehiculos", "motos", "electronica", "muebles", "herramientas", "ropa", "otros"))
                .body("find { it.slug == 'vehiculos' }.campos.nombre", hasItem("transmision"))
                .body("find { it.slug == 'vehiculos' }.campos.find { it.nombre == 'marca' }.requerido", equalTo(true));
    }

    @Test
    void elAdminPublicaUnVehiculoConFotosYAtributosYSeVeEnLaFicha() {
        String w = palabra();
        String tel = whatsappNuevo();
        int id = crearDesdePanel(vehiculo("Tsuru " + w, 85000, tel), true);

        como(dueno).when().get("/api/admin/tianguis/anuncios/" + id).then().statusCode(200)
                .body("estado", equalTo("PUBLICADO"))
                .body("fechaPublicacion", equalTo("2026-11-19T12:00:00"))
                .body("fechaVencimiento", equalTo("2026-12-19T12:00:00"))
                .body("vendedor.whatsapp", equalTo("52" + tel));

        given().queryParam("q", w).when().get("/api/tianguis/anuncios").then().statusCode(200)
                .body("total", equalTo(1))
                .body("anuncios[0].portada", equalTo(FOTOS.get(0)))
                .body("anuncios[0].idSlug", equalTo(id + "-tsuru-" + w))
                .body("anuncios[0].categoria.slug", equalTo("vehiculos"));

        JsonPath ficha = given().when().get("/api/tianguis/anuncios/" + id).then().statusCode(200)
                .body("fotos", hasSize(3))
                .body("negociable", equalTo(true))
                // Transmisión se guarda con la opción de la lista («Manual»).
                .body("atributos.find { it.nombre == 'transmision' }.valor", equalTo("Manual"))
                .body("atributos.find { it.nombre == 'km' }.unidad", equalTo("km"))
                .body("atributos[0].etiqueta", equalTo("Marca"))
                .body("vendedor.whatsapp", equalTo("52" + tel))
                .body("vendedor", not(hasKey("notasInternas")))
                .body("$", not(hasKey("tokenHash")))
                .extract().jsonPath();
        int vistas = ficha.getInt("vistas");
        given().when().get("/api/tianguis/anuncios/" + id).then().body("vistas", equalTo(vistas + 1));
    }

    @Test
    void losAtributosSeValidanContraLaCategoria() {
        String tel = whatsappNuevo();
        Map<String, Object> m = vehiculo("Sin marca " + palabra(), 1000, tel);
        m.put("publicar", false);
        ((Map<String, Object>) m.get("atributos")).remove("marca");
        como(dueno).body(m).when().post("/api/admin/tianguis/anuncios").then().statusCode(400)
                .body("mensaje", containsString("Marca"));
        ((Map<String, Object>) m.get("atributos")).put("marca", "Nissan");
        ((Map<String, Object>) m.get("atributos")).put("anio", "dos mil");
        como(dueno).body(m).when().post("/api/admin/tianguis/anuncios").then().statusCode(400)
                .body("mensaje", containsString("número"));
        ((Map<String, Object>) m.get("atributos")).put("anio", "2010");
        ((Map<String, Object>) m.get("atributos")).put("transmision", "Triptónica");
        como(dueno).body(m).when().post("/api/admin/tianguis/anuncios").then().statusCode(400);
        ((Map<String, Object>) m.get("atributos")).put("transmision", "Automática");
        ((Map<String, Object>) m.get("atributos")).put("inventado", "x");
        int id = como(dueno).body(m).when().post("/api/admin/tianguis/anuncios").then().statusCode(201)
                .body("estado", equalTo("PENDIENTE"))
                .body("atributos", not(hasKey("inventado")))
                .extract().path("id");
        // Sin fotos o con una foto de otro sitio, no.
        m.put("fotos", List.of());
        como(dueno).body(m).when().put("/api/admin/tianguis/anuncios/" + id).then().statusCode(400);
        m.put("fotos", List.of("https://otro.sitio/foto.jpg"));
        como(dueno).body(m).when().put("/api/admin/tianguis/anuncios/" + id).then().statusCode(400);
    }

    @Test
    void filtrosBusquedaYOrdenSeCombinan() {
        String w = palabra();
        String tel = whatsappNuevo();
        crearDesdePanel(vehiculo("Pickup " + w, 100000, tel), true);
        Map<String, Object> seminuevo = vehiculo("Sedán " + w, 50000, tel);
        seminuevo.put("condicion", "SEMINUEVO");
        crearDesdePanel(seminuevo, true);
        Map<String, Object> moto = vehiculo("Moto Italika " + w, 20000, tel);
        moto.put("categoria", "motos");
        moto.put("atributos", Map.of("marca", "Italika", "modelo", "FT150", "anio", "2022"));
        crearDesdePanel(moto, true);
        Map<String, Object> cel = vehiculo("Teléfono Motorola " + w, 3000, tel);
        cel.put("categoria", "electronica");
        cel.put("condicion", "NUEVO_SIN_USO");
        cel.put("atributos", Map.of("marca", "Motorola", "modelo", "G54", "imeiLimpio", "si"));
        crearDesdePanel(cel, true);

        String base = "/api/tianguis/anuncios?q=" + w;
        given().when().get(base).then().body("total", equalTo(4));
        given().when().get(base + "&categoria=vehiculos").then().body("total", equalTo(2));
        given().when().get(base + "&categoria=vehiculos&condicion=USADO").then().body("total", equalTo(1))
                .body("anuncios[0].titulo", equalTo("Pickup " + w));
        given().when().get(base + "&precioMin=10000&precioMax=60000&orden=precioAsc").then()
                .body("anuncios.precio", contains(20000.0f, 50000.0f));
        given().when().get(base + "&orden=precioDesc").then()
                .body("anuncios.precio", contains(100000.0f, 50000.0f, 20000.0f, 3000.0f));
        // Sin acentos ni mayúsculas: «telefono» encuentra «Teléfono»; también busca en atributos.
        given().queryParam("q", w + " TELEFONO").when().get("/api/tianguis/anuncios").then().body("total", equalTo(1));
        given().queryParam("q", w + " italika").when().get("/api/tianguis/anuncios").then().body("total", equalTo(1));
        // Paginación: tamaño máximo 24.
        given().when().get(base + "&size=3&page=1&orden=precioAsc").then()
                .body("total", equalTo(4)).body("paginas", equalTo(2)).body("anuncios", hasSize(1))
                .body("anuncios[0].precio", equalTo(100000.0f));
        given().when().get(base + "&size=500").then().body("tamano", equalTo(24));
        given().when().get(base + "&orden=raro").then().statusCode(400);
    }

    @Test
    void pendienteRechazadoYPausadoNoSeVenNiConLaUrlDirecta() {
        String w = palabra();
        String tel = whatsappNuevo();
        int pendiente = crearDesdePanel(vehiculo("Pendiente " + w, 1, tel), false);
        int rechazado = crearDesdePanel(vehiculo("Rechazado " + w, 1, tel), false);
        estado(rechazado, "RECHAZADO", "Fotos de internet");
        int pausado = crearDesdePanel(vehiculo("Pausado " + w, 1, tel), true);
        estado(pausado, "PAUSADO", null);
        assertTrue(idsPublicos(w).isEmpty());
        for (int id : List.of(pendiente, rechazado, pausado)) {
            given().when().get("/api/tianguis/anuncios/" + id).then().statusCode(404);
        }
    }

    @Test
    void unVendidoSeVeSieteDiasYDespuesYaNo() {
        String w = palabra();
        int id = crearDesdePanel(vehiculo("Vendido " + w, 1, whatsappNuevo()), true);
        int otro = crearDesdePanel(vehiculo("Disponible " + w, 1, whatsappNuevo()), true);
        estado(id, "VENDIDO", null);
        // Los vendidos van al final.
        assertEquals(List.of(otro, id), idsPublicos(w));
        given().when().get("/api/tianguis/anuncios/" + id).then().statusCode(200).body("estado", equalTo("VENDIDO"));
        reloj(HOY.plusDays(8));
        assertEquals(List.of(otro), idsPublicos(w));
        given().when().get("/api/tianguis/anuncios/" + id).then().statusCode(404);
    }

    @Test
    void lasTransicionesDeEstadoSonLasValidas() {
        int id = crearDesdePanel(vehiculo("Transiciones " + palabra(), 1, whatsappNuevo()), false);
        String url = "/api/admin/tianguis/anuncios/" + id + "/estado";
        como(dueno).body(Map.of("estado", "VENDIDO")).when().patch(url).then().statusCode(409);
        como(dueno).body(Map.of("estado", "VENCIDO")).when().patch(url).then().statusCode(409);
        como(dueno).body(Map.of("estado", "RECHAZADO")).when().patch(url).then().statusCode(400);
        como(dueno).body(Map.of("estado", "RECHAZADO", "motivo", "Precio irreal")).when().patch(url).then().statusCode(200)
                .body("motivoRechazo", equalTo("Precio irreal"));
        como(dueno).body(Map.of("estado", "PUBLICADO")).when().patch(url).then().statusCode(200)
                .body("motivoRechazo", nullValue()).body("fechaVencimiento", equalTo("2026-12-19T12:00:00"));
        como(dueno).body(Map.of("estado", "PAUSADO")).when().patch(url).then().statusCode(200).body("pausadoPor", equalTo("ADMIN"));
        como(dueno).body(Map.of("estado", "VENDIDO")).when().patch(url).then().statusCode(200).body("fechaVendido", equalTo("2026-11-19T12:00:00"));
        como(dueno).body(Map.of("estado", "PENDIENTE")).when().patch(url).then().statusCode(409);
        como(dueno).body(Map.of("estado", "INVENTADO")).when().patch(url).then().statusCode(400);
    }

    @Test
    void soloElDuenoYElEncargadoDelTianguisAdministran() {
        given().when().get("/api/admin/tianguis/anuncios").then().statusCode(401);
        String cliente = Clientes.nuevo("Curioso del tianguis");
        como(cliente).when().get("/api/admin/tianguis/anuncios").then().statusCode(oneOf(401, 403));
        String correo = "tianguis" + palabra() + "@sierrasur.local";
        int idEncargado = como(dueno).body(Map.of("telefono", Clientes.telefonoNuevo(), "nombre", "Encargada tianguis",
                        "correo", correo, "contrasena", "clave-segura-1", "negocioSlug", "tianguis"))
                .when().post("/api/admin/usuarios").then().statusCode(201).extract().path("id");
        try {
            String encargada = Sesiones.entrar(correo, "clave-segura-1");
            como(encargada).when().get("/api/admin/tianguis/resumen").then().statusCode(200);
            int id = crearDesdePanelCon(encargada, vehiculo("Encargada " + palabra(), 1, whatsappNuevo()));
            como(encargada).body(Map.of("estado", "PUBLICADO")).when()
                    .patch("/api/admin/tianguis/anuncios/" + id + "/estado").then().statusCode(200);
        } finally {
            como(dueno).body(Map.of("nombre", "Encargada tianguis", "activo", false))
                    .when().put("/api/admin/usuarios/" + idEncargado).then().statusCode(200);
        }
    }

    private int crearDesdePanelCon(String token, Map<String, Object> datos) {
        Map<String, Object> m = new HashMap<>(datos);
        return como(token).body(m).when().post("/api/admin/tianguis/anuncios").then().statusCode(201)
                .extract().path("id");
    }

    @Test
    void vendedoresYCategoriasDesdeElPanel() {
        String tel = whatsappNuevo();
        int v = como(dueno).body(Map.of("nombre", "Doña Lupe", "whatsapp", "(" + tel.substring(0, 3) + ") " + tel.substring(3),
                        "notasInternas", "Vende en el mercado"))
                .when().post("/api/admin/tianguis/vendedores").then().statusCode(201)
                .body("whatsapp", equalTo("52" + tel)).extract().path("id");
        como(dueno).body(Map.of("nombre", "Otra", "whatsapp", "+52 " + tel))
                .when().post("/api/admin/tianguis/vendedores").then().statusCode(409);
        como(dueno).body(Map.of("nombre", "x", "whatsapp", "123")).when().post("/api/admin/tianguis/vendedores").then().statusCode(400);
        como(dueno).body(Map.of("valor", true)).when().put("/api/admin/tianguis/vendedores/" + v + "/verificado").then()
                .statusCode(200).body("verificado", equalTo(true));
        Map<String, Object> m = vehiculo("Con vendedor " + palabra(), 10, tel);
        m.remove("vendedorWhatsapp");
        m.put("vendedorId", v);
        int id = crearDesdePanel(m, true);
        given().when().get("/api/tianguis/anuncios/" + id).then().body("vendedor.verificado", equalTo(true))
                .body("vendedor.nombre", equalTo("Doña Lupe"));

        String slug = "juguetes-" + palabra();
        Map<String, Object> cat = new HashMap<>(Map.of("nombre", "Juguetes", "slug", slug, "orden", 9, "activa", true,
                "campos", List.of(Map.of("nombre", "edad", "etiqueta", "Edad recomendada", "tipo", "TEXTO", "requerido", false))));
        int c = como(dueno).body(cat).when().post("/api/admin/tianguis/categorias").then().statusCode(201).extract().path("id");
        cat.put("campos", List.of(Map.of("nombre", "mala clave", "etiqueta", "X", "tipo", "TEXTO")));
        como(dueno).body(cat).when().put("/api/admin/tianguis/categorias/" + c).then().statusCode(400);
        como(dueno).when().delete("/api/admin/tianguis/categorias/" + c).then().statusCode(204);
    }

    @Test
    void elResumenCuentaPendientesYReportes() {
        long antes = ((Number) como(dueno).when().get("/api/admin/tianguis/resumen").then().extract().path("pendientes")).longValue();
        crearDesdePanel(vehiculo("Pendiente resumen " + palabra(), 1, whatsappNuevo()), false);
        como(dueno).when().get("/api/admin/tianguis/resumen").then().body("pendientes", equalTo((int) antes + 1));
    }
}
