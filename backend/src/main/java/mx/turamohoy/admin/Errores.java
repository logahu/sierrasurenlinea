package mx.turamohoy.admin;

import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

/** Errores del panel con un mensaje en español que la pantalla puede mostrar tal cual. */
public final class Errores {

    public record Mensaje(String mensaje) {
    }

    private Errores() {
    }

    public static WebApplicationException de(Response.Status estado, String mensaje) {
        return de(estado.getStatusCode(), mensaje);
    }

    public static WebApplicationException de(int estado, String mensaje) {
        return new WebApplicationException(Response.status(estado)
                .type(MediaType.APPLICATION_JSON)
                .entity(new Mensaje(mensaje))
                .build());
    }
}
