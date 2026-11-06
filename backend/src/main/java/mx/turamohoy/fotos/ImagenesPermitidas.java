package mx.turamohoy.fotos;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.core.Response.Status;
import mx.turamohoy.admin.Errores;
import mx.turamohoy.catalogo.model.Negocio;

/**
 * Qué imágenes se pueden asignar a un producto o portada: las de ejemplo del sitio
 * ({@code img/...}) o fotos subidas a R2 para ese mismo negocio. Así nadie puede
 * poner una imagen de otro sitio ni la de otro negocio.
 */
@ApplicationScoped
public class ImagenesPermitidas {

    @Inject
    AlmacenFotos almacen;

    public String validar(Negocio n, String url) {
        if (url == null || url.isBlank()) {
            return null;
        }
        String u = url.trim();
        boolean deEjemplo = u.matches("img/[a-z0-9-]+\\.(svg|jpg|jpeg|png|webp)");
        boolean subida = almacen.configurado()
                && u.matches(java.util.regex.Pattern.quote(almacen.urlPublica() + "/negocios/" + n.slug + "/")
                + "[0-9a-f-]{36}\\.(webp|jpg)");
        if (!deEjemplo && !subida) {
            throw Errores.de(Status.BAD_REQUEST, "Esa imagen no es una foto subida para " + n.nombre + ".");
        }
        return u;
    }
}
