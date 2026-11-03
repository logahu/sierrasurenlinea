package mx.turamohoy.catalogo;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.greaterThan;
import static org.hamcrest.Matchers.hasSize;

@QuarkusTest
class CatalogoResourceTest {

    @Test
    void listaCategoriasEnOrden() {
        given().when().get("/api/categorias")
                .then().statusCode(200)
                .body("$", hasSize(5))
                .body("[0].slug", equalTo("ramos"));
    }

    @Test
    void listaTodosLosProductos() {
        given().when().get("/api/productos")
                .then().statusCode(200)
                .body("size()", greaterThan(0));
    }

    @Test
    void filtraProductosPorCategoria() {
        given().queryParam("categoria", "arreglos")
                .when().get("/api/productos")
                .then().statusCode(200)
                .body("$", hasSize(3))
                .body("categoriaSlug", everyItem(equalTo("arreglos")));
    }

    @Test
    void obtieneProductoPorId() {
        given().when().get("/api/productos/1")
                .then().statusCode(200)
                .body("nombre", equalTo("Ramo de 12 rosas rojas"))
                .body("categoriaNombre", equalTo("Ramos"));
    }

    @Test
    void productoInexistenteDevuelve404() {
        given().when().get("/api/productos/9999")
                .then().statusCode(404);
    }
}
