package mx.turamohoy.clientes;

import jakarta.annotation.security.RolesAllowed;
import jakarta.transaction.Transactional;
import jakarta.validation.constraints.NotNull;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response.Status;
import mx.turamohoy.admin.Errores;
import mx.turamohoy.admin.Rol;
import mx.turamohoy.pedidos.Pedido;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/** Clientes registrados, vistos por el administrador. Solo baja lógica (quitar acceso). */
@Path("/api/admin/clientes")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@RolesAllowed(Rol.DUENO)
public class AdminClienteResource {

    @jakarta.inject.Inject
    mx.turamohoy.admin.SesionActual sesion;

    public record ClienteAdminDto(Long id, String nombre, String telefono, String correo, String direccion,
                                  boolean activo, Instant creado, Instant ultimoAcceso, long pedidos, boolean probador, boolean dePrueba) {
    }

    public record Probador(boolean probador) {
    }

    /** Marca o desmarca a un cliente como probador (ve los negocios en pruebas). */
    @PUT
    @Path("/{id}/probador")
    @Transactional
    public ClienteAdminDto cambiarProbador(@PathParam("id") Long id, @NotNull Probador p) {
        Cliente c = Cliente.findById(id);
        if (c == null) {
            throw Errores.de(Status.NOT_FOUND, "No existe ese cliente.");
        }
        if (c.probador != p.probador()) {
            mx.turamohoy.historial.Bitacora.anotar(sesion.usuario(), null, mx.turamohoy.historial.Bitacora.CLIENTE, c.id,
                    (p.probador() ? "Marcó como probador a " : "Quitó la marca de probador a ") + c.nombre, c.telefono);
        }
        c.probador = p.probador();
        return new ClienteAdminDto(c.id, c.nombre, c.telefono, c.correo, c.direccion, c.activo, c.creado,
                c.ultimoAcceso, Pedido.count("cliente", c), c.probador, c.dePrueba);
    }

    public record Activo(boolean activo) {
    }

    public record NuevaContrasena(@jakarta.validation.constraints.NotBlank String nueva) {
    }

    /**
     * El administrador pone una contraseña nueva a un cliente que la olvidó (después de
     * confirmar por teléfono o WhatsApp que es él) y le quita el bloqueo por intentos.
     */
    @PUT
    @Path("/{id}/contrasena")
    @Transactional
    public void reiniciarContrasena(@PathParam("id") Long id, @jakarta.validation.Valid @NotNull NuevaContrasena r) {
        Cliente c = Cliente.findById(id);
        if (c == null) {
            throw Errores.de(Status.NOT_FOUND, "No existe ese cliente.");
        }
        mx.turamohoy.admin.Contrasenas.validarNueva(r.nueva());
        c.contrasenaHash = mx.turamohoy.admin.Contrasenas.cifrar(r.nueva());
        c.intentosFallidos = 0;
        c.bloqueadoHasta = null;
        mx.turamohoy.historial.Bitacora.anotar(sesion.usuario(), null, mx.turamohoy.historial.Bitacora.CLIENTE, c.id,
                "Puso una contraseña nueva al cliente " + c.nombre, c.telefono);
    }

    static final int POR_PAGINA = 25;

    /** Cuántos hay en cada grupo (para los botones de filtro). */
    public record Conteos(long todos, long probadores, long dePrueba, long sinAcceso) {
    }

    public record PaginaClientes(List<ClienteAdminDto> clientes, long total, int pagina, int porPagina,
                                 Conteos conteos) {
    }

