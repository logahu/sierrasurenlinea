package mx.turamohoy.admin;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import mx.turamohoy.catalogo.model.Negocio;

import java.time.Instant;
import java.util.Locale;
import java.util.Optional;

/** Persona que entra al panel de administración. */
@Entity
@Table(name = "usuario")
public class Usuario extends PanacheEntityBase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    /** Siempre en minúsculas y sin espacios. Opcional: también se puede entrar con el teléfono. */
    @Column(unique = true, length = 120)
    public String correo;

    /** 10 dígitos; con él se entra al panel (igual que los clientes en el sitio). */
    @Column(unique = true, length = 10)
    public String telefono;

    @Column(nullable = false, length = 80)
    public String nombre;

    /** Hash bcrypt de la contraseña; la contraseña nunca se guarda. */
    @Column(name = "contrasena_hash", nullable = false, length = 100)
    public String contrasenaHash;

    /** {@link Rol#DUENO} o {@link Rol#ENCARGADO}. */
    @Column(nullable = false, length = 10)
    public String rol;

    /** Negocio que atiende el encargado; nulo para el dueño. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "negocio_id")
    public Negocio negocio;

    /** Un usuario inactivo no puede entrar y sus sesiones abiertas dejan de servir. */
    @Column(nullable = false)
    public boolean activo = true;

    @Column(name = "intentos_fallidos", nullable = false)
    public int intentosFallidos;

    /** Tras varios intentos fallidos, la cuenta espera hasta esta hora. */
    @Column(name = "bloqueado_hasta")
    public Instant bloqueadoHasta;

    @Column(nullable = false)
    public Instant creado = Instant.now();

    /** Cuenta creada con «Crear usuarios de prueba». */
    @Column(name = "de_prueba", nullable = false)
    public boolean dePrueba;

    public boolean esDueno() {
        return Rol.DUENO.equals(rol);
    }

    /** El dueño puede con todos los negocios; el encargado, solo con el suyo. */
    public boolean puedeEditar(Negocio n) {
        return esDueno() || (Rol.ENCARGADO.equals(rol) && negocio != null && negocio.id.equals(n.id));
    }

    public static String normalizarCorreo(String correo) {
        return correo == null ? null : correo.trim().toLowerCase(Locale.ROOT);
    }

    public static Optional<Usuario> porCorreo(String correo) {
        return find("correo", normalizarCorreo(correo)).firstResultOptional();
    }

    public static Optional<Usuario> porTelefono(String telefono) {
        String t = mx.turamohoy.clientes.Cliente.normalizarTelefono(telefono);
        return t == null ? Optional.empty() : find("telefono", t).firstResultOptional();
    }

    /** Lo que escribió para entrar: si tiene @ es correo; si no, teléfono. */
    public static Optional<Usuario> porCorreoOTelefono(String usuario) {
        if (usuario == null || usuario.isBlank()) {
            return Optional.empty();
        }
        return usuario.contains("@") ? porCorreo(usuario) : porTelefono(usuario);
    }

    /** Encargado activo de un negocio, si lo tiene. */
    public static Optional<Usuario> encargadoDe(Negocio n) {
        return find("rol = ?1 and negocio = ?2 and activo = true", Rol.ENCARGADO, n).firstResultOptional();
    }
}
