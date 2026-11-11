package mx.turamohoy.admin;

import java.time.Instant;

/** Datos de un usuario que ve el panel (nunca incluye la contraseña). */
public record UsuarioDto(
        Long id,
        String correo,
        String telefono,
        String nombre,
        String rol,
        String negocioSlug,
        String negocioNombre,
        boolean activo,
        boolean bloqueado) {

    public static UsuarioDto de(Usuario u) {
        return new UsuarioDto(u.id, u.correo, u.telefono, u.nombre, u.rol,
                u.negocio == null ? null : u.negocio.slug,
                u.negocio == null ? null : u.negocio.nombre,
                u.activo,
                u.bloqueadoHasta != null && u.bloqueadoHasta.isAfter(Instant.now()));
    }
}
