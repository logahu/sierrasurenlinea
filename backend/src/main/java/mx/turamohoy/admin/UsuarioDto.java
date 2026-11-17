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
        boolean bloqueado,
        /** Creada con «Crear usuarios de prueba». */
        boolean dePrueba,
        Instant creado,
        /** Pedidos entregados (solo repartidores; 0 para los demás). */
        long entregas,
        /** Empleados: «Cortes, barba». */
        String especialidades,
        /** Aparece en la agenda de citas. */
        boolean atiendeCitas) {

    public static UsuarioDto de(Usuario u) {
        return de(u, 0);
    }

    public static UsuarioDto de(Usuario u, long entregas) {
        return new UsuarioDto(u.id, u.correo, u.telefono, u.nombre, u.rol,
                u.negocio == null ? null : u.negocio.slug,
                u.negocio == null ? null : u.negocio.nombre,
                u.activo,
                u.bloqueadoHasta != null && u.bloqueadoHasta.isAfter(Instant.now()),
                u.dePrueba,
                u.creado,
                entregas,
                u.especialidades,
                u.atiendeEnAgenda());
    }
}
