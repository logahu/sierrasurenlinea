package mx.turamohoy.recepcion;

import io.quarkus.narayana.jta.QuarkusTransaction;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.core.Response.Status;
import mx.turamohoy.admin.Errores;
import mx.turamohoy.admin.Usuario;
import mx.turamohoy.agenda.Agenda;
import mx.turamohoy.agenda.CitaBloque;
import mx.turamohoy.catalogo.model.ModoPedido;
import mx.turamohoy.catalogo.model.Negocio;
import mx.turamohoy.catalogo.model.Producto;
import mx.turamohoy.clientes.Cliente;
import mx.turamohoy.historial.Bitacora;
import mx.turamohoy.pedidos.Notificador;
import mx.turamohoy.pedidos.Pedido;
import mx.turamohoy.pedidos.PedidoLinea;
import mx.turamohoy.pedidos.PedidoResource;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.concurrent.CompletableFuture;

/**
 * La agenda vista desde la recepcionista de WhatsApp: qué servicios hay, qué horarios quedan,
 * apartar, consultar y cancelar citas con solo el teléfono del cliente. No sabe nada de
 * WhatsApp ni de IA: el bot (fases 2 y 3) llama estos métodos y cada uno se vuelve una
 * herramienta del agente.
 *
 * <p>Los errores son {@code WebApplicationException} con un mensaje listo para leerse al cliente
 * («Ese horario se acaba de ocupar. Elige otro.»).
 */
@ApplicationScoped
public class CitasRecepcion {

    @Inject
    Notificador notificador;

    /** Un servicio que se puede agendar, con lo que dura. */
    public record Servicio(Long id, String nombre, BigDecimal precio, String unidadPrecio, int minutos) {
    }

    /** Horarios libres para una cita con estos servicios. */
    public record Disponibilidad(int duracionMinutos, List<Agenda.Dia> dias) {
    }

    /**
     * Lo que pide el cliente por WhatsApp.
     *
     * @param telefono          como llega de WhatsApp (521XXXXXXXXXX, +52…, 10 dígitos)
     * @param aceptoPrivacidad  si ya aceptó el aviso de privacidad en el chat (obligatorio la primera vez)
     * @param empleadoId        con quién; null = cualquiera
     */
    public record Solicitud(String negocio, String telefono, String nombre, List<Long> servicios,
                            String fecha, String hora, Long empleadoId, String notas, boolean aceptoPrivacidad) {
    }

    /** Una cita del cliente. {@code cuando}: «Martes 17 de noviembre, 11:00 a 12:00 con Ana». */
    public record Cita(Long id, String folio, String servicios, String cuando, String estado) {
    }

    /** Servicios del negocio que se pueden agendar. */
    public List<Servicio> servicios(String slug) {
        return QuarkusTransaction.requiringNew().call(() -> {
            Negocio n = conAgenda(slug);
            return Producto.<Producto>list("categoria.negocio = ?1 and disponible = true order by categoria.orden, nombre", n)
                    .stream().map(p -> new Servicio(p.id, p.nombre, p.precio, p.unidadPrecio, n.minutosCita * p.bloquesCita))
                    .toList();
        });
    }

    /** Horarios libres desde {@code desde} (vacío = hoy) por {@code dias} días, para estos servicios. */
    public Disponibilidad disponibilidad(String slug, List<Long> servicios, String desde, int dias, Long empleadoId) {
        return QuarkusTransaction.requiringNew().call(() -> {
            Negocio n = conAgenda(slug);
            int bloques = Agenda.bloquesDe(lineas(n, servicios));
            LocalDate inicio = desde == null || desde.isBlank() ? Agenda.ahora().toLocalDate() : fecha(desde);
            return new Disponibilidad(n.minutosCita * bloques,
                    Agenda.disponibilidad(n, inicio, Math.max(1, Math.min(dias, 14)), bloques, empleadoId));
        });
    }

