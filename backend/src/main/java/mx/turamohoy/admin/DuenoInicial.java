package mx.turamohoy.admin;

import io.quarkus.runtime.StartupEvent;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.transaction.Transactional;
import mx.turamohoy.historial.Bitacora;
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

    /** ADMIN_REINICIAR=true: recuperar el acceso si se olvidó la contraseña. */
    @ConfigProperty(name = "sierrasur.admin.reiniciar", defaultValue = "false")
    boolean reiniciar;

    @Transactional
    void alArrancar(@Observes StartupEvent evento) {
        if (reiniciar) {
            reiniciarAcceso();
            return;
        }
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
        Bitacora.delSistema(Bitacora.USUARIO, u.id, "Creó la cuenta de administrador " + u.correo, null);
    }

    /**
     * Pone ADMIN_CONTRASENA a la cuenta de administrador ADMIN_CORREO, la reactiva y le quita
     * el bloqueo. Solo para cuando se olvidó la contraseña; luego hay que quitar la variable.
     */
    void reiniciarAcceso() {
        if (correo.isEmpty() || contrasena.isEmpty()
                || contrasena.get().length() < Contrasenas.MINIMO || contrasena.get().length() > Contrasenas.MAXIMO) {
            LOG.warnf("ADMIN_REINICIAR está activo pero ADMIN_CORREO o ADMIN_CONTRASENA (de %d a %d caracteres) no son válidos.",
                    Contrasenas.MINIMO, Contrasenas.MAXIMO);
            return;
        }
        Usuario u = Usuario.porCorreo(Usuario.normalizarCorreo(correo.get())).orElse(null);
        if (u == null || !Rol.DUENO.equals(u.rol)) {
            LOG.warnf("ADMIN_REINICIAR: %s no es una cuenta de administrador; no se cambió nada.", correo.get());
            return;
        }
        u.contrasenaHash = Contrasenas.cifrar(contrasena.get());
        u.activo = true;
        u.intentosFallidos = 0;
        u.bloqueadoHasta = null;
        Bitacora.delSistema(Bitacora.USUARIO, u.id, "Restableció el acceso de " + u.correo + " (ADMIN_REINICIAR)", null);
        LOG.warnf("Se restableció la contraseña de %s. Quita ADMIN_REINICIAR en Render y cambia la contraseña en Mi cuenta.",
                u.correo);
    }
}
