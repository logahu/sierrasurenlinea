package mx.turamohoy.agenda;

import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import io.restassured.specification.RequestSpecification;
import jakarta.inject.Inject;
import jakarta.ws.rs.WebApplicationException;
import mx.turamohoy.admin.Sesiones;
import mx.turamohoy.catalogo.model.Producto;
import mx.turamohoy.clientes.Cliente;
import mx.turamohoy.clientes.Clientes;
import mx.turamohoy.pedidos.Pedido;
import mx.turamohoy.recepcion.CitasRecepcion;
import mx.turamohoy.recepcion.CitasRecepcion.Cita;
import mx.turamohoy.recepcion.CitasRecepcion.Solicitud;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.function.Executable;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.containsString;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** La agenda vista desde la recepcionista de WhatsApp (fase 1): servicios con duración propia y citas por teléfono. */
@QuarkusTest
class CitasRecepcionTest {

    private static final String SLUG = "estudio-melgarejo";
    private static final String EQUIPO = "/api/admin/negocios/" + SLUG + "/equipo";
    // Miércoles de la semana siguiente: no choca con lo que aparta o bloquea AgendaTest.
    private static final String DIA = "2026-11-25";

    @Inject
    CitasRecepcion recepcion;

    private Integer carla;
    private Long largo;

    private static RequestSpecification como(String token) {
        return given().auth().oauth2(token).contentType(ContentType.JSON);
    }

    @BeforeEach
    void lunesNueveYMedia() {
        Agenda.reloj = Clock.fixed(LocalDateTime.of(2026, 11, 16, 9, 30).atZone(Agenda.ZONA).toInstant(), Agenda.ZONA);
    }

    @AfterEach
    void limpiar() {
        Agenda.reloj = Clock.system(Agenda.ZONA);
        if (largo != null) {
            bloques(largo, 1);
        }
        if (carla != null) {
            como(Sesiones.dueno()).body(Map.of("nombre", "x", "activo", false)).when().put(EQUIPO + "/" + carla)
                    .then().statusCode(200);
        }
    }

    private static void bloques(Long productoId, int bloques) {
        QuarkusTransaction.requiringNew().run(() -> Producto.<Producto>findById(productoId).bloquesCita = bloques);
    }

    private static int estado(Executable e) {
        return assertThrows(WebApplicationException.class, e).getResponse().getStatus();
    }

    private Solicitud solicitud(String telefono, List<Long> servicios, String hora, boolean privacidad) {
        return new Solicitud(SLUG, telefono, "Lucía WhatsApp", servicios, DIA, hora, carla.longValue(),
                "Dolor de muela", privacidad);
    }

    private List<String> horasDeCarla(List<Long> servicios) {
        return recepcion.disponibilidad(SLUG, servicios, DIA, 1, carla.longValue()).dias().get(0).horarios()
                .stream().map(Agenda.Horario::hora).toList();
    }

