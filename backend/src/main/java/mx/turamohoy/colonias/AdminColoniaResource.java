package mx.turamohoy.colonias;

import io.quarkus.panache.common.Sort;
import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.Response.Status;
import mx.turamohoy.admin.Errores;
import mx.turamohoy.admin.Rol;
import mx.turamohoy.admin.SesionActual;
import mx.turamohoy.catalogo.model.Producto;
import mx.turamohoy.catalogo.model.TipoNegocio;
import mx.turamohoy.historial.Bitacora;
import mx.turamohoy.pedidos.Pedido;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/** Catálogo de colonias: agregar, editar, asignar tarifa, eliminar y revisar las que piden los clientes. */
@Path("/api/admin/colonias")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@RolesAllowed(Rol.DUENO)
public class AdminColoniaResource {

    @Inject
    SesionActual sesion;

    public record ColoniaAdmin(Long id, String nombre, String tipo, String codigoPostal, String zona, String estado,
                               String origen, int solicitudes, Instant creada, long pedidos) {
    }

    /** Colonias y los nombres de las tarifas de Encarguitos que se les pueden asignar. */
    public record Catalogo(List<ColoniaAdmin> colonias, List<String> zonas) {
    }

    public record Datos(
            @NotBlank(message = "Escribe el nombre.") @Size(max = 100) String nombre,
            @NotBlank String tipo,
            @Pattern(regexp = "^$|^\\d{5}$", message = "El código postal lleva 5 dígitos.") String codigoPostal,
            @Size(max = 80) String zona) {
    }

    @GET
    public Catalogo listar() {
        Map<String, Long> porColonia = Pedido.getEntityManager()
                .createQuery("select p.colonia, count(p) from Pedido p where p.colonia is not null group by p.colonia",
                        Object[].class)
                .getResultList().stream()
                .collect(Collectors.toMap(f -> Colonia.clave((String) f[0]), f -> (Long) f[1], Long::sum));
        List<ColoniaAdmin> colonias = Colonia.<Colonia>listAll(Sort.by("nombre")).stream()
                .map(c -> new ColoniaAdmin(c.id, c.nombre, c.tipo, c.codigoPostal, c.zona, c.estado, c.origen,
                        c.solicitudes, c.creada, porColonia.getOrDefault(Colonia.clave(c.nombre), 0L)))
                .toList();
        return new Catalogo(colonias, zonas());
    }

    /** Nombres de las tarifas de mandados y viajes (sin los cargos extra), sin repetir. */
    static List<String> zonas() {
        return Producto.<Producto>list("categoria.negocio.tipo = ?1 and (unidadPrecio is null or unidadPrecio <> 'extra')",
                        TipoNegocio.SERVICIO).stream()
                .map(p -> p.nombre.trim()).distinct().sorted(String.CASE_INSENSITIVE_ORDER).toList();
    }

    @POST
    @Transactional
    public Response crear(@Valid @NotNull Datos d) {
        validar(d, null);
        Colonia c = new Colonia();
        aplicar(c, d);
        c.origen = "ADMIN";
        c.persist();
        Bitacora.anotar(sesion.usuario(), null, Bitacora.COLONIA, c.id, "Agregó la colonia " + c.nombre, c.tipo);
        return Response.status(Status.CREATED).entity(dto(c)).build();
    }

    /** Edita los datos; si estaba solicitada por un cliente, queda agregada al catálogo. */
    @PUT
    @Path("/{id}")
    @Transactional
    public ColoniaAdmin editar(@PathParam("id") Long id, @Valid @NotNull Datos d) {
        Colonia c = buscar(id);
        validar(d, c.id);
        boolean aprobada = Colonia.SOLICITADA.equals(c.estado);
        aplicar(c, d);
        c.estado = Colonia.ACTIVA;
        Bitacora.anotar(sesion.usuario(), null, Bitacora.COLONIA, c.id,
                (aprobada ? "Agregó al catálogo la colonia solicitada " : "Editó la colonia ") + c.nombre,
                c.tipo + (c.zona == null ? "" : " · tarifa " + c.zona));
        return dto(c);
    }

    /** Elimina la colonia (o descarta la solicitud). Los pedidos guardan el nombre, así que no se pierde nada. */
    @DELETE
    @Path("/{id}")
    @Transactional
    public Response eliminar(@PathParam("id") Long id) {
        Colonia c = buscar(id);
        Bitacora.anotar(sesion.usuario(), null, Bitacora.COLONIA, c.id,
                (Colonia.SOLICITADA.equals(c.estado) ? "Descartó la colonia solicitada " : "Eliminó la colonia ") + c.nombre,
                null);
        c.delete();
        return Response.noContent().build();
    }

    private static Colonia buscar(Long id) {
        Colonia c = Colonia.findById(id);
        if (c == null) {
            throw Errores.de(Status.NOT_FOUND, "Esa colonia ya no existe.");
        }
        return c;
    }

    private static void validar(Datos d, Long mismo) {
        if (!Colonia.TIPOS.contains(d.tipo())) {
            throw Errores.de(Status.BAD_REQUEST, "Tipo no válido.");
        }
        String clave = Colonia.clave(d.nombre());
        boolean repetida = Colonia.<Colonia>list("estado", Colonia.ACTIVA).stream()
                .anyMatch(c -> !c.id.equals(mismo) && c.tipo.equals(d.tipo()) && Colonia.clave(c.nombre).equals(clave));
        if (repetida) {
            throw Errores.de(Status.CONFLICT, "Ya existe " + d.tipo().toLowerCase() + " con ese nombre.");
        }
    }

    private static void aplicar(Colonia c, Datos d) {
        c.nombre = d.nombre().trim().replaceAll("\\s+", " ");
        c.tipo = d.tipo();
        c.codigoPostal = d.codigoPostal() == null || d.codigoPostal().isBlank() ? null : d.codigoPostal();
        c.zona = d.zona() == null || d.zona().isBlank() ? null : d.zona().trim();
    }

    private static ColoniaAdmin dto(Colonia c) {
        return new ColoniaAdmin(c.id, c.nombre, c.tipo, c.codigoPostal, c.zona, c.estado, c.origen, c.solicitudes,
                c.creada, 0);
    }
}
