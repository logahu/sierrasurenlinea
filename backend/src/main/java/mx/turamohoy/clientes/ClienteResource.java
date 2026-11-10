package mx.turamohoy.clientes;

import mx.turamohoy.pedidos.PushCliente;
import mx.turamohoy.pedidos.Notificador;
import mx.turamohoy.pedidos.AdminPedidoResource;
import java.util.Map;
import jakarta.ws.rs.DELETE;
import io.quarkus.elytron.security.common.BcryptUtil;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.smallrye.jwt.build.Jwt;
import jakarta.annotation.security.PermitAll;
import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.Response.Status;
import mx.turamohoy.admin.Contrasenas;
import mx.turamohoy.admin.Errores;
import mx.turamohoy.pedidos.Pedido;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Set;

/**
 * Cuenta del cliente: registro con teléfono y contraseña, inicio de sesión (30 días),
 * sus datos y sus pedidos.
 */
@Path("/api/clientes")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class ClienteResource {

    /** Versión vigente del aviso de privacidad (cámbiala si cambias el texto del aviso). */
    public static final String VERSION_PRIVACIDAD = "2026-11";
    static final Duration DURACION_SESION = Duration.ofDays(30);
    static final int INTENTOS_MAXIMOS = 5;
    static final Duration ESPERA = Duration.ofMinutes(15);
    private static final String HASH_SIMULADO = BcryptUtil.bcryptHash("no-es-una-contrasena-real");

    @Inject
    SesionCliente sesion;

    public record Registro(
            @NotBlank(message = "Escribe tu nombre.") @Size(max = 80) String nombre,
            @NotBlank(message = "Escribe tu teléfono.") String telefono,
            @NotBlank(message = "Escribe una contraseña.") String contrasena,
            @Email(message = "El correo no es válido.") @Size(max = 120) String correo,
            @AssertTrue(message = "Para crear tu cuenta debes aceptar el aviso de privacidad.") boolean aceptaPrivacidad) {
    }

    public record Entrar(@NotBlank String telefono, @NotBlank String contrasena) {
    }

    public record Edicion(
            @NotBlank(message = "Escribe tu nombre.") @Size(max = 80) String nombre,
            @Email(message = "El correo no es válido.") @Size(max = 120) String correo,
            @Size(max = 300) String direccion) {
    }

    public record CambioContrasena(@NotBlank String actual, @NotBlank String nueva) {
    }

    public record SesionDto(String token, Instant expira, ClienteDto cliente) {
    }

    public record MiPedido(Long id, String folio, String negocioNombre, String tipo, String modo, String entrega,
                           String entregar, String cuando, BigDecimal totalEstimado, String estado, Instant creado) {
    }

    @POST
    @Path("/registro")
    @PermitAll
    public Response registrar(@Valid @NotNull Registro r) {
        String telefono = Cliente.normalizarTelefono(r.telefono());
        if (telefono == null) {
            throw Errores.de(Status.BAD_REQUEST, "El teléfono debe tener 10 dígitos.");
        }
        Contrasenas.validarNueva(r.contrasena());
        Cliente c = QuarkusTransaction.requiringNew().call(() -> {
            if (Cliente.porTelefono(telefono).isPresent()) {
                throw Errores.de(Status.CONFLICT, "Ya hay una cuenta con ese teléfono. Inicia sesión.");
            }
            Cliente n = new Cliente();
            n.nombre = r.nombre().trim();
            n.telefono = telefono;
            n.correo = limpio(r.correo());
            n.contrasenaHash = Contrasenas.cifrar(r.contrasena());
            n.privacidadAceptada = Instant.now();
            n.privacidadVersion = VERSION_PRIVACIDAD;
            n.creado = Instant.now();
            n.ultimoAcceso = n.creado;
            n.persist();
            return n;
        });
        return Response.status(Status.CREATED).entity(sesionDe(c)).build();
    }

    @POST
    @Path("/entrar")
    @PermitAll
    public SesionDto entrar(@Valid @NotNull Entrar e) {
        String telefono = Cliente.normalizarTelefono(e.telefono());
        record Intento(Cliente cliente, long minutosBloqueo) {
        }
        Intento i = QuarkusTransaction.requiringNew().call(() -> {
            Cliente c = telefono == null ? null : Cliente.porTelefono(telefono).orElse(null);
            if (c == null || !c.activo) {
                Contrasenas.coincide(e.contrasena(), HASH_SIMULADO);
                return new Intento(null, 0);
            }
            Instant ahora = Instant.now();
            if (c.bloqueadoHasta != null && c.bloqueadoHasta.isAfter(ahora)) {
                return new Intento(null, Math.max(1, Duration.between(ahora, c.bloqueadoHasta).toMinutes() + 1));
            }
            if (!Contrasenas.coincide(e.contrasena(), c.contrasenaHash)) {
                c.intentosFallidos++;
                if (c.intentosFallidos >= INTENTOS_MAXIMOS) {
                    c.intentosFallidos = 0;
                    c.bloqueadoHasta = ahora.plus(ESPERA);
                    return new Intento(null, ESPERA.toMinutes());
                }
                return new Intento(null, 0);
            }
            c.intentosFallidos = 0;
            c.bloqueadoHasta = null;
            c.ultimoAcceso = ahora;
            return new Intento(c, 0);
        });
        if (i.minutosBloqueo() > 0) {
            throw Errores.de(429, "Demasiados intentos. Vuelve a intentar en " + i.minutosBloqueo() + " minutos.");
        }
        if (i.cliente() == null) {
            throw Errores.de(Status.UNAUTHORIZED, "Teléfono o contraseña incorrectos.");
        }
        return sesionDe(i.cliente());
    }

    @GET
    @Path("/yo")
    @RolesAllowed(SesionCliente.ROL)
    public ClienteDto yo() {
        return ClienteDto.de(sesion.cliente());
    }

    @PUT
    @Path("/yo")
    @RolesAllowed(SesionCliente.ROL)
    @Transactional
    public ClienteDto editar(@Valid @NotNull Edicion e) {
        Cliente c = sesion.cliente();
        c.nombre = e.nombre().trim();
        c.correo = limpio(e.correo());
        c.direccion = limpio(e.direccion());
        return ClienteDto.de(c);
    }

    @PUT
    @Path("/contrasena")
    @RolesAllowed(SesionCliente.ROL)
    @Transactional
    public void cambiarContrasena(@Valid @NotNull CambioContrasena c) {
        Cliente cl = sesion.cliente();
        if (!Contrasenas.coincide(c.actual(), cl.contrasenaHash)) {
            throw Errores.de(Status.BAD_REQUEST, "La contraseña actual no es correcta.");
        }
        Contrasenas.validarNueva(c.nueva());
        cl.contrasenaHash = Contrasenas.cifrar(c.nueva());
    }

    /** Sus pedidos, del más reciente al más viejo. */
    @GET
    @Path("/pedidos")
    @RolesAllowed(SesionCliente.ROL)
    public List<MiPedido> pedidos() {
        Cliente c = sesion.cliente();
        return Pedido.<Pedido>find("select p from Pedido p join fetch p.negocio where p.cliente = ?1 order by p.creado desc", c)
                .page(0, 50).list().stream()
                .map(p -> new MiPedido(p.id, p.folio, p.negocio.nombre, p.tipo, p.modo,
                        p.entrega == null ? Pedido.DOMICILIO : p.entrega, p.entregar, p.cuando, p.totalEstimado,
                        p.estado, p.creado))
                .toList();
    }

    // ---------------------------------------------------------------- avisos push

    @jakarta.inject.Inject
    Notificador notificador;

    @GET
    @Path("/push/clave")
    @RolesAllowed(SesionCliente.ROL)
    public Map<String, String> clavePush() {
        sesion.cliente();
        return Map.of("clave", notificador.clavePublica());
    }

    /** Este celular quiere avisos cuando cambie el estado de sus pedidos. */
    @POST
    @Path("/push")
    @RolesAllowed(SesionCliente.ROL)
    @Transactional
    public void suscribir(@Valid @NotNull AdminPedidoResource.Suscripcion s) {
        Cliente c = sesion.cliente();
        PushCliente pc = PushCliente.<PushCliente>find("endpoint", s.endpoint()).firstResultOptional()
                .orElseGet(PushCliente::new);
        pc.cliente = c;
        pc.endpoint = s.endpoint();
        pc.p256dh = s.p256dh();
        pc.auth = s.auth();
        pc.creado = Instant.now();
        pc.persist();
    }

    @DELETE
    @Path("/push")
    @RolesAllowed(SesionCliente.ROL)
    @Transactional
    public void desuscribir(@Valid @NotNull AdminPedidoResource.Suscripcion s) {
        PushCliente.delete("endpoint = ?1 and cliente = ?2", s.endpoint(), sesion.cliente());
    }

    private static SesionDto sesionDe(Cliente c) {
        Instant expira = Instant.now().plus(DURACION_SESION);
        String token = Jwt.issuer("sierrasurenlinea")
                .subject(SesionCliente.PREFIJO + c.id)
                .upn("cliente:" + c.telefono)
                .groups(Set.of(SesionCliente.ROL))
                .issuedAt(Instant.now())
                .expiresAt(expira)
                .sign();
        return new SesionDto(token, expira, ClienteDto.de(c));
    }

    static String limpio(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
