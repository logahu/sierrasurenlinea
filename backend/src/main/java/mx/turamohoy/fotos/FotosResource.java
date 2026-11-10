package mx.turamohoy.fotos;

import mx.turamohoy.historial.Bitacora;
import mx.turamohoy.admin.Usuario;
import java.util.List;
import java.time.Instant;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.DELETE;
import jakarta.transaction.Transactional;
import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response.Status;
import mx.turamohoy.admin.Errores;
import mx.turamohoy.admin.Rol;
import mx.turamohoy.admin.SesionActual;
import mx.turamohoy.catalogo.model.Negocio;

import java.util.Map;
import java.util.UUID;

/**
 * Permiso para subir una foto de un negocio. El navegador la recorta y comprime
 * (800×800, WebP o JPEG) y la sube directo a R2 con la URL que devuelve este endpoint;
 * luego guarda la URL pública en el producto o en la portada.
 */
@Path("/api/admin/negocios/{slug}/fotos")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@RolesAllowed({Rol.DUENO, Rol.ENCARGADO})
public class FotosResource {

    /** Una foto de 800×800 bien comprimida pesa ~100 KB; 1.5 MB deja margen. */
    static final long MAX_BYTES = 1_500_000;
    static final long SEGUNDOS_PARA_SUBIR = 600;
    private static final Map<String, String> EXTENSIONES = Map.of("image/webp", "webp", "image/jpeg", "jpg");

    @Inject
    SesionActual sesion;

    @Inject
    AlmacenFotos almacen;

    public record SolicitudFoto(
            @NotBlank(message = "Falta el tipo de imagen.") String tipo,
            @NotNull @Min(value = 1, message = "La foto está vacía.")
            @Max(value = MAX_BYTES, message = "La foto pesa demasiado (máximo 1.5 MB).") Long bytes) {
    }

    public record PermisoFoto(String subirUrl, String url, String tipo, long bytes) {
    }

    @POST
    @Transactional
    public PermisoFoto pedirPermiso(@PathParam("slug") String slug, @Valid @NotNull SolicitudFoto s) {
        Negocio n = sesion.negocioEditable(slug);
        if (!almacen.configurado()) {
            throw Errores.de(Status.SERVICE_UNAVAILABLE,
                    "Las fotos todavía no están configuradas en el servidor (faltan las variables R2_*).");
        }
        String extension = EXTENSIONES.get(s.tipo());
        if (extension == null) {
            throw Errores.de(Status.BAD_REQUEST, "Solo se aceptan fotos WebP o JPEG.");
        }
        String clave = "negocios/" + n.slug + "/" + UUID.randomUUID() + "." + extension;
        // Se registra para poder listarla y borrarla después.
        Foto f = new Foto();
        f.negocio = n;
        f.clave = clave;
        f.url = almacen.urlDe(clave);
        f.tipo = s.tipo();
        f.bytes = s.bytes();
        f.subida = Instant.now();
        f.subidaPor = sesion.usuario();
        f.persist();
        return new PermisoFoto(
                almacen.urlParaSubir(clave, s.tipo(), s.bytes(), SEGUNDOS_PARA_SUBIR),
                almacen.urlDe(clave), s.tipo(), s.bytes());
    }

    public record FotoDto(Long id, String url, String tipo, long bytes, Instant subida, String subidaPor,
                          List<String> usos) {
    }

    public record Fotos(List<FotoDto> fotos, long bytesEnUso, long bytesSinUsar, int borradas, long bytesLiberados) {
    }

    /** Las fotos del negocio (sin las borradas), con dónde se usa cada una. */
    @GET
    @Transactional
    public Fotos listar(@PathParam("slug") String slug) {
        Negocio n = sesion.negocioEditable(slug);
        List<Foto> todas = Foto.list("negocio = ?1 order by subida desc", n);
        List<FotoDto> vivas = todas.stream().filter(f -> f.borrada == null)
                .map(f -> new FotoDto(f.id, f.url, f.tipo, f.bytes, f.subida,
                        f.subidaPor == null ? null : f.subidaPor.nombre, f.usos()))
                .toList();
        long enUso = vivas.stream().filter(f -> !f.usos().isEmpty()).mapToLong(FotoDto::bytes).sum();
        long sinUsar = vivas.stream().filter(f -> f.usos().isEmpty()).mapToLong(FotoDto::bytes).sum();
        List<Foto> borradas = todas.stream().filter(f -> f.borrada != null).toList();
        return new Fotos(vivas, enUso, sinUsar, borradas.size(), borradas.stream().mapToLong(f -> f.bytes).sum());
    }

    /**
     * Borra el archivo de una foto que ya no se usa (libera espacio). Las fotos en uso no se
     * pueden borrar, para no dejar productos sin imagen. El registro se conserva.
     */
    @DELETE
    @Path("/{id}")
    @Transactional
    public void borrar(@PathParam("slug") String slug, @PathParam("id") Long id) {
        Negocio n = sesion.negocioEditable(slug);
        Foto f = Foto.findById(id);
        if (f == null || !f.negocio.id.equals(n.id) || f.borrada != null) {
            throw Errores.de(Status.NOT_FOUND, "No existe esa foto.");
        }
        List<String> usos = f.usos();
        if (!usos.isEmpty()) {
            throw Errores.de(Status.CONFLICT, "Esa foto todavía se usa (" + String.join(", ", usos)
                    + "). Cámbiala ahí primero.");
        }
        try {
            almacen.borrar(f.clave);
        } catch (IllegalStateException e) {
            throw Errores.de(Status.BAD_GATEWAY, "No se pudo borrar la foto del almacenamiento. Intenta de nuevo.");
        }
        Usuario u = sesion.usuario();
        f.borrada = Instant.now();
        f.borradaPor = u;
        Bitacora.anotar(u, n, Bitacora.FOTO, f.id, "Borró una foto sin usar",
                f.url + " (" + Math.max(1, f.bytes / 1024) + " KB)");
    }
}
