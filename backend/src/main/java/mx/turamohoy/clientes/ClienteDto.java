package mx.turamohoy.clientes;

import java.time.Instant;

/** Datos de la cuenta del cliente (nunca la contraseña). */
public record ClienteDto(Long id, String nombre, String telefono, String correo, String direccion, boolean activo,
                         Instant creado, Instant ultimoAcceso) {

    public static ClienteDto de(Cliente c) {
        return new ClienteDto(c.id, c.nombre, c.telefono, c.correo, c.direccion, c.activo, c.creado, c.ultimoAcceso);
    }
}
