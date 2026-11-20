package mx.turamohoy.tianguis;

import io.quarkus.narayana.jta.QuarkusTransaction;
import io.restassured.http.ContentType;
import io.restassured.specification.RequestSpecification;
import jakarta.inject.Inject;
import mx.turamohoy.admin.Sesiones;
import mx.turamohoy.catalogo.model.Negocio;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;

import static io.restassured.RestAssured.given;

/** Lo común de las pruebas del tianguis: lo abre al público, fija el reloj y arma anuncios. */
abstract class BaseTianguis {

    static final LocalDateTime HOY = LocalDateTime.of(2026, 11, 19, 12, 0);
    static final List<String> FOTOS = List.of("img/auto-sedan.svg", "img/auto-pickup.svg", "img/auto-suv.svg");
    private static final AtomicLong SIGUIENTE = new AtomicLong(System.nanoTime() % 1_000_000);

    @Inject
    LimitesTianguis limites;

    @Inject
    TianguisServicio servicio;

    String dueno;

    @BeforeEach
    void abrirTianguis() {
        reloj(HOY);
        limites.reiniciar();
        limites.publicarPorIp = new LimiteVentana(1000, java.time.Duration.ofDays(1));
        limites.porWhatsappAlDia = 1000;
        limites.activosPorVendedor = 1000;
        estadoDelTianguis(Negocio.PUBLICO);
        dueno = Sesiones.dueno();
    }

    @AfterEach
    void cerrarTianguis() {
        estadoDelTianguis(Negocio.PRUEBAS);
        Tianguis.reloj = Clock.system(Tianguis.ZONA);
        limites.publicarPorIp = new LimiteVentana(5, java.time.Duration.ofDays(1));
        limites.porWhatsappAlDia = 3;
        limites.activosPorVendedor = 10;
        limites.reiniciar();
    }

    static void reloj(LocalDateTime t) {
        Tianguis.reloj = Clock.fixed(t.atZone(Tianguis.ZONA).toInstant(), Tianguis.ZONA);
    }

    static void estadoDelTianguis(String estado) {
        QuarkusTransaction.requiringNew().run(() ->
                Negocio.update("estado = ?1 where slug = ?2", estado, Tianguis.SLUG));
    }

    /** Palabra única para que cada prueba encuentre solo sus anuncios. */
    static String palabra() {
        return "zq" + Long.toString(SIGUIENTE.incrementAndGet(), 36) + "x";
    }

    /** 10 dígitos que no se repiten entre pruebas. */
    static String whatsappNuevo() {
        return "95" + String.format("%08d", SIGUIENTE.incrementAndGet() % 100_000_000);
    }

    static RequestSpecification como(String token) {
        return given().auth().oauth2(token).contentType(ContentType.JSON);
    }

    static Map<String, Object> vehiculo(String titulo, Object precio, String whatsapp) {
        Map<String, Object> m = new HashMap<>();
        m.put("categoria", "vehiculos");
        m.put("titulo", titulo);
        m.put("descripcion", "Bien cuidado, papeles en regla.");
        m.put("precio", precio);
        m.put("negociable", true);
        m.put("condicion", "USADO");
        m.put("atributos", new HashMap<>(Map.of("marca", "Nissan", "modelo", "Tsuru", "anio", "2015", "km", "120000",
                "transmision", "manual")));
        m.put("ubicacion", "Centro, Miahuatlán");
        m.put("fotos", FOTOS);
        m.put("vendedorNombre", "Vendedor " + whatsapp.substring(6));
        m.put("vendedorWhatsapp", whatsapp);
        return m;
    }

    /** Alta desde el panel; devuelve el id. */
    int crearDesdePanel(Map<String, Object> datos, boolean publicar) {
        Map<String, Object> m = new HashMap<>(datos);
        m.put("publicar", publicar);
        return como(dueno).body(m).when().post("/api/admin/tianguis/anuncios").then().statusCode(201)
                .extract().path("id");
    }

    void estado(int id, String estado, String motivo) {
        Map<String, Object> m = new HashMap<>();
        m.put("estado", estado);
        m.put("motivo", motivo);
        como(dueno).body(m).when().patch("/api/admin/tianguis/anuncios/" + id + "/estado").then().statusCode(200);
    }

    static List<Integer> idsPublicos(String q) {
        return given().queryParam("q", q).when().get("/api/tianguis/anuncios").then().statusCode(200)
                .extract().path("anuncios.id");
    }
}
