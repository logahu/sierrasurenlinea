package mx.turamohoy.tablero;

import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import mx.turamohoy.admin.Rol;
import mx.turamohoy.admin.SesionActual;
import mx.turamohoy.admin.Usuario;
import mx.turamohoy.catalogo.model.Negocio;
import mx.turamohoy.catalogo.model.Producto;
import mx.turamohoy.catalogo.model.VisitaDia;
import mx.turamohoy.pedidos.Pedido;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Tablero del panel: visitas y pedidos de los últimos días. El administrador ve todo
 * (y puede elegir un negocio); el encargado ve solo su negocio.
 */
@Path("/api/admin/tablero")
@Produces(MediaType.APPLICATION_JSON)
@RolesAllowed({Rol.DUENO, Rol.ENCARGADO})
public class TableroResource {

    static final Set<Integer> PERIODOS = Set.of(7, 30, 90);
    private static final Pattern PRODUCTO = Pattern.compile("^/([a-z0-9-]+)/producto/(\\d+)$");

    @Inject
    SesionActual sesion;

    public record Dia(LocalDate dia, long visitas, long pedidos) {
    }

    public record PorNegocio(String slug, String nombre, String color, long visitas, long pedidos,
                             long entregados, BigDecimal ventas) {
    }

    public record ProductoVisto(Long id, String nombre, String negocioSlug, String negocioNombre, long visitas) {
    }

    public record Pagina(String ruta, long visitas) {
    }

    public record Tablero(int dias, LocalDate desde, LocalDate hasta, long visitas, long visitasPrevias,
                          long pedidos, long pedidosPrevios, long entregados, long cancelados, BigDecimal ventas,
                          List<Dia> serie, List<PorNegocio> negocios, List<ProductoVisto> productos,
                          List<Pagina> paginas) {
    }

