package mx.turamohoy.agenda;

import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import io.restassured.path.json.JsonPath;
import io.restassured.specification.RequestSpecification;
import mx.turamohoy.admin.Sesiones;
import mx.turamohoy.clientes.Clientes;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.nullValue;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.startsWith;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

@QuarkusTest
class AgendaTest {

    private static final String SLUG = "estudio-melgarejo";
    private static final String EQUIPO = "/api/admin/negocios/" + SLUG + "/equipo";

    private final List<Integer> empleados = new ArrayList<>();

    private static RequestSpecification como(String token) {
        return given().auth().oauth2(token).contentType(ContentType.JSON);
    }

    @BeforeEach
    void lunesNueveYMedia() {
        // Lunes 16 de noviembre de 2026, 9:30 en Miahuatlán.
        Agenda.reloj = Clock.fixed(LocalDateTime.of(2026, 11, 16, 9, 30).atZone(Agenda.ZONA).toInstant(), Agenda.ZONA);
    }

    @AfterEach
    void limpiar() {
        Agenda.reloj = Clock.system(Agenda.ZONA);
        String dueno = Sesiones.dueno();
        for (Integer id : empleados) {
            como(dueno).body(Map.of("nombre", "x", "activo", false)).when().put(EQUIPO + "/" + id).then().statusCode(200);
        }
    }

    private int empleado(String dueno, String nombre, String tel) {
        int id = como(dueno).body(Map.of("nombre", nombre, "telefono", tel, "contrasena", "clave-empleado-1",
                        "especialidades", "Cortes, barba"))
                .when().post(EQUIPO).then().statusCode(201).body("rol", equalTo("EMPLEADO")).extract().path("id");
        empleados.add(id);
        return id;
    }

    private static Map<String, Object> cita(List<Object> productos, String fecha, String hora, Integer empleado) {
        Map<String, Object> c = new HashMap<>();
        c.put("fecha", fecha);
        c.put("hora", hora);
        c.put("empleadoId", empleado);
        return Map.of("negocio", SLUG, "lineas", productos.stream().map(p -> Map.of("productoId", p, "cantidad", 1)).toList(),
                "mensaje", "Hola, quiero una cita", "cita", c);
    }