    @Test
    void elBotApartaConsultaYCancelaCitasConSoloElTelefono() {
        String dueno = Sesiones.dueno();
        carla = como(dueno).body(Map.of("nombre", "Carla Recepción", "telefono", Clientes.telefonoNuevo(),
                        "contrasena", "clave-empleado-1", "especialidades", "Cortes"))
                .when().post(EQUIPO).then().statusCode(201).extract().path("id");

        // Los servicios del negocio, con lo que dura cada uno.
        List<CitasRecepcion.Servicio> servicios = recepcion.servicios(SLUG);
        assertFalse(servicios.isEmpty());
        assertTrue(servicios.stream().allMatch(s -> s.minutos() == 60));
        assertTrue(recepcion.profesionales(SLUG).stream().anyMatch(p -> p.nombre().equals("Carla Recepción")));
        Long corto = servicios.get(0).id();
        largo = servicios.get(1).id();

        // Un servicio de 2 bloques: dura 2 horas y la última cita empieza a las 17:00.
        bloques(largo, 2);
        assertEquals(120, recepcion.disponibilidad(SLUG, List.of(largo), DIA, 1, null).duracionMinutos());
        List<String> horas = horasDeCarla(List.of(largo));
        assertEquals("17:00", horas.get(horas.size() - 1));
        assertEquals(180, recepcion.disponibilidad(SLUG, List.of(corto, largo), DIA, 1, null).duracionMinutos());

        // Cliente nuevo: sin aceptar el aviso de privacidad no se aparta.
        String tel = Clientes.telefonoNuevo();
        String deWhatsApp = "521" + tel;
        assertEquals(428, estado(() -> recepcion.reservar(solicitud(deWhatsApp, List.of(largo), "10:00", false))));

        Cita cita = recepcion.reservar(solicitud(deWhatsApp, List.of(largo), "10:00", true));
        assertTrue(cita.cuando().contains("10:00 a 12:00 con Carla Recepción"), cita.cuando());
        assertEquals(Pedido.NUEVO, cita.estado());
        QuarkusTransaction.requiringNew().run(() -> {
            Cliente c = Cliente.porTelefono(tel).orElseThrow();
            assertEquals("WHATSAPP", c.origen);
            assertNull(c.contrasenaHash);
            Pedido p = Pedido.findById(cita.id());
            assertEquals(Pedido.WHATSAPP, p.origen);
            assertEquals(c.id, p.cliente.id);
            assertEquals(2L, CitaBloque.count("pedido", p));
        });
        // Ocupa las dos horas con Carla; la misma hora otra vez ya no.
        assertFalse(horasDeCarla(List.of(corto)).contains("10:00"));
        assertFalse(horasDeCarla(List.of(corto)).contains("11:00"));
        assertEquals(409, estado(() -> recepcion.reservar(solicitud(deWhatsApp, List.of(corto), "11:00", true))));

        // Sus citas, aunque el teléfono venga con otro formato; otro teléfono no las ve.
        assertEquals(List.of(cita.folio()), recepcion.proximas(SLUG, "+52 " + tel).stream().map(Cita::folio).toList());
        assertTrue(recepcion.proximas(SLUG, Clientes.telefonoNuevo()).isEmpty());

        // Solo el dueño de la cita la cancela; la hora vuelve a quedar libre.
        assertEquals(404, estado(() -> recepcion.cancelar(SLUG, Clientes.telefonoNuevo(), cita.folio())));
        assertEquals(Pedido.CANCELADO, recepcion.cancelar(SLUG, tel, cita.folio()).estado());
        assertEquals(409, estado(() -> recepcion.cancelar(SLUG, tel, cita.folio())));
        assertTrue(horasDeCarla(List.of(corto)).contains("10:00"));
        assertTrue(recepcion.proximas(SLUG, tel).isEmpty());

        // Datos que faltan.
        assertEquals(400, estado(() -> recepcion.reservar(solicitud("123", List.of(corto), "10:00", true))));
        assertEquals(400, estado(() -> recepcion.reservar(solicitud(tel, List.of(), "10:00", true))));
        assertEquals(404, estado(() -> recepcion.servicios("no-existe")));
    }

    @Test
    void quienLlegoPorWhatsAppCreaSuContrasenaEnElSitioYSusCitasSumanBloques() {
        String dueno = Sesiones.dueno();
        carla = como(dueno).body(Map.of("nombre", "Carla Recepción", "telefono", Clientes.telefonoNuevo(),
                        "contrasena", "clave-empleado-1"))
                .when().post(EQUIPO).then().statusCode(201).extract().path("id");
        List<CitasRecepcion.Servicio> servicios = recepcion.servicios(SLUG);
        Long corto = servicios.get(0).id();
        largo = servicios.get(1).id();
        bloques(largo, 2);

        String tel = Clientes.telefonoNuevo();
        recepcion.reservar(solicitud(tel, List.of(corto), "15:00", true));

        // Sin contraseña no puede entrar; con «Crear cuenta» la crea y conserva su historial.
        given().contentType(ContentType.JSON).body(Map.of("telefono", tel, "contrasena", "cualquier-cosa"))
                .when().post("/api/clientes/entrar").then().statusCode(401);
        String token = Clientes.registrar("Lucía Web", tel, "clave-cliente-1");
        given().contentType(ContentType.JSON).body(Map.of("nombre", "Otra", "telefono", tel, "contrasena", "clave-cliente-2",
                "aceptaPrivacidad", true)).when().post("/api/clientes/registro").then().statusCode(409);
        QuarkusTransaction.requiringNew().run(() -> {
            Cliente c = Cliente.porTelefono(tel).orElseThrow();
            assertTrue(c.tieneContrasena());
            assertEquals("Lucía Web", c.nombre);
            assertEquals(1L, Pedido.count("cliente", c));
        });

        // En el sitio (cliente probador: el negocio está en pruebas), un servicio de 2 bloques aparta 2 horas.
        Object id = como(dueno).when().get("/api/admin/clientes?q=" + tel).then().extract().path("clientes[0].id");
        como(dueno).body(Map.of("probador", true)).when().put("/api/admin/clientes/" + id + "/probador").then().statusCode(200);
        Map<String, Object> c = new HashMap<>();
        c.put("fecha", DIA);
        c.put("hora", "12:00");
        c.put("empleadoId", carla);
        como(token).body(Map.of("negocio", SLUG, "lineas", List.of(Map.of("productoId", largo, "cantidad", 1)),
                        "mensaje", "Hola, quiero una cita", "cita", c))
                .when().post("/api/pedidos/carrito").then().statusCode(201)
                .body("cuando", containsString("12:00 a 14:00"));
        assertFalse(horasDeCarla(List.of(corto)).contains("13:00"));
    }
}
