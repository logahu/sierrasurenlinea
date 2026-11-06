package mx.turamohoy.admin;

import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import io.restassured.specification.RequestSpecification;
import mx.turamohoy.catalogo.model.Categoria;
import mx.turamohoy.catalogo.model.Producto;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.greaterThanOrEqualTo;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.junit.jupiter.api.Assertions.assertEquals;

@QuarkusTest
class CatalogoAdminTest {

    private static RequestSpecification como(String token) {
        return given().auth().oauth2(token).contentType(ContentType.JSON);
    }

    private static Map<String, Object> producto(String nombre, Object precio, Number categoriaId) {
        Map<String, Object> m = new HashMap<>();
        m.put("nombre", nombre);
        m.put("descripcion", "  Hecho a mano  ");
        m.put("precio", precio);
        m.put("unidadPrecio", "");
        m.put("caracteristicas", List.of("Tallos: 12", " ", "Con | tarjeta"));
        m.put("categoriaId", categoriaId);
        m.put("destacado", false);
        return m;
    }

    /** Las pruebas no deben dejar datos que cambien los conteos de otras pruebas. */
    private static void borrar(Number productoId, Number categoriaId) {
        QuarkusTransaction.requiringNew().run(() -> {
            if (productoId != null) {
                Producto.delete("id", productoId.longValue());
            }
            if (categoriaId != null) {
                Categoria.delete("id", categoriaId.longValue());
            }
        });
    }

    @Test
    void altaDeCategoriaYProductoQueSeVeEnElSitio() {
        String dueno = Sesiones.dueno();
        Integer categoriaId = null;
        Integer productoId = null;
        try {
            categoriaId = como(dueno).body(Map.of("nombre", "Arreglos de Temporada"))
                    .when().post("/api/admin/negocios/turamohoy/categorias")
                    .then().statusCode(201)
                    .body("slug", equalTo("arreglos-de-temporada"))
                    .body("orden", greaterThanOrEqualTo(1))
                    .extract().path("id");
            // Mismo nombre: otro slug, no choca.
            Integer otra = como(dueno).body(Map.of("nombre", "Arreglos de temporada"))
                    .when().post("/api/admin/negocios/turamohoy/categorias")
                    .then().statusCode(201).body("slug", equalTo("arreglos-de-temporada-2"))
                    .extract().path("id");
            borrar(null, otra);

            productoId = como(dueno).body(producto("Ramo de cempasúchil", 350, categoriaId))
                    .when().post("/api/admin/negocios/turamohoy/productos")
                    .then().statusCode(201)
                    .body("descripcion", equalTo("Hecho a mano"))
                    .body("unidadPrecio", equalTo(null))
                    .body("caracteristicas", equalTo(List.of("Tallos: 12", "Con / tarjeta")))
                    .body("disponible", equalTo(true))
                    .body("imagenUrl", not(equalTo(null)))
                    .extract().path("id");

            given().when().get("/api/negocios/turamohoy/productos?categoria=arreglos-de-temporada")
                    .then().statusCode(200)
                    .body("nombre", hasItem("Ramo de cempasúchil"));

            // Ocultarlo lo quita del sitio, pero el panel lo sigue mostrando.
            como(dueno).body(Map.of("disponible", false))
                    .when().put("/api/admin/negocios/turamohoy/productos/" + productoId + "/disponible")
                    .then().statusCode(200).body("disponible", equalTo(false));
            given().when().get("/api/productos/" + productoId).then().statusCode(404);
            como(dueno).when().get("/api/admin/negocios/turamohoy/productos")
                    .then().statusCode(200).body("id", hasItem(productoId));

            // Editar precio y nombre.
            Map<String, Object> cambios = producto("Ramo de cempasúchil grande", "420.50", categoriaId);
            cambios.put("disponible", true);
            cambios.put("destacado", true);
            como(dueno).body(cambios)
                    .when().put("/api/admin/negocios/turamohoy/productos/" + productoId)
                    .then().statusCode(200)
                    .body("precio", equalTo(420.5f))
                    .body("destacado", equalTo(true))
                    .body("disponible", equalTo(true));
            given().when().get("/api/productos/" + productoId)
                    .then().statusCode(200).body("nombre", equalTo("Ramo de cempasúchil grande"));
        } finally {
            borrar(productoId, categoriaId);
        }
    }

