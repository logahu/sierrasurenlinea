package mx.turamohoy.catalogo;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.greaterThan;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasSize;

@QuarkusTest
class CatalogoResourceTest {

    @Test
    void listaNegociosEnOrden() {
        given().when().get("/api/negocios")
                .then().statusCode(200)
                .body("slug", contains("turamohoy", "cosmeticos", "inflables", "vinateria"))
                .body("[0].whatsapp", equalTo("5219510000000"))
                .body("[0].categorias", empty());
    }

    @Test
    void detalleDeNegocioIncluyeCategoriasYContacto() {
        given().when().get("/api/negocios/inflables")
                .then().statusCode(200)
                .body("nombre", equalTo("Renta de Inflables"))
                .body("tipo", equalTo("RENTA"))
                .body("categorias.slug", contains("brincolines", "toboganes", "mobiliario"));
    }

    @Test
    void vinateriaEsSoloParaMayoresDeEdad() {
        given().when().get("/api/negocios/vinateria")
                .then().statusCode(200)
                .body("soloMayoresEdad", equalTo(true));
    }

    @Test
    void negocioInexistenteDevuelve404() {
        given().when().get("/api/negocios/no-existe").then().statusCode(404);
        given().when().get("/api/negocios/no-existe/productos").then().statusCode(404);
    }

    @Test
    void productosDeUnNegocio() {
        given().when().get("/api/negocios/turamohoy/productos")
                .then().statusCode(200)
                .body("$", hasSize(15))
                .body("negocioSlug", everyItem(equalTo("turamohoy")));
    }

    @Test
    void filtraProductosDelNegocioPorCategoria() {
        given().queryParam("categoria", "arreglos")
                .when().get("/api/negocios/turamohoy/productos")
                .then().statusCode(200)
                .body("$", hasSize(3))
                .body("categoriaSlug", everyItem(equalTo("arreglos")));
    }

    @Test
    void productosDeRentaTraenUnidadYCaracteristicas() {
        given().when().get("/api/productos/23")
                .then().statusCode(200)
                .body("nombre", equalTo("Brincolín castillo"))
                .body("unidadPrecio", equalTo("por día"))
                .body("caracteristicas", hasSize(3))
                .body("caracteristicas", hasItem("Medidas: 4 × 4 m"))
                .body("negocioSlug", equalTo("inflables"));
    }

    @Test
    void productoDeVentaSinCaracteristicasDevuelveListaVacia() {
        given().when().get("/api/productos/1")
                .then().statusCode(200)
                .body("nombre", equalTo("Ramo de 12 rosas rojas"))
                .body("categoriaNombre", equalTo("Ramos"))
                .body("negocioNombre", equalTo("TuRamoHoy"))
                .body("caracteristicas", empty());
    }

    @Test
    void listaTodosLosProductosYCategorias() {
        given().when().get("/api/productos")
                .then().statusCode(200)
                .body("size()", greaterThan(30));
        given().when().get("/api/categorias")
                .then().statusCode(200)
                .body("$", hasSize(16))
                .body("[0].negocioSlug", equalTo("turamohoy"));
    }

    @Test
    void productoInexistenteDevuelve404() {
        given().when().get("/api/productos/9999")
                .then().statusCode(404);
    }
}
