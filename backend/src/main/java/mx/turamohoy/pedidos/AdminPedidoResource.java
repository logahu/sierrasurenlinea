package mx.turamohoy.pedidos;

import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response.Status;
import mx.turamohoy.admin.Errores;
import mx.turamohoy.admin.Rol;
import mx.turamohoy.admin.SesionActual;
import mx.turamohoy.admin.Usuario;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Pedidos en el panel. Administrador: todos. Encargado: los de su negocio. Repartidor: los
 * nuevos de su negocio (o, si es general, los de todos los negocios que van a domicilio)
 * y los que él tomó. El panel los consulta cada pocos segundos y
 * las notificaciones push avisan aunque la app esté cerrada.
 */
@Path("/api/admin")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@RolesAllowed({Rol.DUENO, Rol.ENCARGADO, Rol.REPARTIDOR})
public class AdminPedidoResource {

    @Inject
    SesionActual sesion;

    @Inject
    Notificador notificador;

    public record LineaDto(String nombre, int cantidad, BigDecimal precioUnitario, String unidad, BigDecimal subtotal) {
        static LineaDto de(PedidoLinea l) {
            return new LineaDto(l.nombre, l.cantidad, l.precioUnitario, l.unidad, l.subtotal());
        }
    }

    public record PedidoDto(Long id, String folio, String negocioSlug, String negocioNombre, String tipo, String modo,
                            String clienteNombre, String clienteTelefono, String entregar, String zona,
                            BigDecimal totalEstimado, String mensaje, String estado, Long repartidorId,
                            String repartidorNombre, Instant creado, Instant actualizado,
                            String entrega, String cuando, String notas, List<LineaDto> lineas) {
        static PedidoDto de(Pedido p, List<PedidoLinea> lineas) {
            return new PedidoDto(p.id, p.folio, p.negocio.slug, p.negocio.nombre, p.tipo, p.modo, p.clienteNombre,
                    p.clienteTelefono, p.entregar, p.zona, p.totalEstimado, p.mensaje, p.estado,
                    p.repartidor == null ? null : p.repartidor.id,
                    p.repartidor == null ? null : p.repartidor.nombre, p.creado, p.actualizado,
                    p.entrega == null ? Pedido.DOMICILIO : p.entrega, p.cuando, p.notas,
                    lineas.stream().map(LineaDto::de).toList());
        }

        static PedidoDto de(Pedido p) {
            return de(p, PedidoLinea.list("pedido = ?1 order by orden", p));
        }
    }

    public record CambioEstado(@NotBlank String estado) {
    }

    public record Suscripcion(@NotBlank String endpoint, @NotBlank String p256dh, @NotBlank String auth) {
    }

    @GET
    @Path("/pedidos")
    public List<PedidoDto> listar(@QueryParam("activos") @DefaultValue("true") boolean activos) {
        Usuario u = sesion.usuario();
        String estados = activos ? "p.estado in ('NUEVO', 'ACEPTADO', 'EN_CAMINO')" : "p.estado in ('ENTREGADO', 'CANCELADO')";
        String q = "select p from Pedido p join fetch p.negocio left join fetch p.repartidor where " + estados;
        List<Pedido> lista;
        if (u.esDueno()) {
            lista = Pedido.find(q + " order by p.creado desc").page(0, 100).list();
        } else if (Rol.REPARTIDOR.equals(u.rol) && u.negocio == null) {
            // Repartidor general: los pedidos a domicilio de todos los negocios.
            lista = Pedido.find(q + " and (p.entrega is null or p.entrega <> 'RECOGER')"
                    + " and (p.repartidor is null or p.repartidor = ?1) order by p.creado desc", u).page(0, 100).list();
        } else if (Rol.REPARTIDOR.equals(u.rol)) {
            lista = Pedido.find(q + " and p.negocio = ?1 and (p.repartidor is null or p.repartidor = ?2) order by p.creado desc",
                    u.negocio, u).page(0, 100).list();
        } else {
            lista = Pedido.find(q + " and p.negocio = ?1 order by p.creado desc", u.negocio).page(0, 100).list();
        }
        // Los renglones de todos en una sola consulta.
        Map<Long, List<PedidoLinea>> lineas = lista.isEmpty() ? Map.of()
                : PedidoLinea.<PedidoLinea>list("pedido in ?1 order by orden", lista).stream()
                        .collect(Collectors.groupingBy(l -> l.pedido.id));
        return lista.stream().map(p -> PedidoDto.de(p, lineas.getOrDefault(p.id, List.of()))).toList();
    }