    @Test
    void validaPrecioYCategoria() {
        String dueno = Sesiones.dueno();
        Integer categoriaDeOtro = como(dueno).when().get("/api/admin/negocios/belleza/categorias")
                .then().statusCode(200).extract().path("[0].id");
        Integer categoria = como(dueno).when().get("/api/admin/negocios/turamohoy/categorias")
                .then().statusCode(200).extract().path("[0].id");

        como(dueno).body(producto("Negativo", -1, categoria))
                .when().post("/api/admin/negocios/turamohoy/productos")
                .then().statusCode(400);
        como(dueno).body(producto("Tres decimales", "10.123", categoria))
                .when().post("/api/admin/negocios/turamohoy/productos")
                .then().statusCode(400);
        como(dueno).body(producto("Categoría ajena", 10, categoriaDeOtro))
                .when().post("/api/admin/negocios/turamohoy/productos")
                .then().statusCode(400)
                .body("mensaje", containsString("no es de"));
        // Un producto de otro negocio no se edita por la ruta de este.
        Integer productoDeOtro = como(dueno).when().get("/api/admin/negocios/belleza/productos")
                .then().extract().path("[0].id");
        como(dueno).when().get("/api/admin/negocios/turamohoy/productos/" + productoDeOtro)
                .then().statusCode(404);
    }

    @Test
    void elEncargadoSoloEditaElCatalogoDeSuNegocio() {
        String dueno = Sesiones.dueno();
        int id = como(dueno)
                .body(Map.of("nombre", "Encargada inflables", "correo", "inflables@sierrasur.local",
                        "contrasena", "clave-segura-1", "negocioSlug", "inflables"))
                .when().post("/api/admin/usuarios").then().statusCode(201).extract().path("id");
        try {
            String encargado = Sesiones.entrar("inflables@sierrasur.local", "clave-segura-1");
            como(encargado).when().get("/api/admin/negocios/inflables/productos").then().statusCode(200);
            como(encargado).when().get("/api/admin/negocios/turamohoy/productos").then().statusCode(403);
            como(encargado).body(Map.of("nombre", "Intrusa"))
                    .when().post("/api/admin/negocios/turamohoy/categorias").then().statusCode(403);

            // Ocultar y volver a mostrar uno de los suyos.
            Integer suyo = como(encargado).when().get("/api/admin/negocios/inflables/productos")
                    .then().extract().path("[0].id");
            como(encargado).body(Map.of("disponible", false))
                    .when().put("/api/admin/negocios/inflables/productos/" + suyo + "/disponible")
                    .then().statusCode(200);
            como(encargado).body(Map.of("disponible", true))
                    .when().put("/api/admin/negocios/inflables/productos/" + suyo + "/disponible")
                    .then().statusCode(200).body("disponible", equalTo(true));
        } finally {
            como(dueno).body(Map.of("nombre", "Encargada inflables", "activo", false))
                    .when().put("/api/admin/usuarios/" + id).then().statusCode(200);
        }
    }

    @Test
    void elTopeDeAdelantoSeEditaEnEncarguitos() {
        String dueno = Sesiones.dueno();
        given().when().get("/api/negocios/encarguitos").then().statusCode(200).body("topeAdelanto", equalTo(500));
        @SuppressWarnings("unchecked")
        Map<String, Object> datos = new HashMap<>(como(dueno).when().get("/api/admin/negocios/encarguitos")
                .then().statusCode(200).extract().as(Map.class));
        try {
            datos.put("topeAdelanto", 800);
            como(dueno).body(datos).when().put("/api/admin/negocios/encarguitos")
                    .then().statusCode(200).body("topeAdelanto", equalTo(800));
            given().when().get("/api/negocios/encarguitos").then().body("topeAdelanto", equalTo(800));
            datos.put("topeAdelanto", -5);
            como(dueno).body(datos).when().put("/api/admin/negocios/encarguitos").then().statusCode(400);
        } finally {
            datos.put("topeAdelanto", 500);
            como(dueno).body(datos).when().put("/api/admin/negocios/encarguitos").then().statusCode(200);
        }
    }

    @Test
    void slugsLegibles() {
        assertEquals("ramos-y-arreglos", AdminCatalogoResource.slug("  Ramos y Arreglos! "));
        assertEquals("nino-feliz", AdminCatalogoResource.slug("Niño feliz"));
        assertEquals("categoria", AdminCatalogoResource.slug("¡¡!!"));
    }
}