    @Test
    void elClienteApartaHorariosLibresYCadaQuienVeSuAgenda() {
        String dueno = Sesiones.dueno();
        String telAna = Clientes.telefonoNuevo();
        int ana = empleado(dueno, "Ana Prueba Agenda", telAna);
        int beto = empleado(dueno, "Beto Prueba Agenda", Clientes.telefonoNuevo());

        // Cliente probador (el negocio está en pruebas).
        String telCliente = Clientes.telefonoNuevo();
        String cliente = Clientes.registrar("Clienta Agenda", telCliente, "clave-cliente-1");
        Object idCliente = como(dueno).when().get("/api/admin/clientes?q=" + telCliente).then().extract().path("clientes[0].id");
        como(dueno).body(Map.of("probador", true)).when().put("/api/admin/clientes/" + idCliente + "/probador").then().statusCode(200);

        List<Object> paquetes = como(cliente).when().get("/api/negocios/" + SLUG + "/productos").then().statusCode(200)
                .extract().jsonPath().getList("id");

        // Hoy de 10 a 18 (la última termina a las 19); el domingo cierra.
        JsonPath d = como(cliente).when().get("/api/negocios/" + SLUG + "/agenda?desde=2026-11-16&dias=7")
                .then().statusCode(200).body("minutosCita", equalTo(60)).extract().jsonPath();
        assertEquals(List.of("10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"),
                d.getList("dias[0].horarios.hora"));
        assertEquals("Hoy", d.getString("dias[0].nombre"));
        assertFalse(d.getBoolean("dias[6].abierto"), "domingo cerrado");
        assertTrue(d.getList("dias[0].horarios[0].libres").containsAll(List.of(ana, beto)));
        // Dos servicios no caben a las 18:00.
        assertEquals("17:00", como(cliente).when().get("/api/negocios/" + SLUG + "/agenda?desde=2026-11-16&dias=1&servicios=2")
                .then().extract().jsonPath().getList("dias[0].horarios.hora").get(8 - 1));

        // Dos paquetes con Ana a las 10: de 10 a 12.
        int p1 = como(cliente).body(cita(paquetes.subList(0, 2), "2026-11-16", "10:00", ana))
                .when().post("/api/pedidos/carrito").then().statusCode(201).extract().path("id");
        JsonPath hoy = como(cliente).when().get("/api/negocios/" + SLUG + "/agenda?desde=2026-11-16&dias=1")
                .then().extract().jsonPath();
        assertEquals(List.of(beto), hoy.getList("dias[0].horarios.find { it.hora == '10:00' }.libres"));
        assertEquals(List.of(beto), hoy.getList("dias[0].horarios.find { it.hora == '11:00' }.libres"));

        // La misma hora con Ana: ocupada. Con cualquiera: le toca a Beto. Otra vez: ya no hay nadie.
        como(cliente).body(cita(paquetes.subList(0, 1), "2026-11-16", "10:00", ana))
                .when().post("/api/pedidos/carrito").then().statusCode(409);
        como(cliente).body(cita(paquetes.subList(0, 1), "2026-11-16", "11:00", null))
                .when().post("/api/pedidos/carrito").then().statusCode(201);
        como(cliente).body(cita(paquetes.subList(0, 1), "2026-11-16", "11:00", null))
                .when().post("/api/pedidos/carrito").then().statusCode(409);
        // Ya pasó, no cabe o está cerrado.
        como(cliente).body(cita(paquetes.subList(0, 1), "2026-11-16", "09:00", null))
                .when().post("/api/pedidos/carrito").then().statusCode(409);
        como(cliente).body(cita(paquetes.subList(0, 2), "2026-11-16", "18:00", null))
                .when().post("/api/pedidos/carrito").then().statusCode(409);
        como(cliente).body(cita(paquetes.subList(0, 1), "2026-11-22", "10:00", null))
                .when().post("/api/pedidos/carrito").then().statusCode(409);
        // Sin elegir horario: no.
        como(cliente).body(Map.of("negocio", SLUG, "lineas", List.of(Map.of("productoId", paquetes.get(0), "cantidad", 1)),
                "mensaje", "Hola", "cuando", "Mañana")).when().post("/api/pedidos/carrito").then().statusCode(400);

        // El encargado (aquí el administrador) ve todas; Ana solo la suya y no ve los pedidos.
        como(dueno).when().get("/api/admin/agenda?negocio=" + SLUG + "&desde=2026-11-16").then().statusCode(200)
                .body("citas", hasSize(2)).body("citas[0].empleadoNombre", equalTo("Ana Prueba Agenda"));
        String tokenAna = Sesiones.entrar(telAna, "clave-empleado-1");
        como(tokenAna).when().get("/api/admin/agenda?desde=2026-11-16").then().statusCode(200)
                .body("soloMias", equalTo(true)).body("citas", hasSize(1))
                .body("citas[0].pedidoId", equalTo(p1)).body("citas[0].servicios", hasSize(2))
                .body("citas[0].inicio", startsWith("2026-11-16T10:00"))
                // Lo que pinta el tablero: color por categoría y horas del horario.
                .body("citas[0].categoria", notNullValue()).body("categorias", hasSize(4))
                .body("horario.'1'", contains("10:00", "19:00")).body("minutosCita", equalTo(60));
        // Su negocio se pide por citas: la agenda es su inicio.
        como(tokenAna).when().get("/api/auth/yo").then().statusCode(200).body("negocioConAgenda", equalTo(true));
        como(tokenAna).when().get("/api/admin/pedidos").then().statusCode(403);
        como(tokenAna).when().get(EQUIPO).then().statusCode(403);

        // Cancelada: la hora vuelve a quedar libre.
        como(dueno).body(Map.of("estado", "CANCELADO")).when().put("/api/admin/pedidos/" + p1 + "/estado").then().statusCode(200);
        assertTrue(como(cliente).when().get("/api/negocios/" + SLUG + "/agenda?desde=2026-11-16&dias=1").then().extract()
                .jsonPath().getList("dias[0].horarios.find { it.hora == '10:00' }.libres").contains(ana));
    }

    @Test
    void elHorarioSeConfiguraDesdeElPanel() {
        String dueno = Sesiones.dueno();
        String base = "/api/admin/agenda/negocios/" + SLUG + "/configuracion";
        Map<String, Object> antes = como(dueno).when().get(base).then().statusCode(200)
                .body("activa", equalTo(true)).body("horario.7", equalTo(null)).extract().as(Map.class);
        Map<String, Object> nuevo = new HashMap<>(antes);
        Map<String, Object> horario = new HashMap<>();
        horario.put("1", List.of("09:00", "14:00"));
        nuevo.put("horario", horario);
        como(dueno).body(nuevo).when().put(base).then().statusCode(200).body("horario.1", equalTo(List.of("09:00", "14:00")))
                .body("horario.2", equalTo(null));
        horario.put("1", List.of("14:00", "09:00"));
        como(dueno).body(nuevo).when().put(base).then().statusCode(400);
        como(dueno).body(antes).when().put(base).then().statusCode(200);
    }

