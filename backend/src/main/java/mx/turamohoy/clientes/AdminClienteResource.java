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
                                  boolean activo, Instant creado, Instant ultimoAcceso, long pedidos, boolean probador) {
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
                c.ultimoAcceso, Pedido.count("cliente", c), c.probador);
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

    /** Los más recientes primero; {@code q} busca por nombre o teléfono. */
    @GET
    public List<ClienteAdminDto> listar(@QueryParam("q") String q) {
        String filtro = q == null ? "" : q.trim().toLowerCase();
        List<Cliente> clientes = filtro.isEmpty()
                ? Cliente.find("order by creado desc").page(0, 200).list()
                : Cliente.find("lower(nombre) like ?1 or telefono like ?1 order by creado desc", "%" + filtro + "%")
                        .page(0, 200).list();
        Map<Long, Long> pedidos = clientes.isEmpty() ? Map.of()
                : Pedido.getEntityManager()
                        .createQuery("select p.cliente.id, count(p) from Pedido p where p.cliente in :c group by p.cliente.id",
                                Object[].class)
                        .setParameter("c", clientes).getResultList().stream()
                        .collect(Collectors.toMap(f -> (Long) f[0], f -> (Long) f[1]));
        return clientes.stream().map(c -> new ClienteAdminDto(c.id, c.nombre, c.telefono, c.correo, c.direccion,
                c.activo, c.creado, c.ultimoAcceso, pedidos.getOrDefault(c.id, 0L), c.probador)).toList();
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
                c.ultimoAcceso, Pedido.count("cliente", c), c.probador);
    }
}
