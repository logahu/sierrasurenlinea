package mx.turamohoy.clientes;

import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import mx.turamohoy.historial.Bitacora;
import mx.turamohoy.pedidos.Pedido;
import mx.turamohoy.pedidos.PedidoLinea;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * «Mi historial» del cliente: todos sus pedidos (con filtros y detalle) y la actividad de su
 * cuenta. Lo que hizo el equipo se muestra sin decir quién fue.
 */
@Path("/api/clientes")
@Produces(MediaType.APPLICATION_JSON)
@RolesAllowed(SesionCliente.ROL)
public class HistorialClienteResource {

    static final int PEDIDOS_POR_PAGINA = 20;
    static final int EVENTOS_POR_PAGINA = 30;

    @Inject
    SesionCliente sesion;

    public record LineaCliente(String nombre, int cantidad, BigDecimal subtotal, String persona, String detalle,
                               String nota) {
    }

    public record PedidoHistorial(Long id, String folio, String negocioNombre, String negocioSlug, String tipo,
                                  String modo, String entrega, String entregar, String colonia, String cuando,
                                  BigDecimal totalEstimado, String estado, Instant creado, Instant actualizado,
                                  List<LineaCliente> lineas) {
    }

    public record Conteos(long todos, long enCurso, long entregados, long cancelados) {
    }

    public record HistorialPedidos(List<PedidoHistorial> pedidos, long total, int pagina, int porPagina,
                                   Conteos conteos, BigDecimal totalEntregado) {
    }

    /** quien: TU (lo hizo el cliente) o EQUIPO (alguien del negocio o del sitio). */
    public record Evento(Instant cuando, String quien, String tipo, String texto, String folio) {
    }

    public record Actividad(List<Evento> eventos, boolean hayMas, int pagina, Instant registro) {
    }

    /**
     * @param estado todos | en-curso | entregados | cancelados
     */
    @GET
    @Path("/historial")
    public HistorialPedidos pedidos(@QueryParam("estado") String estado,
                                    @QueryParam("pagina") @DefaultValue("0") int pagina) {
        Cliente c = sesion.cliente();
        String filtro = switch (estado == null ? "" : estado) {
            case "en-curso" -> " and p.estado in ('NUEVO', 'ACEPTADO', 'EN_CAMINO')";
            case "entregados" -> " and p.estado = 'ENTREGADO'";
            case "cancelados" -> " and p.estado = 'CANCELADO'";
            default -> "";
        };
        int p = Math.max(0, pagina);
        List<Pedido> pedidos = Pedido.<Pedido>find(
                        "select p from Pedido p join fetch p.negocio where p.cliente = ?1" + filtro + " order by p.creado desc", c)
                .page(p, PEDIDOS_POR_PAGINA).list();
        long total = Pedido.count("cliente = ?1" + filtro.replace("p.estado", "estado"), c);

        Map<Long, List<LineaCliente>> lineas = pedidos.isEmpty() ? Map.of()
                : PedidoLinea.<PedidoLinea>list("pedido in ?1 order by orden", pedidos).stream()
                        .collect(Collectors.groupingBy(l -> l.pedido.id, Collectors.mapping(
                                l -> new LineaCliente(l.nombre, l.cantidad, l.subtotal(), l.persona, l.detalle, l.nota),
                                Collectors.toList())));

        Object[] n = Pedido.getEntityManager().createQuery("select count(p),"
                        + " coalesce(sum(case when p.estado in ('NUEVO', 'ACEPTADO', 'EN_CAMINO') then 1 else 0 end), 0),"
                        + " coalesce(sum(case when p.estado = 'ENTREGADO' then 1 else 0 end), 0),"
                        + " coalesce(sum(case when p.estado = 'CANCELADO' then 1 else 0 end), 0),"
                        + " coalesce(sum(case when p.estado = 'ENTREGADO' then p.totalEstimado else 0 end), 0)"
                        + " from Pedido p where p.cliente = :c", Object[].class)
                .setParameter("c", c).getSingleResult();

        List<PedidoHistorial> filas = pedidos.stream().map(x -> new PedidoHistorial(x.id, x.folio, x.negocio.nombre,
                x.negocio.slug, x.tipo, x.modo, x.entrega == null ? Pedido.DOMICILIO : x.entrega, x.entregar, x.colonia,
                x.cuando, x.totalEstimado, x.estado, x.creado, x.actualizado, lineas.getOrDefault(x.id, List.of())))
                .toList();
        return new HistorialPedidos(filas, total, p, PEDIDOS_POR_PAGINA,
                new Conteos(numero(n[0]), numero(n[1]), numero(n[2]), numero(n[3])),
                n[4] == null ? BigDecimal.ZERO : new BigDecimal(n[4].toString()));
    }