    /**
     * Aparta la cita. Registra al cliente por su teléfono si es la primera vez (sin contraseña) y
     * guarda la cita como un pedido de origen WHATSAPP, igual que las del sitio: aparece en la
     * agenda del panel y avisa al encargado y a quien atiende.
     */
    public Cita reservar(Solicitud s) {
        String telefono = Cliente.normalizarTelefono(s.telefono());
        if (telefono == null) {
            throw Errores.de(Status.BAD_REQUEST, "El teléfono debe tener 10 dígitos.");
        }
        String nombre = s.nombre() == null ? "" : s.nombre().trim();
        if (nombre.isEmpty() || nombre.length() > 80) {
            throw Errores.de(Status.BAD_REQUEST, "Falta el nombre del cliente.");
        }
        Cita r;
        try {
            r = QuarkusTransaction.requiringNew().call(() -> apartar(s, telefono, nombre));
        } catch (RuntimeException e) {
            if (PedidoResource.choqueDeAgenda(e)) {
                throw Errores.de(Status.CONFLICT, "Ese horario se acaba de ocupar. Elige otro.");
            }
            throw e;
        }
        CompletableFuture.runAsync(() -> notificador.pedidoNuevo(r.id()));
        return r;
    }

    private Cita apartar(Solicitud s, String telefono, String nombre) {
        Negocio n = conAgenda(s.negocio());
        List<PedidoLinea> lineas = lineas(n, s.servicios());
        LocalDate dia = fecha(s.fecha());
        LocalTime hora;
        try {
            hora = LocalTime.parse(s.hora());
        } catch (DateTimeParseException | NullPointerException e) {
            throw Errores.de(Status.BAD_REQUEST, "Hora no válida.");
        }
        Cliente c = cliente(telefono, nombre, s.aceptoPrivacidad());

        Pedido p = new Pedido();
        p.negocio = n;
        p.modo = ModoPedido.CITA;
        p.origen = Pedido.WHATSAPP;
        p.tipo = PedidoResource.tipo(ModoPedido.CITA, lineas);
        p.cliente = c;
        p.prueba = !n.publico() || c.probador;
        p.clienteNombre = nombre;
        p.clienteTelefono = telefono;
        p.entrega = Pedido.RECOGER;
        p.entregar = "Visita al negocio";
        p.cuando = "Lo antes posible";
        String notas = s.notas() == null ? "" : s.notas().trim();
        p.notas = notas.isEmpty() ? null : notas.substring(0, Math.min(500, notas.length()));
        p.totalEstimado = lineas.stream().map(PedidoLinea::subtotal).reduce(BigDecimal.ZERO, BigDecimal::add);
        p.mensaje = "Cita por WhatsApp (recepcionista IA): "
                + String.join(", ", lineas.stream().map(l -> l.nombre).toList());
        p.creado = Instant.now();
        p.actualizado = p.creado;
        p.persistAndFlush();
        p.folio = Pedido.folioDe(n, p.id);
        for (PedidoLinea l : lineas) {
            l.pedido = p;
            l.persist();
        }
        Agenda.apartar(p, dia, hora, s.empleadoId(), Agenda.bloquesDe(lineas));
        CitaBloque.flush();
        Bitacora.anotar(c, n, Bitacora.PEDIDO, p.id, "Apartó la cita " + p.folio + " por WhatsApp", p.cuando);
        return cita(p);
    }

    /** Citas activas del cliente en este negocio, de la más próxima a la más lejana. */
    public List<Cita> proximas(String slug, String telefono) {
        String tel = Cliente.normalizarTelefono(telefono);
        if (tel == null) {
            return List.of();
        }
        return QuarkusTransaction.requiringNew().call(() -> {
            Negocio n = conAgenda(slug);
            return Pedido.<Pedido>list("negocio = ?1 and clienteTelefono = ?2 and citaInicio >= ?3 and estado in ?4"
                            + " order by citaInicio", n, tel, Agenda.ahora(), Pedido.ACTIVOS)
                    .stream().map(CitasRecepcion::cita).toList();
        });
    }

    /** Cancela una cita del cliente (solo las suyas y que sigan activas); la hora queda libre. */
    public Cita cancelar(String slug, String telefono, String folio) {
        String tel = Cliente.normalizarTelefono(telefono);
        return QuarkusTransaction.requiringNew().call(() -> {
            Negocio n = conAgenda(slug);
            Pedido p = tel == null ? null : Pedido.<Pedido>find("negocio = ?1 and folio = ?2 and clienteTelefono = ?3",
                    n, folio, tel).firstResult();
            if (p == null || p.citaInicio == null) {
                throw Errores.de(Status.NOT_FOUND, "No encontré esa cita a tu nombre.");
            }
            if (!p.activo()) {
                throw Errores.de(Status.CONFLICT, "Esa cita ya no está activa.");
            }
            p.estado = Pedido.CANCELADO;
            p.actualizado = Instant.now();
            Agenda.liberar(p);
            if (p.cliente != null) {
                Bitacora.anotar(p.cliente, n, Bitacora.PEDIDO, p.id, "Canceló la cita " + p.folio + " por WhatsApp", p.cuando);
            }
            return cita(p);
        });
    }

