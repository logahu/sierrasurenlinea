package mx.turamohoy.admin;

import mx.turamohoy.catalogo.model.ModoPedido;

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
        boolean atiendeCitas,
        /** Su negocio se pide por citas: la agenda es su página de inicio en el panel. */
        boolean negocioConAgenda) {

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
                u.atiendeEnAgenda(),
                u.negocio != null && ModoPedido.CITA.equals(u.negocio.modoPedido()));
    }
}