    /** Lo que pasó en su cuenta y en sus pedidos, del más reciente al más viejo. */
    @GET
    @Path("/actividad")
    public Actividad actividad(@QueryParam("pagina") @DefaultValue("0") int pagina) {
        Cliente c = sesion.cliente();
        int p = Math.max(0, pagina);
        List<Bitacora> registros = Bitacora.<Bitacora>find(
                        "(actorTipo = 'CLIENTE' and actorId = ?1)"
                                + " or (actorTipo <> 'CLIENTE' and entidad = 'CLIENTE' and entidadId = ?1)"
                                + " or (actorTipo <> 'CLIENTE' and entidad = 'PEDIDO'"
                                + "     and entidadId in (select x.id from Pedido x where x.cliente.id = ?1))"
                                + " order by cuando desc, id desc", c.id)
                .page(p, EVENTOS_POR_PAGINA + 1).list();
        boolean hayMas = registros.size() > EVENTOS_POR_PAGINA;
        List<Bitacora> pagina0 = hayMas ? registros.subList(0, EVENTOS_POR_PAGINA) : registros;

        List<Long> ids = pagina0.stream().filter(b -> Bitacora.PEDIDO.equals(b.entidad) && b.entidadId != null)
                .map(b -> b.entidadId).distinct().toList();
        Map<Long, Pedido> pedidos = ids.isEmpty() ? Map.of()
                : Pedido.<Pedido>list("id in ?1", ids).stream().collect(Collectors.toMap(x -> x.id, x -> x));

        List<Evento> eventos = pagina0.stream().map(b -> evento(b, pedidos.get(b.entidadId))).toList();
        return new Actividad(eventos, hayMas, p, c.creado);
    }

    private static final Pattern CAMBIO = Pattern.compile("→\\s*(.+)$");

    /** Lo que se guardó en la bitácora (para el panel), dicho para el cliente. */
    static Evento evento(Bitacora b, Pedido pedido) {
        boolean propio = "CLIENTE".equals(b.actorTipo);
        String folio = pedido == null ? null : pedido.folio;
        String accion = b.accion == null ? "" : b.accion;
        if (Bitacora.PEDIDO.equals(b.entidad)) {
            if (propio) {
                String texto = accion.startsWith("Hizo ") ? "Hiciste " + accion.substring(5) : accion;
                return new Evento(b.cuando, "TU", "PEDIDO", texto, folio);
            }
            Matcher m = CAMBIO.matcher(accion);
            String estado = m.find() ? paraCliente(m.group(1).trim().toLowerCase(), pedido) : null;
            String texto = (folio == null ? "Tu pedido" : "Tu pedido " + folio)
                    + (estado == null ? " se actualizó" : " cambió a «" + estado + "»");
            return new Evento(b.cuando, "EQUIPO", "ESTADO", texto, folio);
        }
        if (propio) {
            String texto = switch (accion) {
                case "Creó su cuenta" -> "Creaste tu cuenta";
                case "Inició sesión" -> "Iniciaste sesión";
                case "Actualizó sus datos" -> "Actualizaste tus datos";
                case "Cambió su contraseña" -> "Cambiaste tu contraseña";
                case "Activó los avisos en un dispositivo" -> "Activaste los avisos en un dispositivo";
                case "Desactivó los avisos en un dispositivo" -> "Desactivaste los avisos en un dispositivo";
                default -> accion;
            };
            return new Evento(b.cuando, "TU", "CUENTA", texto, null);
        }
        String texto;
        if (accion.contains("contraseña nueva")) {
            texto = "El equipo te asignó una contraseña nueva";
        } else if (accion.startsWith("Quitó el acceso")) {
            texto = "Tu cuenta fue desactivada";
        } else if (accion.startsWith("Devolvió el acceso")) {
            texto = "Tu cuenta se volvió a activar";
        } else if (accion.startsWith("Marcó como probador")) {
            texto = "Tu cuenta ahora puede ver los negocios en pruebas";
        } else if (accion.startsWith("Quitó la marca de probador")) {
            texto = "Tu cuenta ya no ve los negocios en pruebas";
        } else {
            texto = "El equipo actualizó tu cuenta";
        }
        return new Evento(b.cuando, "EQUIPO", "CUENTA", texto, null);
    }

    /** Como lo ve el cliente en Mi cuenta (igual que en el sitio). */
    static String paraCliente(String estado, Pedido p) {
        boolean cita = p != null && "CITA".equals(p.modo);
        boolean recoger = p != null && Pedido.RECOGER.equals(p.entrega);
        return switch (estado) {
            case "nuevo" -> cita ? "solicitada" : "recibido";
            case "aceptado" -> cita ? "cita confirmada" : "en preparación";
            case "en camino" -> cita ? "en visita" : recoger ? "listo para recoger" : "en camino";
            case "entregado" -> cita ? "realizada" : "entregado";
            case "cancelado" -> cita ? "cancelada" : "cancelado";
            default -> estado;
        };
    }

    private static long numero(Object o) {
        return o == null ? 0 : ((Number) o).longValue();
    }
}