    // ---------------------------------------------------------------- Apoyo

    /** Negocio con agenda en línea; también los que están en pruebas (sus citas se marcan como prueba). */
    private static Negocio conAgenda(String slug) {
        return Negocio.visiblePorSlug(slug, true).filter(x -> x.agendaActiva && ModoPedido.CITA.equals(x.modoPedido()))
                .orElseThrow(() -> Errores.de(Status.NOT_FOUND, "Este negocio no tiene agenda en línea."));
    }

    /** Renglones de los servicios pedidos (sin repetir), todos de este negocio y disponibles. */
    private static List<PedidoLinea> lineas(Negocio n, List<Long> servicios) {
        if (servicios == null || servicios.isEmpty()) {
            throw Errores.de(Status.BAD_REQUEST, "Elige al menos un servicio.");
        }
        List<PedidoLinea> r = new ArrayList<>();
        for (Long id : new LinkedHashSet<>(servicios)) {
            Producto prod = id == null ? null : Producto.buscarCompleto(id);
            if (prod == null || !prod.disponible || !prod.categoria.negocio.id.equals(n.id)) {
                throw Errores.de(Status.CONFLICT, "Uno de los servicios ya no está disponible.");
            }
            PedidoLinea l = new PedidoLinea();
            l.producto = prod;
            l.nombre = prod.nombre;
            l.cantidad = 1;
            l.precioUnitario = prod.precio;
            l.unidad = prod.unidadPrecio;
            l.orden = r.size();
            r.add(l);
        }
        return r;
    }

    /**
     * El cliente con ese teléfono; si no existe se registra sin contraseña (origen WHATSAPP), con
     * la aceptación del aviso de privacidad que dio en el chat.
     */
    private static Cliente cliente(String telefono, String nombre, boolean aceptoPrivacidad) {
        Cliente c = Cliente.porTelefono(telefono).orElse(null);
        if (c != null) {
            if (!c.activo) {
                throw Errores.de(Status.FORBIDDEN, "Esta cuenta está desactivada. Comunícate con el negocio.");
            }
            return c;
        }
        if (!aceptoPrivacidad) {
            throw Errores.de(Status.PRECONDITION_REQUIRED, "Antes de apartar, el cliente debe aceptar el aviso de privacidad.");
        }
        Cliente n = new Cliente();
        n.nombre = nombre;
        n.telefono = telefono;
        n.origen = Pedido.WHATSAPP;
        n.privacidadAceptada = Instant.now();
        n.privacidadVersion = mx.turamohoy.clientes.ClienteResource.VERSION_PRIVACIDAD;
        n.creado = n.privacidadAceptada;
        n.persist();
        Bitacora.anotar(n, null, Bitacora.CLIENTE, n.id, "Se registró por WhatsApp", null);
        return n;
    }

    private static LocalDate fecha(String texto) {
        try {
            return LocalDate.parse(texto);
        } catch (DateTimeParseException | NullPointerException e) {
            throw Errores.de(Status.BAD_REQUEST, "Fecha no válida.");
        }
    }

    private static Cita cita(Pedido p) {
        String servicios = String.join(", ", PedidoLinea.<PedidoLinea>list("pedido = ?1 order by orden", p)
                .stream().map(l -> l.nombre).toList());
        return new Cita(p.id, p.folio, servicios, p.cuando, p.estado);
    }

    /** Quién atiende (para que el cliente elija), sin datos privados. */
    public record Profesional(Long id, String nombre, String especialidades) {
    }

    public List<Profesional> profesionales(String slug) {
        return QuarkusTransaction.requiringNew().call(() -> Usuario.profesionalesDe(conAgenda(slug)).stream()
                .map(u -> new Profesional(u.id, u.nombre, u.especialidades)).toList());
    }
}