    /**
     * @param dias    7, 30 o 90
     * @param negocio slug para ver un solo negocio (el encargado siempre ve el suyo)
     */
    @GET
    @Transactional
    public Tablero ver(@QueryParam("dias") @DefaultValue("30") int dias, @QueryParam("negocio") String negocio) {
        Usuario u = sesion.usuario();
        int n = PERIODOS.contains(dias) ? dias : 30;
        Negocio solo = !u.esDueno() ? u.negocio
                : negocio == null || negocio.isBlank() ? null : Negocio.porSlug(negocio).orElse(null);

        LocalDate hasta = VisitaDia.hoy();
        LocalDate desde = hasta.minusDays(n - 1L);
        LocalDate previoDesde = desde.minusDays(n);

        // --- Visitas ---------------------------------------------------------------------
        List<VisitaDia> filas = VisitaDia.list("dia >= ?1", previoDesde);
        Map<LocalDate, Long> visitasPorDia = new HashMap<>();
        Map<String, Long> visitasPorRuta = new HashMap<>();
        long visitasPrevias = 0;
        for (VisitaDia v : filas) {
            if (solo != null && !deNegocio(v.ruta, solo.slug)) {
                continue;
            }
            if (v.dia.isBefore(desde)) {
                visitasPrevias += v.total;
            } else {
                visitasPorDia.merge(v.dia, v.total, Long::sum);
                visitasPorRuta.merge(v.ruta, v.total, Long::sum);
            }
        }

        // --- Pedidos ---------------------------------------------------------------------
        Instant inicio = desde.atStartOfDay(VisitaDia.ZONA).toInstant();
        Instant inicioPrevio = previoDesde.atStartOfDay(VisitaDia.ZONA).toInstant();
        List<Pedido> pedidos = solo == null
                ? Pedido.list("creado >= ?1", inicioPrevio)
                : Pedido.list("creado >= ?1 and negocio = ?2", inicioPrevio, solo);
        Map<LocalDate, Long> pedidosPorDia = new HashMap<>();
        long pedidosPrevios = 0;
        long total = 0;
        long entregados = 0;
        long cancelados = 0;
        BigDecimal ventas = BigDecimal.ZERO;
        Map<Long, long[]> conteoNegocio = new HashMap<>(); // [pedidos, entregados]
        Map<Long, BigDecimal> ventasNegocio = new HashMap<>();
        for (Pedido p : pedidos) {
            if (p.creado.isBefore(inicio)) {
                pedidosPrevios++;
                continue;
            }
            total++;
            pedidosPorDia.merge(p.creado.atZone(VisitaDia.ZONA).toLocalDate(), 1L, Long::sum);
            long[] c = conteoNegocio.computeIfAbsent(p.negocio.id, k -> new long[2]);
            c[0]++;
            if (Pedido.CANCELADO.equals(p.estado)) {
                cancelados++;
                continue;
            }
            if (Pedido.ENTREGADO.equals(p.estado)) {
                entregados++;
                c[1]++;
            }
            if (p.totalEstimado != null) {
                ventas = ventas.add(p.totalEstimado);
                ventasNegocio.merge(p.negocio.id, p.totalEstimado, BigDecimal::add);
            }
        }

        List<Dia> serie = new ArrayList<>();
        for (LocalDate d = desde; !d.isAfter(hasta); d = d.plusDays(1)) {
            serie.add(new Dia(d, visitasPorDia.getOrDefault(d, 0L), pedidosPorDia.getOrDefault(d, 0L)));
        }

        // --- Por negocio ---------------------------------------------------------------
        List<Negocio> negocios = solo != null ? List.of(solo) : Negocio.list("order by orden, nombre");
        Map<String, Long> visitasNegocio = new HashMap<>();
        visitasPorRuta.forEach((ruta, v) -> {
            String slug = primerSegmento(ruta);
            if (slug != null) {
                visitasNegocio.merge(slug, v, Long::sum);
            }
        });
        List<PorNegocio> porNegocio = negocios.stream()
                .map(x -> {
                    long[] c = conteoNegocio.getOrDefault(x.id, new long[2]);
                    return new PorNegocio(x.slug, x.nombre, x.colorPrimario, visitasNegocio.getOrDefault(x.slug, 0L),
                            c[0], c[1], ventasNegocio.getOrDefault(x.id, BigDecimal.ZERO));
                })
                .sorted(Comparator.comparingLong(PorNegocio::visitas).reversed())
                .toList();

        // --- Productos y páginas más vistos ----------------------------------------------
        Map<Long, Long> visitasProducto = new LinkedHashMap<>();
        List<Pagina> paginas = new ArrayList<>();
        visitasPorRuta.forEach((ruta, v) -> {
            Matcher m = PRODUCTO.matcher(ruta);
            if (m.matches()) {
                visitasProducto.merge(Long.parseLong(m.group(2)), v, Long::sum);
            } else {
                paginas.add(new Pagina(ruta, v));
            }
        });
        List<Long> top = visitasProducto.entrySet().stream()
                .sorted(Map.Entry.<Long, Long>comparingByValue().reversed())
                .limit(10).map(Map.Entry::getKey).toList();
        Map<Long, Producto> productos = new HashMap<>();
        if (!top.isEmpty()) {
            Producto.<Producto>list("select p from Producto p join fetch p.categoria c join fetch c.negocio where p.id in ?1", top)
                    .forEach(p -> productos.put(p.id, p));
        }
        List<ProductoVisto> vistos = top.stream().filter(productos::containsKey).map(id -> {
            Producto p = productos.get(id);
            return new ProductoVisto(id, p.nombre, p.categoria.negocio.slug, p.categoria.negocio.nombre,
                    visitasProducto.get(id));
        }).toList();
        paginas.sort(Comparator.comparingLong(Pagina::visitas).reversed());

        long visitas = visitasPorDia.values().stream().mapToLong(Long::longValue).sum();
        return new Tablero(n, desde, hasta, visitas, visitasPrevias, total, pedidosPrevios, entregados, cancelados,
                ventas, serie, porNegocio, vistos, paginas.stream().limit(10).toList());
    }

    /** "/turamohoy/producto/5" → "turamohoy"; "/" → null. */
    static String primerSegmento(String ruta) {
        if (ruta == null || ruta.length() < 2) {
            return null;
        }
        int fin = ruta.indexOf('/', 1);
        return fin < 0 ? ruta.substring(1) : ruta.substring(1, fin);
    }

    static boolean deNegocio(String ruta, String slug) {
        return ruta.equals("/" + slug) || ruta.startsWith("/" + slug + "/");
    }
}