    @Test
    void elEncargadoBloqueaDiasYHorasSinServicio() {
        String dueno = Sesiones.dueno();
        String telAna = Clientes.telefonoNuevo();
        int ana = empleado(dueno, "Ana Bloqueos", telAna);
        int beto = empleado(dueno, "Beto Bloqueos", Clientes.telefonoNuevo());
        String telCliente = Clientes.telefonoNuevo();
        String cliente = Clientes.registrar("Clienta Bloqueos", telCliente, "clave-cliente-1");
        Object idCliente = como(dueno).when().get("/api/admin/clientes?q=" + telCliente).then().extract().path("clientes[0].id");
        como(dueno).body(Map.of("probador", true)).when().put("/api/admin/clientes/" + idCliente + "/probador").then().statusCode(200);
        List<Object> paquetes = como(cliente).when().get("/api/negocios/" + SLUG + "/productos").then().extract().jsonPath().getList("id");
        String base = "/api/admin/agenda/negocios/" + SLUG + "/bloqueos";
        List<Integer> creados = new ArrayList<>();
        try {
            // Martes 17 cerrado todo el día para todos: el cliente lo ve cerrado con el motivo.
            creados.add(como(dueno).body(Map.of("fecha", "2026-11-17", "motivo", "Capacitación"))
                    .when().post(base).then().statusCode(200).body("bloqueo.motivo", equalTo("Capacitación"))
                    .body("afectadas", hasSize(0)).extract().path("bloqueo.id"));
            JsonPath d = como(cliente).when().get("/api/negocios/" + SLUG + "/agenda?desde=2026-11-17&dias=1").then()
                    .statusCode(200).extract().jsonPath();
            assertFalse(d.getBoolean("dias[0].abierto"));
            assertEquals("Capacitación", d.getString("dias[0].aviso"));
            como(cliente).body(cita(paquetes.subList(0, 1), "2026-11-17", "10:00", null))
                    .when().post("/api/pedidos/carrito").then().statusCode(409);

            // Ana sin servicio hoy de 12 a 14: a esas horas solo queda Beto.
            Map<String, Object> soloAna = new HashMap<>(Map.of("fecha", "2026-11-16", "horaInicio", "12:00", "horaFin", "14:00",
                    "empleadoId", ana));
            creados.add(como(dueno).body(soloAna).when().post(base).then().statusCode(200)
                    .body("bloqueo.empleadoId", equalTo(ana)).extract().path("bloqueo.id"));
            JsonPath hoy = como(cliente).when().get("/api/negocios/" + SLUG + "/agenda?desde=2026-11-16&dias=1").then()
                    .extract().jsonPath();
            assertFalse(hoy.getList("dias[0].horarios.find { it.hora == '12:00' }.libres").contains(ana));
            assertTrue(hoy.getList("dias[0].horarios.find { it.hora == '12:00' }.libres").contains(beto));
            assertTrue(hoy.getList("dias[0].horarios.find { it.hora == '14:00' }.libres").contains(ana));
            // Una cita de 2 horas con Ana a las 11 pisaría el bloqueo.
            como(cliente).body(cita(paquetes.subList(0, 2), "2026-11-16", "11:00", ana))
                    .when().post("/api/pedidos/carrito").then().statusCode(409);

            // Ya hay una cita con Beto el miércoles: primero avisa, y con confirmar se guarda y la marca.
            como(cliente).body(cita(paquetes.subList(0, 1), "2026-11-18", "10:00", beto))
                    .when().post("/api/pedidos/carrito").then().statusCode(201);
            Map<String, Object> betoMiercoles = new HashMap<>(Map.of("fecha", "2026-11-18", "empleadoId", beto, "motivo", "Permiso"));
            como(dueno).body(betoMiercoles).when().post(base).then().statusCode(200)
                    .body("bloqueo", nullValue()).body("afectadas", hasSize(1))
                    .body("afectadas[0].clienteNombre", equalTo("Clienta Bloqueos"));
            betoMiercoles.put("confirmar", true);
            creados.add(como(dueno).body(betoMiercoles).when().post(base).then().statusCode(200)
                    .body("bloqueo.citasAfectadas", equalTo(1)).extract().path("bloqueo.id"));
            como(dueno).when().get("/api/admin/agenda?negocio=" + SLUG + "&desde=2026-11-18").then().statusCode(200)
                    .body("citas.find { it.empleadoId == " + beto + " }.sinServicio", equalTo(true))
                    .body("bloqueos", hasSize(1)).body("bloqueos[0].motivo", equalTo("Permiso"));
            como(dueno).when().get(base).then().statusCode(200).body("size()", equalTo(3));

            // Ya pasó o el orden está al revés: no. El empleado no puede bloquear, pero ve los suyos.
            como(dueno).body(Map.of("fecha", "2026-11-16", "horaInicio", "08:00", "horaFin", "09:00")).when().post(base)
                    .then().statusCode(400);
            como(dueno).body(Map.of("fecha", "2026-11-20", "horaInicio", "15:00", "horaFin", "11:00")).when().post(base)
                    .then().statusCode(400);
            String tokenAna = Sesiones.entrar(telAna, "clave-empleado-1");
            como(tokenAna).body(Map.of("fecha", "2026-11-20")).when().post(base).then().statusCode(403);
            como(tokenAna).when().get("/api/admin/agenda?desde=2026-11-16&dias=3").then().statusCode(200)
                    .body("bloqueos", hasSize(2));

            // Quitarlo vuelve a abrir el martes.
            como(dueno).when().delete(base + "/" + creados.remove(0)).then().statusCode(204);
            assertTrue(como(cliente).when().get("/api/negocios/" + SLUG + "/agenda?desde=2026-11-17&dias=1").then()
                    .extract().jsonPath().getBoolean("dias[0].abierto"));
        } finally {
            for (Integer id : creados) {
                como(dueno).when().delete(base + "/" + id);
            }
        }
    }
}