    /**
     * Clientes con filtros, de {@value #POR_PAGINA} en {@value #POR_PAGINA}.
     *
     * @param q       nombre, teléfono o correo
     * @param grupo   todos | probadores | prueba | sin-acceso (por omisión, todos menos los de prueba)
     * @param pedidos con | sin
     * @param orden   recientes (alta) | visita | nombre | pedidos
     */
    @GET
    public PaginaClientes listar(@QueryParam("q") String q, @QueryParam("grupo") String grupo,
                                 @QueryParam("pedidos") String pedidos, @QueryParam("orden") String orden,
                                 @QueryParam("pagina") @jakarta.ws.rs.DefaultValue("0") int pagina) {
        StringBuilder donde = new StringBuilder(" where 1 = 1");
        Map<String, Object> params = new java.util.HashMap<>();
        String texto = q == null ? "" : q.trim().toLowerCase();
        if (!texto.isEmpty()) {
            String digitos = texto.replaceAll("\\D", "");
            donde.append(" and (lower(c.nombre) like :t or lower(coalesce(c.correo, '')) like :t");
            if (!digitos.isEmpty()) {
                donde.append(" or c.telefono like :d");
                params.put("d", "%" + digitos + "%");
            }
            donde.append(")");
            params.put("t", "%" + texto + "%");
        }
        String base = donde.toString();
        switch (grupo == null ? "" : grupo) {
            case "probadores" -> donde.append(" and c.probador = true");
            case "prueba" -> donde.append(" and c.dePrueba = true");
            case "sin-acceso" -> donde.append(" and c.activo = false");
            case "todos" -> { }
            default -> donde.append(" and c.dePrueba = false");
        }
        String cuenta = "(select count(p) from Pedido p where p.cliente = c)";
        if ("con".equals(pedidos)) {
            donde.append(" and ").append(cuenta).append(" > 0");
        } else if ("sin".equals(pedidos)) {
            donde.append(" and ").append(cuenta).append(" = 0");
        }
        String ordenar = switch (orden == null ? "" : orden) {
            case "visita" -> " order by c.ultimoAcceso desc nulls last, c.id desc";
            case "nombre" -> " order by lower(c.nombre), c.id";
            case "pedidos" -> " order by " + cuenta + " desc, c.id desc";
            default -> " order by c.creado desc, c.id desc";
        };
        var em = Cliente.getEntityManager();
        var consulta = em.createQuery("select c from Cliente c" + donde + ordenar, Cliente.class);
        var total = em.createQuery("select count(c) from Cliente c" + donde, Long.class);
        params.forEach((k, v) -> {
            consulta.setParameter(k, v);
            total.setParameter(k, v);
        });
        int p = Math.max(0, pagina);
        List<Cliente> clientes = consulta.setFirstResult(p * POR_PAGINA).setMaxResults(POR_PAGINA).getResultList();

        var grupos = em.createQuery("select count(c),"
                + " coalesce(sum(case when c.probador = true then 1 else 0 end), 0),"
                + " coalesce(sum(case when c.dePrueba = true then 1 else 0 end), 0),"
                + " coalesce(sum(case when c.activo = false then 1 else 0 end), 0)"
                + " from Cliente c" + base, Object[].class);
        params.forEach(grupos::setParameter);
        Object[] c = grupos.getSingleResult();
        Conteos conteos = new Conteos(numero(c[0]), numero(c[1]), numero(c[2]), numero(c[3]));

        Map<Long, Long> porCliente = clientes.isEmpty() ? Map.of()
                : Pedido.getEntityManager()
                        .createQuery("select p.cliente.id, count(p) from Pedido p where p.cliente in :c group by p.cliente.id",
                                Object[].class)
                        .setParameter("c", clientes).getResultList().stream()
                        .collect(Collectors.toMap(f -> (Long) f[0], f -> (Long) f[1]));
        List<ClienteAdminDto> filas = clientes.stream().map(x -> new ClienteAdminDto(x.id, x.nombre, x.telefono, x.correo,
                x.direccion, x.activo, x.creado, x.ultimoAcceso, porCliente.getOrDefault(x.id, 0L), x.probador,
                x.dePrueba)).toList();
        return new PaginaClientes(filas, total.getSingleResult(), p, POR_PAGINA, conteos);
    }

    private static long numero(Object o) {
        return o == null ? 0 : ((Number) o).longValue();
    }

    @PUT
    @Path("/{id}/activo")
    @Transactional
    public ClienteAdminDto cambiarActivo(@PathParam("id") Long id, @NotNull Activo a) {
        Cliente c = Cliente.findById(id);
        if (c == null) {
            throw Errores.de(Status.NOT_FOUND, "No existe ese cliente.");
        }
        if (c.activo != a.activo()) {
            mx.turamohoy.historial.Bitacora.anotar(sesion.usuario(), null, mx.turamohoy.historial.Bitacora.CLIENTE, c.id,
                    (a.activo() ? "Devolvió el acceso al cliente " : "Quitó el acceso al cliente ") + c.nombre, c.telefono);
        }
        c.activo = a.activo();
        return new ClienteAdminDto(c.id, c.nombre, c.telefono, c.correo, c.direccion, c.activo, c.creado,
                c.ultimoAcceso, Pedido.count("cliente", c), c.probador, c.dePrueba);
    }
}
