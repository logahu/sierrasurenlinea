package mx.turamohoy.admin;

import jakarta.enterprise.context.RequestScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.core.Response.Status;
import mx.turamohoy.catalogo.model.Negocio;
import org.eclipse.microprofile.jwt.JsonWebToken;

/**
 * Quién hace la petición. El token dice quién es, pero el usuario se vuelve a
 * leer de la base en cada petición: si lo desactivan o le cambian el rol, su
 * sesión deja de servir en ese momento, sin esperar a que venza.
 */
@RequestScoped
public class SesionActual {

    @Inject
    JsonWebToken jwt;

    private Usuario usuario;

    public Usuario usuario() {
        if (usuario == null) {
            Usuario u = null;
            try {
                u = jwt.getSubject() == null ? null : Usuario.findById(Long.valueOf(jwt.getSubject()));
            } catch (NumberFormatException e) {
                // token con un sujeto que no es nuestro
            }
            if (u == null || !u.activo || !jwt.getGroups().contains(u.rol)) {
                throw Errores.de(Status.UNAUTHORIZED, "Tu sesión ya no es válida. Vuelve a entrar.");
            }
            usuario = u;
        }
        return usuario;
    }

    /** El negocio, si existe y el usuario puede editarlo. */
    public Negocio negocioEditable(String slug) {
        Negocio n = Negocio.porSlug(slug)
                .orElseThrow(() -> Errores.de(Status.NOT_FOUND, "No existe el negocio " + slug + "."));
        if (!usuario().puedeEditar(n)) {
            throw Errores.de(Status.FORBIDDEN, "Solo puedes editar tu negocio.");
        }
        return n;
    }
}