    @PUT
    @Path("/pedidos/{id}/estado")
    @Transactional
    public PedidoDto cambiarEstado(@PathParam("id") Long id, @Valid @NotNull CambioEstado c) {
        Usuario u = sesion.usuario();
        Pedido p = Pedido.findById(id);
        boolean general = Rol.REPARTIDOR.equals(u.rol) && u.negocio == null && p != null && p.aDomicilio();
        if (p == null || !(u.esDueno() || general || (u.negocio != null && u.negocio.id.equals(p.negocio.id)))) {
            throw Errores.de(Status.NOT_FOUND, "No existe ese pedido.");
        }
        boolean repartidor = Rol.REPARTIDOR.equals(u.rol);
        if (repartidor && p.repartidor != null && !p.repartidor.id.equals(u.id)) {
            throw Errores.de(Status.CONFLICT, "Ese pedido ya lo tomó " + p.repartidor.nombre + ".");
        }
        String nuevo = c.estado();
        boolean valido = switch (nuevo) {
            case Pedido.ACEPTADO -> Pedido.NUEVO.equals(p.estado)
                    || (repartidor && Pedido.ACEPTADO.equals(p.estado) && p.repartidor == null);
            case Pedido.EN_CAMINO -> Pedido.ACEPTADO.equals(p.estado);
            case Pedido.ENTREGADO -> Pedido.EN_CAMINO.equals(p.estado);
            case Pedido.CANCELADO -> !repartidor && p.activo();
            default -> false;
        };
        if (!valido) {
            throw Errores.de(Status.CONFLICT, "No se puede pasar de " + texto(p.estado) + " a " + texto(nuevo) + ".");
        }
        if (repartidor && p.repartidor == null) {
            p.repartidor = u; // el repartidor que acepta o sale con el pedido se lo queda
        }
        p.estado = nuevo;
        p.actualizado = Instant.now();
        return PedidoDto.de(p);
    }

    // ---------------------------------------------------------------- notificaciones

    @GET
    @Path("/push/clave")
    public java.util.Map<String, String> clave() {
        sesion.usuario();
        return java.util.Map.of("clave", notificador.clavePublica());
    }

    @POST
    @Path("/push")
    @Transactional
    public void suscribir(@Valid @NotNull Suscripcion s) {
        Usuario u = sesion.usuario();
        PushSuscripcion ps = PushSuscripcion.<PushSuscripcion>find("endpoint", s.endpoint()).firstResultOptional()
                .orElseGet(PushSuscripcion::new);
        ps.usuario = u;
        ps.endpoint = s.endpoint();
        ps.p256dh = s.p256dh();
        ps.auth = s.auth();
        ps.creado = Instant.now();
        ps.persist();
    }

    @DELETE
    @Path("/push")
    @Transactional
    public void desuscribir(@Valid @NotNull Suscripcion s) {
        Usuario u = sesion.usuario();
        PushSuscripcion.delete("endpoint = ?1 and usuario = ?2", s.endpoint(), u);
    }

    private static String texto(String estado) {
        return switch (estado) {
            case Pedido.NUEVO -> "nuevo";
            case Pedido.ACEPTADO -> "aceptado";
            case Pedido.EN_CAMINO -> "en camino";
            case Pedido.ENTREGADO -> "entregado";
            case Pedido.CANCELADO -> "cancelado";
            default -> estado;
        };
    }
}
