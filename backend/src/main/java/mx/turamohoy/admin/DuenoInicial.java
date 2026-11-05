package mx.turamohoy.admin;

import io.quarkus.runtime.StartupEvent;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.transaction.Transactional;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import java.util.Optional;

/**
 * Crea la cuenta del dueño la primera vez que arranca el backend, con el correo y
 * la contraseña de las variables ADMIN_CORREO y ADMIN_CONTRASENA. Si ya existe un
 * dueño no hace nada: después la contraseña se cambia desde el panel.
 */
@ApplicationScoped
public class DuenoInicial {

    private static final Logger LOG = Logger.getLogger(DuenoInicial.class);

    @ConfigProperty(name = "sierrasur.admin.correo")
    Optional<String> correo;

    @ConfigProperty(name = "sierrasur.admin.contrasena")
    Optional<String> contrasena;

    @ConfigProperty(name = "sierrasur.admin.nombre", defaultValue = "Dueño")
    String nombre;

    @Transactional
    void alArrancar(@Observes StartupEvent evento) {
        if (Usuario.count("rol", Rol.DUENO) > 0) {
            return;
        }
        if (correo.isEmpty() || contrasena.isEmpty()) {
            LOG.warn("Todavía no hay cuenta de dueño para el panel. Define ADMIN_CORREO y ADMIN_CONTRASENA y reinicia.");
            return;
        }
        if (contrasena.get().length() < Contrasenas.MINIMO || contrasena.get().length() > Contrasenas.MAXIMO) {
            LOG.warnf("ADMIN_CONTRASENA debe tener entre %d y %d caracteres; no se creó la cuenta del dueño.",
                    Contrasenas.MINIMO, Contrasenas.MAXIMO);
            return;
        }
        Usuario u = new Usuario();
        u.correo = Usuario.normalizarCorreo(correo.get());
        u.nombre = nombre;
        u.rol = Rol.DUENO;
        u.contrasenaHash = Contrasenas.cifrar(contrasena.get());
        u.persist();
        LOG.infof("Cuenta de dueño creada: %s", u.correo);
    }
}
