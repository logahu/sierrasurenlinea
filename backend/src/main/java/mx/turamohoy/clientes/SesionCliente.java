package mx.turamohoy.clientes;

import jakarta.enterprise.context.RequestScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.core.Response.Status;
import mx.turamohoy.admin.Errores;
import org.eclipse.microprofile.jwt.JsonWebToken;

/**
 * El cliente de la petición. Su token lleva el sujeto "c:<id>" (los del panel, solo el
 * número), así nunca se confunde con un usuario del panel.
 */
@RequestScoped
public class SesionCliente {

    public static final String ROL = "CLIENTE";
    static final String PREFIJO = "c:";

    @Inject
    JsonWebToken jwt;

    private Cliente cliente;

    /**
     * Si quien pide es un cliente probador (puede ver los negocios en pruebas). Sin sesión,
     * o con una sesión que no es de cliente, es false; nunca lanza error.
     */
    public boolean esProbador() {
        String sujeto = jwt == null ? null : jwt.getSubject();
        if (sujeto == null || !sujeto.startsWith(PREFIJO)) {
            return false;
        }
        try {
            return cliente().probador;
        } catch (RuntimeException e) {
            return false;
        }
    }

    public Cliente cliente() {
        if (cliente == null) {
            String sujeto = jwt.getSubject();
            Cliente c = null;
            if (sujeto != null && sujeto.startsWith(PREFIJO)) {
                try {
                    c = Cliente.findById(Long.valueOf(sujeto.substring(PREFIJO.length())));
                } catch (NumberFormatException e) {
                    // no es nuestro
                }
            }
            if (c == null || !c.activo) {
                throw Errores.de(Status.UNAUTHORIZED, "Tu sesión ya no es válida. Vuelve a iniciar sesión.");
            }
            cliente = c;
        }
        return cliente;
    }
}
