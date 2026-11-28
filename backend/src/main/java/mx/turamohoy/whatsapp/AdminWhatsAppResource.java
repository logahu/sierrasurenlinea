package mx.turamohoy.whatsapp;

import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response.Status;
import mx.turamohoy.admin.Errores;
import mx.turamohoy.admin.Rol;
import mx.turamohoy.admin.SesionActual;
import mx.turamohoy.catalogo.model.Negocio;
import mx.turamohoy.historial.Bitacora;

import java.util.Objects;

/** Conectar el WhatsApp de un negocio con la API de Meta y prender o apagar la recepcionista. Solo el dueño. */
@Path("/api/admin/negocios/{slug}/whatsapp")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@RolesAllowed(Rol.DUENO)
public class AdminWhatsAppResource {

    @Inject
    SesionActual sesion;

    @Inject
    WhatsAppCliente cliente;

    /**
     * @param phoneNumberId "Phone number ID" de Meta (solo dígitos); null = desconectar
     * @param simulado      true si el servidor no tiene WHATSAPP_TOKEN (no envía de verdad)
     */
    public record Conexion(String phoneNumberId, boolean botActivo, boolean simulado) {
    }

    public record CambioConexion(
            @Pattern(regexp = "\\d{5,30}", message = "El Phone number ID son solo dígitos.") String phoneNumberId,
            @NotNull Boolean botActivo) {
    }

    @GET
    public Conexion ver(@PathParam("slug") String slug) {
        Negocio n = sesion.negocioEditable(slug);
        return new Conexion(n.waPhoneNumberId, n.botActivo, cliente.simulado());
    }

    @PUT
    @Transactional
    public Conexion cambiar(@PathParam("slug") String slug, @Valid @NotNull CambioConexion c) {
        Negocio n = sesion.negocioEditable(slug);
        String id = c.phoneNumberId() == null || c.phoneNumberId().isBlank() ? null : c.phoneNumberId();
        if (id != null) {
            Negocio otro = Negocio.<Negocio>find("waPhoneNumberId", id).firstResult();
            if (otro != null && !otro.id.equals(n.id)) {
                throw Errores.de(Status.CONFLICT, "Ese número de WhatsApp ya está conectado a " + otro.nombre + ".");
            }
        }
        boolean bot = c.botActivo() && id != null;
        if (!Objects.equals(n.waPhoneNumberId, id) || n.botActivo != bot) {
            String que = id == null ? "Desconectó el WhatsApp de la API"
                    : (bot ? "Prendió" : "Apagó") + " la recepcionista de WhatsApp";
            Bitacora.anotar(sesion.usuario(), n, Bitacora.NEGOCIO, n.id, que + " de " + n.nombre, id);
        }
        n.waPhoneNumberId = id;
        n.botActivo = bot;
        return new Conexion(n.waPhoneNumberId, n.botActivo, cliente.simulado());
    }
}
