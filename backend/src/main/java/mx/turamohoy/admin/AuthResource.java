package mx.turamohoy.admin;

import mx.turamohoy.historial.Bitacora;
import io.quarkus.elytron.security.common.BcryptUtil;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.security.Authenticated;
import io.smallrye.jwt.build.Jwt;
import jakarta.annotation.security.PermitAll;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response.Status;

import java.time.Duration;
import java.time.Instant;
import java.util.Set;

/** Entrada al panel: teléfono (o correo) y contraseña a cambio de un token que dura 8 horas. */
@Path("/api/auth")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class AuthResource {

    static final Duration DURACION_SESION = Duration.ofHours(8);
    static final int INTENTOS_MAXIMOS = 5;
    static final Duration ESPERA_TRAS_BLOQUEO = Duration.ofMinutes(15);

    /** Para tardar lo mismo cuando el correo no existe y no delatar qué correos sí existen. */
    private static final String HASH_SIMULADO = BcryptUtil.bcryptHash("no-es-una-contrasena-real");

    @Inject
    SesionActual sesion;

    /** {@code correo}: el teléfono (10 dígitos) o el correo, lo que la persona escriba. */
    public record EntrarRequest(@NotBlank String correo, @NotBlank String contrasena) {
    }

    public record SesionDto(String token, Instant expira, UsuarioDto usuario) {
    }

    public record CambioContrasena(@NotBlank String actual, @NotBlank String nueva) {
    }

    private enum Estado { OK, FALLIDO, BLOQUEADO }

    private record Intento(Estado estado, UsuarioDto usuario, long minutos) {
    }

    @POST
    @Path("/entrar")
    @PermitAll
    public SesionDto entrar(@Valid @NotNull EntrarRequest req) {
        // El conteo de intentos se guarda en su propia transacción: si se lanzara el
        // error dentro de ella, la base desharía también el conteo.
        Intento intento = QuarkusTransaction.requiringNew().call(() -> intentar(req.correo(), req.contrasena()));
        if (intento.estado() == Estado.BLOQUEADO) {
            throw Errores.de(429, "Demasiados intentos. Vuelve a intentar en " + intento.minutos()
                    + (intento.minutos() == 1 ? " minuto." : " minutos."));
        }
        if (intento.estado() == Estado.FALLIDO) {
            throw Errores.de(Status.UNAUTHORIZED, "Teléfono, correo o contraseña incorrectos.");
        }
        UsuarioDto u = intento.usuario();
        Instant expira = Instant.now().plus(DURACION_SESION);
        String token = Jwt.issuer(Jwts.EMISOR)
                .subject(String.valueOf(u.id()))
                .upn(u.correo() != null ? u.correo() : u.telefono())
                .groups(Set.of(u.rol()))
                .issuedAt(Instant.now())
                .expiresAt(expira)
                .sign();
        return new SesionDto(token, expira, u);
    }

    private Intento intentar(String correo, String contrasena) {
        Usuario u = Usuario.porCorreoOTelefono(correo).orElse(null);
        if (u == null || !u.activo) {
            Contrasenas.coincide(contrasena, HASH_SIMULADO);
            return new Intento(Estado.FALLIDO, null, 0);
        }
        Instant ahora = Instant.now();
        if (u.bloqueadoHasta != null && u.bloqueadoHasta.isAfter(ahora)) {
            return new Intento(Estado.BLOQUEADO, null, minutosHasta(ahora, u.bloqueadoHasta));
        }
        if (!Contrasenas.coincide(contrasena, u.contrasenaHash)) {
            u.intentosFallidos++;
            if (u.intentosFallidos >= INTENTOS_MAXIMOS) {
                u.intentosFallidos = 0;
                u.bloqueadoHasta = ahora.plus(ESPERA_TRAS_BLOQUEO);
                return new Intento(Estado.BLOQUEADO, null, ESPERA_TRAS_BLOQUEO.toMinutes());
            }
            return new Intento(Estado.FALLIDO, null, 0);
        }
        u.intentosFallidos = 0;
        u.bloqueadoHasta = null;
        return new Intento(Estado.OK, UsuarioDto.de(u), 0);
    }

    private static long minutosHasta(Instant ahora, Instant hasta) {
        return Math.max(1, (Duration.between(ahora, hasta).getSeconds() + 59) / 60);
    }

    /** Quién soy: la pantalla lo usa para saber si la sesión guardada sigue sirviendo. */
    @GET
    @Path("/yo")
    @Authenticated
    public UsuarioDto yo() {
        return UsuarioDto.de(sesion.usuario());
    }

    @PUT
    @Path("/contrasena")
    @Authenticated
    @Transactional
    public void cambiarContrasena(@Valid @NotNull CambioContrasena req) {
        Usuario u = sesion.usuario();
        if (!Contrasenas.coincide(req.actual(), u.contrasenaHash)) {
            throw Errores.de(Status.BAD_REQUEST, "La contraseña actual no es correcta.");
        }
        Contrasenas.validarNueva(req.nueva());
        u.contrasenaHash = Contrasenas.cifrar(req.nueva());
        Bitacora.anotar(u, u.negocio, Bitacora.USUARIO, u.id, "Cambió su contraseña", null);
    }
}
