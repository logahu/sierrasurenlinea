package mx.turamohoy.catalogo.model;

import jakarta.ws.rs.core.Response.Status;
import mx.turamohoy.admin.Errores;

import java.net.URI;
import java.util.Locale;
import java.util.Set;

/**
 * Enlaces al Perfil de Negocio de Google. Solo se aceptan direcciones https de Google para que
 * los botones «Ver en Google Maps» y «Déjanos tu reseña» no lleven a otro sitio.
 */
public final class EnlacesGoogle {

    private static final Set<String> HOSTS = Set.of(
            "maps.app.goo.gl", "goo.gl", "g.page", "maps.google.com", "www.google.com", "google.com",
            "www.google.com.mx", "google.com.mx", "search.google.com", "business.google.com");

    private EnlacesGoogle() {
    }

    /** null o vacío → null (se quita). Otro sitio o sin https → 400 con el nombre del campo. */
    public static String validar(String enlace, String campo) {
        if (enlace == null || enlace.isBlank()) {
            return null;
        }
        String e = enlace.trim();
        try {
            URI u = URI.create(e);
            String host = u.getHost() == null ? "" : u.getHost().toLowerCase(Locale.ROOT);
            if (!"https".equalsIgnoreCase(u.getScheme()) || !HOSTS.contains(host) || e.length() > 300) {
                throw new IllegalArgumentException();
            }
            if (host.equals("goo.gl") && !u.getPath().startsWith("/maps")) {
                throw new IllegalArgumentException();
            }
            return e;
        } catch (IllegalArgumentException ex) {
            throw Errores.de(Status.BAD_REQUEST,
                    campo + ": pega el enlace que te da Google (empieza con https://maps.app.goo.gl o https://g.page).");
        }
    }
}
