package mx.turamohoy.fotos;

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
        return new PermisoFoto(
                almacen.urlParaSubir(clave, s.tipo(), s.bytes(), SEGUNDOS_PARA_SUBIR),
                almacen.urlDe(clave), s.tipo(), s.bytes());
    }
}
