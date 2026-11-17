package mx.turamohoy.fotos;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.core.Response.Status;
import mx.turamohoy.admin.Errores;
import org.jboss.logging.Logger;

import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Avatar de un usuario o cliente: uno de los dibujos del sitio («avatar:flor») o su foto de
 * perfil, que se sube directo a R2 en {@code perfiles/usuarios/{id}/} o {@code perfiles/clientes/{id}/}.
 * Cada quien solo puede usar fotos de su propia carpeta.
 */
@ApplicationScoped
public class Avatares {

    private static final Logger LOG = Logger.getLogger(Avatares.class);

    /** Los dibujos del sitio (el frontend los pinta con estos nombres). */
    public static final Set<String> DIBUJOS = Set.of("flor", "maguey", "sol", "cerro", "colibri", "mariposa",
            "nopal", "luna", "taza", "moto", "estrella", "corazon");

    public static final long MAX_BYTES = 1_500_000;
    private static final long SEGUNDOS_PARA_SUBIR = 600;
    private static final Map<String, String> EXTENSIONES = Map.of("image/webp", "webp", "image/jpeg", "jpg");

    @Inject
    AlmacenFotos almacen;

    /** Lo que ve la pantalla para subir la foto. */
    public record PermisoFoto(String subirUrl, String url, String tipo, long bytes) {
    }

    public static String carpetaDeUsuario(Long id) {
        return "perfiles/usuarios/" + id;
    }

    public static String carpetaDeCliente(Long id) {
        return "perfiles/clientes/" + id;
    }

    /** Permiso de 10 minutos para subir una foto de perfil a su carpeta. */
    public PermisoFoto permiso(String carpeta, String tipo, Long bytes) {
        if (!almacen.configurado()) {
            throw Errores.de(Status.SERVICE_UNAVAILABLE,
                    "Las fotos todavía no están configuradas en el servidor. Mientras, elige uno de los dibujos.");
        }
        String extension = tipo == null ? null : EXTENSIONES.get(tipo);
        if (extension == null) {
            throw Errores.de(Status.BAD_REQUEST, "Solo se aceptan fotos WebP o JPEG.");
        }
        if (bytes == null || bytes < 1 || bytes > MAX_BYTES) {
            throw Errores.de(Status.BAD_REQUEST, "La foto pesa demasiado (máximo 1.5 MB).");
        }
        String clave = carpeta + "/" + UUID.randomUUID() + "." + extension;
        return new PermisoFoto(almacen.urlParaSubir(clave, tipo, bytes, SEGUNDOS_PARA_SUBIR), almacen.urlDe(clave), tipo, bytes);
    }

    /** El avatar limpio y válido para esa carpeta; vacío = sin avatar (iniciales). */
    public String validar(String avatar, String carpeta) {
        if (avatar == null || avatar.isBlank()) {
            return null;
        }
        String a = avatar.trim();
        if (a.startsWith("avatar:")) {
            if (!DIBUJOS.contains(a.substring("avatar:".length()))) {
                throw Errores.de(Status.BAD_REQUEST, "Ese dibujo no existe.");
            }
            return a;
        }
        if (!esFotoDe(a, carpeta)) {
            throw Errores.de(Status.BAD_REQUEST, "Esa imagen no es una foto de perfil tuya.");
        }
        return a;
    }

    /** Al cambiar de foto, la anterior se borra de R2 (si falla, solo se registra). */
    public void borrarAnterior(String antes, String ahora, String carpeta) {
        if (antes == null || antes.equals(ahora) || !esFotoDe(antes, carpeta)) {
            return;
        }
        try {
            almacen.borrar(antes.substring(almacen.urlPublica().length() + 1));
        } catch (RuntimeException e) {
            LOG.warnf("No se pudo borrar la foto de perfil anterior %s: %s", antes, e.getMessage());
        }
    }

    private boolean esFotoDe(String url, String carpeta) {
        return almacen.configurado()
                && Pattern.matches(Pattern.quote(almacen.urlPublica() + "/" + carpeta + "/") + "[0-9a-f-]{36}\\.(webp|jpg)", url);
    }
}
