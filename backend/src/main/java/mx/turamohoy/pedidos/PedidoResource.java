package mx.turamohoy.pedidos;

import mx.turamohoy.historial.Bitacora;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.vertx.core.http.HttpServerRequest;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.Response.Status;
import jakarta.annotation.security.RolesAllowed;
import mx.turamohoy.admin.Errores;
import mx.turamohoy.clientes.Cliente;
import mx.turamohoy.clientes.SesionCliente;
import mx.turamohoy.catalogo.model.Negocio;
import mx.turamohoy.catalogo.model.TipoEncargo;
import mx.turamohoy.catalogo.model.TipoNegocio;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import mx.turamohoy.catalogo.model.ModoPedido;
import mx.turamohoy.catalogo.model.Producto;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.time.Instant;
import java.util.concurrent.CompletableFuture;

/**
 * El sitio registra aquí cada pedido (solo clientes con cuenta) antes de abrir WhatsApp. Devuelve el folio, que
 * va en el mensaje; el pedido aparece al momento en el panel y avisa por push al administrador, al encargado
 * del negocio y a sus repartidores (y a los repartidores generales si es a domicilio).
 */
@Path("/api/pedidos")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class PedidoResource {

    @Inject
    Notificador notificador;

    @Inject
    LimitePedidos limite;

    @Inject
    SesionCliente sesionCliente;

    @Context
    HttpServerRequest peticion;

    public record NuevoPedido(
            @NotBlank String negocio,
            @NotBlank @Size(max = 60) String tipo,
            @NotBlank String modo,
            /** Si no se mandan, se usan los de la cuenta del cliente. */
            @Size(max = 80) String nombre,
            String telefono,
            @NotBlank(message = "Falta a dónde lo llevamos.") @Size(max = 300) String entregar,
            @Size(max = 80) String zona,
            @DecimalMin("0") BigDecimal total,
            @NotBlank @Size(max = 4000) String mensaje,
            /** Punto de entrega marcado en el mapa (opcional). */
            Double lat,
            Double lng) {
    }

    public record PedidoRegistrado(Long id, String folio, BigDecimal total) {
    }

    public record LineaPedida(@NotNull Long productoId, @Min(1) @Max(99) int cantidad) {
    }

    /** Pedido con carrito, igual para todos los negocios que venden o rentan. */
    public record PedidoCarrito(
            @NotBlank String negocio,
            @NotEmpty(message = "Tu pedido está vacío.") @Size(max = 30, message = "Máximo 30 productos por pedido.")
            List<@Valid @NotNull LineaPedida> lineas,
            /** DOMICILIO o RECOGER (solo cuenta en compras). */
            String entrega,
            @Size(max = 300) String entregar,
            @Size(max = 120) String cuando,
            @Size(max = 500) String notas,
            boolean mayorDeEdad,
            @Size(max = 80) String nombre,
            String telefono,
            @NotBlank @Size(max = 4000) String mensaje,
            /** Punto de entrega marcado en el mapa (opcional). */
            Double lat,
            Double lng) {
    }

    /** Quién pide: los datos de la cuenta, salvo que mande otro nombre o teléfono. */
    private record Solicitante(Long clienteId, String nombre, String telefono, boolean probador) {
    }

    private Solicitante solicitante(String nombre, String telefono) {
        if (!limite.permitir(ip())) {
            throw Errores.de(429, "Hiciste muchos pedidos seguidos. Espera unos minutos o escríbenos por WhatsApp.");
        }
        Cliente cliente = sesionCliente.cliente();
        String tel = telefono == null || telefono.isBlank() ? cliente.telefono : Cliente.normalizarTelefono(telefono);
        if (tel == null) {
            throw Errores.de(Status.BAD_REQUEST, "El teléfono debe tener 10 dígitos.");
        }
        return new Solicitante(cliente.id, nombre == null || nombre.isBlank() ? cliente.nombre : nombre.trim(), tel,
                cliente.probador);
    }

    /** Encargos de Encarguitos (mandados, viajes y comida). */
    @POST
    @RolesAllowed(SesionCliente.ROL)
    public Response registrar(@Valid @NotNull NuevoPedido req) {
        Solicitante s = solicitante(req.nombre(), req.telefono());
        if (!TipoEncargo.MODOS.contains(req.modo())) {
            throw Errores.de(Status.BAD_REQUEST, "Tipo de encargo no válido.");
        }
        Ubicacion punto = Ubicacion.de(req.lat(), req.lng());
        String nombre = s.nombre();
        String tel = s.telefono();
        Long clienteId = s.clienteId();
        PedidoRegistrado r = QuarkusTransaction.requiringNew().call(() -> {
            Negocio n = Negocio.visiblePorSlug(req.negocio(), s.probador())
                    .filter(x -> x.tipo == TipoNegocio.SERVICIO)
                    .orElseThrow(() -> Errores.de(Status.BAD_REQUEST, "Ese negocio no recibe pedidos en línea."));
            Pedido p = new Pedido();
            p.negocio = n;
            p.tipo = req.tipo().trim();
            p.modo = req.modo();
            p.clienteNombre = nombre;
            p.cliente = Cliente.findById(clienteId);
            p.prueba = s.probador();
            p.clienteTelefono = tel;
            p.entregar = req.entregar().trim();
            p.zona = req.zona() == null || req.zona().isBlank() ? null : req.zona().trim();
            if (punto != null) {
                p.lat = punto.lat();
                p.lng = punto.lng();
            }
            p.totalEstimado = req.total();
            p.mensaje = req.mensaje().trim();
            p.creado = Instant.now();
            p.actualizado = p.creado;
            p.persistAndFlush();
            p.folio = Pedido.folioDe(n, p.id);
            Bitacora.anotar(p.cliente, n, Bitacora.PEDIDO, p.id, "Hizo el pedido " + p.folio + " · " + p.tipo, null);
            return new PedidoRegistrado(p.id, p.folio, p.totalEstimado);
        });
        CompletableFuture.runAsync(() -> notificador.pedidoNuevo(r.id()));
        return Response.status(Status.CREATED).entity(r).build();
    }

    /**
     * Pedido con carrito de cualquier negocio que vende o renta. Los precios y nombres se
     * toman del catálogo (no del navegador) y el total se calcula aquí.
     */
    @POST
    @Path("/carrito")
    @RolesAllowed(SesionCliente.ROL)
    public Response registrarCarrito(@Valid @NotNull PedidoCarrito req) {
        Solicitante s = solicitante(req.nombre(), req.telefono());
        Ubicacion punto = Ubicacion.de(req.lat(), req.lng());
        PedidoRegistrado r = QuarkusTransaction.requiringNew().call(() -> {
            Negocio n = Negocio.visiblePorSlug(req.negocio(), s.probador())
                    .filter(x -> x.modoPedido() != null)
                    .orElseThrow(() -> Errores.de(Status.BAD_REQUEST, "Ese negocio no recibe pedidos con carrito."));
            String modo = n.modoPedido();
            if (n.soloMayoresEdad && !req.mayorDeEdad()) {
                throw Errores.de(Status.BAD_REQUEST, "Confirma que eres mayor de 18 años.");
            }

            // Renglones: mismos productos se suman; todos deben ser de este negocio y estar disponibles.
            Map<Long, Integer> cantidades = new LinkedHashMap<>();
            for (LineaPedida l : req.lineas()) {
                cantidades.merge(l.productoId(), l.cantidad(), Integer::sum);
            }
            List<PedidoLinea> lineas = new ArrayList<>();
            BigDecimal total = BigDecimal.ZERO;
            for (Map.Entry<Long, Integer> e : cantidades.entrySet()) {
                Producto prod = Producto.buscarCompleto(e.getKey());
                if (prod == null || !prod.disponible || !prod.categoria.negocio.id.equals(n.id)) {
                    throw Errores.de(Status.CONFLICT, "Uno de los productos ya no está disponible. Revisa tu pedido.");
                }
                PedidoLinea l = new PedidoLinea();
                l.producto = prod;
                l.nombre = prod.nombre;
                l.cantidad = ModoPedido.CITA.equals(modo) ? 1 : Math.min(e.getValue(), 99);
                l.precioUnitario = prod.precio;
                l.unidad = prod.unidadPrecio;
                l.orden = lineas.size();
                lineas.add(l);
                total = total.add(l.subtotal());
            }

            String entrega = switch (modo) {
                case ModoPedido.RENTA -> Pedido.DOMICILIO;
                case ModoPedido.CITA -> Pedido.RECOGER;
                default -> Pedido.RECOGER.equals(req.entrega()) ? Pedido.RECOGER : Pedido.DOMICILIO;
            };
            String entregar = limpio(req.entregar());
            if (Pedido.DOMICILIO.equals(entrega) && entregar == null) {
                throw Errores.de(Status.BAD_REQUEST, ModoPedido.RENTA.equals(modo)
                        ? "Falta la dirección del evento." : "Falta a dónde lo llevamos.");
            }
            String cuando = limpio(req.cuando());
            if (cuando == null && !ModoPedido.COMPRA.equals(modo)) {
                throw Errores.de(Status.BAD_REQUEST, ModoPedido.RENTA.equals(modo)
                        ? "Falta la fecha del evento." : "Falta el día que quieres venir.");
            }

            Pedido p = new Pedido();
            p.negocio = n;
            p.modo = modo;
            p.tipo = tipo(modo, lineas);
            p.cliente = Cliente.findById(s.clienteId());
            p.prueba = s.probador();
            p.clienteNombre = s.nombre();
            p.clienteTelefono = s.telefono();
            p.entrega = entrega;
            p.entregar = entregar != null ? entregar
                    : ModoPedido.CITA.equals(modo) ? "Visita al negocio" : "Recoge en el negocio";
            p.cuando = cuando != null ? cuando : "Lo antes posible";
            p.notas = limpio(req.notas());
            // El punto en el mapa solo tiene sentido si se lleva a domicilio.
            if (punto != null && Pedido.DOMICILIO.equals(entrega)) {
                p.lat = punto.lat();
                p.lng = punto.lng();
            }
            p.totalEstimado = total;
            p.mensaje = req.mensaje().trim();
            p.creado = Instant.now();
            p.actualizado = p.creado;
            p.persistAndFlush();
            p.folio = Pedido.folioDe(n, p.id);
            for (PedidoLinea l : lineas) {
                l.pedido = p;
                l.persist();
            }
            Bitacora.anotar(p.cliente, n, Bitacora.PEDIDO, p.id, "Hizo el pedido " + p.folio + " · " + p.tipo,
                    "Total aprox.: " + mx.turamohoy.historial.Cambios.texto(total));
            return new PedidoRegistrado(p.id, p.folio, total);
        });
        CompletableFuture.runAsync(() -> notificador.pedidoNuevo(r.id()));
        return Response.status(Status.CREATED).entity(r).build();
    }

    /** Lo que se ve en el panel y en la notificación: "Pedido · 3 productos", "Cita · Pickup 2012". */
    static String tipo(String modo, List<PedidoLinea> lineas) {
        int piezas = lineas.stream().mapToInt(l -> l.cantidad).sum();
        String t = switch (modo) {
            case ModoPedido.CITA -> "Cita · " + lineas.get(0).nombre;
            case ModoPedido.RENTA -> "Renta · " + piezas + (piezas == 1 ? " artículo" : " artículos");
            default -> lineas.size() == 1 && piezas == 1
                    ? "Pedido · " + lineas.get(0).nombre
                    : "Pedido · " + piezas + (piezas == 1 ? " producto" : " productos");
        };
        return t.length() <= 60 ? t : t.substring(0, 59) + "…";
    }

    private static String limpio(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }

    private String ip() {
        if (peticion == null) {
            return null;
        }
        String reenviada = peticion.getHeader("X-Forwarded-For");
        if (reenviada != null && !reenviada.isBlank()) {
            return reenviada.split(",")[0].trim();
        }
        return peticion.remoteAddress() == null ? null : peticion.remoteAddress().host();
    }
}
