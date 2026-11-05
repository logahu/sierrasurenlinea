package mx.turamohoy.admin;

import io.quarkus.elytron.security.common.BcryptUtil;
import jakarta.ws.rs.core.Response.Status;
import org.wildfly.security.password.PasswordFactory;
import org.wildfly.security.password.WildFlyElytronPasswordProvider;
import org.wildfly.security.password.interfaces.BCryptPassword;
import org.wildfly.security.password.util.ModularCrypt;

/** Cifrado y verificación de contraseñas con bcrypt. */
public final class Contrasenas {

    public static final int MINIMO = 10;
    /** bcrypt solo toma en cuenta los primeros 72 bytes. */
    public static final int MAXIMO = 72;

    private static final WildFlyElytronPasswordProvider PROVEEDOR = new WildFlyElytronPasswordProvider();

    private Contrasenas() {
    }

    public static String cifrar(String contrasena) {
        return BcryptUtil.bcryptHash(contrasena);
    }

    public static boolean coincide(String contrasena, String hash) {
        if (contrasena == null || hash == null) {
            return false;
        }
        try {
            PasswordFactory fabrica = PasswordFactory.getInstance(BCryptPassword.ALGORITHM_BCRYPT, PROVEEDOR);
            BCryptPassword guardada = (BCryptPassword) fabrica.translate(ModularCrypt.decode(hash));
            return fabrica.verify(guardada, contrasena.toCharArray());
        } catch (Exception e) {
            return false;
        }
    }

    /** Reglas para una contraseña nueva. */
    public static void validarNueva(String contrasena) {
        if (contrasena == null || contrasena.length() < MINIMO) {
            throw Errores.de(Status.BAD_REQUEST, "La contraseña debe tener al menos " + MINIMO + " caracteres.");
        }
        if (contrasena.length() > MAXIMO) {
            throw Errores.de(Status.BAD_REQUEST, "La contraseña puede tener como máximo " + MAXIMO + " caracteres.");
        }
    }
}
