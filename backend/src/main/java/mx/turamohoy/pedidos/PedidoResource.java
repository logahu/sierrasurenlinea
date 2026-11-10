package mx.turamohoy.pedidos;

import io.quarkus.narayana.jta.QuarkusTransaction;
import io.vertx.core.http.HttpServerRequest;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.Response.Status;
import mx.turamohoy.admin.Errores;
import mx.turamohoy.catalogo.model.Negocio;
import mx.turamohoy.catalogo.model.TipoEncargo;
import mx.turamohoy.catalogo.model.TipoNegocio;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.concurrent.CompletableFuture;

/**
 * El sitio registra aquí cada encargo antes de abrir WhatsApp. Devuelve el folio, que
 * va en el mensaje; el pedido aparece al momento en el panel y avisa por push.
 */
@Path("/api/pedidos")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class PedidoResource {

    @Inject
    Notificador notificador;

    @Inject
    LimitePedidos limite;

    @Context
    HttpServerRequest peticion;

    public record NuevoPedido(
            @NotBlank String negocio,
            @NotBlank @Size(max = 60) String tipo,
            @NotBlank String modo,
            @NotBlank(message = "Falta tu nombre.") @Size(max = 80) String nombre,
            @NotBlank(message = "Falta tu teléfono.") String telefono,
            @NotBlank(message = "Falta a dónde lo llevamos.") @Size(max = 300) String entregar,
            @Size(max = 80) String zona,
            @DecimalMin("0") BigDecimal total,
            @NotBlank @Size(max = 4000) String mensaje) {
    }

    public record PedidoRegistrado(Long id, String folio) {
    }

    @POST
    public Response registrar(@Valid @NotNull NuevoPedido req) {
        if (!limite.permitir(ip())) {
            throw Errores.de(429, "Hiciste muchos pedidos seguidos. Espera unos minutos o escríbenos por WhatsApp.");
        }
        String telefono = req.telefono().replaceAll("\\D", "");
        if (telefono.length() == 12 && telefono.startsWith("52")) {
            telefono = telefono.substring(2);
        }
        if (telefono.length() != 10) {
            throw Errores.de(Status.BAD_REQUEST, "El teléfono debe tener 10 dígitos.");
        }
        if (!TipoEncargo.MODOS.contains(req.modo())) {
            throw Errores.de(Status.BAD_REQUEST, "Tipo de encargo no válido.");
        }
        String tel = telefono;
        PedidoRegistrado r = QuarkusTransaction.requiringNew().call(() -> {
            Negocio n = Negocio.visiblePorSlug(req.negocio())
                    .filter(x -> x.tipo == TipoNegocio.SERVICIO)
                    .orElseThrow(() -> Errores.de(Status.BAD_REQUEST, "Ese negocio no recibe pedidos en línea."));
            Pedido p = new Pedido();
            p.negocio = n;
            p.tipo = req.tipo().trim();
            p.modo = req.modo();
            p.clienteNombre = req.nombre().trim();
            p.clienteTelefono = tel;
            p.entregar = req.entregar().trim();
            p.zona = req.zona() == null || req.zona().isBlank() ? null : req.zona().trim();
            p.totalEstimado = req.total();
            p.mensaje = req.mensaje().trim();
            p.creado = Instant.now();
            p.actualizado = p.creado;
            p.persist();
            p.flush();
            p.folio = Pedido.folioDe(n, p.id);
            return new PedidoRegistrado(p.id, p.folio);
        });
        CompletableFuture.runAsync(() -> notificador.pedidoNuevo(r.id()));
        return Response.status(Status.CREATED).entity(r).build();
    }

    private String ip() {
        if (peticion == null) {
            return null;
        }
        String reenviada = peticion.getHeader("X-Forwarded-For");
        if (reenviada != null && !reenviada.isBlank()) {
            return reenviada.split(",")[0].trim();
        }
        return peticion.remoteAddress() == null ? null : peticion.remoteAddress().host();
    }
}
