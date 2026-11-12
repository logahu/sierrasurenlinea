package mx.turamohoy.clientes;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.Optional;

/** Persona que compra en el sitio. Entra con su teléfono y contraseña. */
@Entity
@Table(name = "cliente")
public class Cliente extends PanacheEntityBase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @Column(nullable = false, length = 80)
    public String nombre;

    @Column(nullable = false, length = 10, unique = true)
    public String telefono;

    @Column(length = 120)
    public String correo;

    @Column(length = 300)
    public String direccion;

    /** Puede ver los negocios en pruebas; sus pedidos se marcan como prueba. */
    @Column(nullable = false)
    public boolean probador;

    /** Cuenta creada con «Crear usuarios de prueba». */
    @Column(name = "de_prueba", nullable = false)
    public boolean dePrueba;

    /** Ubicación habitual marcada en el mapa (opcional). */
    @Column(precision = 9, scale = 6)
    public java.math.BigDecimal lat;

    @Column(precision = 9, scale = 6)
    public java.math.BigDecimal lng;

    @Column(name = "contrasena_hash", nullable = false, length = 100)
    public String contrasenaHash;

    @Column(nullable = false)
    public boolean activo = true;

    @Column(name = "intentos_fallidos", nullable = false)
    public int intentosFallidos;

    @Column(name = "bloqueado_hasta")
    public Instant bloqueadoHasta;

    @Column(name = "privacidad_aceptada", nullable = false)
    public Instant privacidadAceptada;

    @Column(name = "privacidad_version", nullable = false, length = 20)
    public String privacidadVersion;

    @Column(nullable = false)
    public Instant creado = Instant.now();

    @Column(name = "ultimo_acceso")
    public Instant ultimoAcceso;

    public static Optional<Cliente> porTelefono(String telefono) {
        return find("telefono", telefono).firstResultOptional();
    }

    /** "+52 951 123 4567" → "9511234567"; null si no son 10 dígitos. */
    public static String normalizarTelefono(String t) {
        if (t == null) {
            return null;
        }
        String d = t.replaceAll("\\D", "");
        if (d.length() == 12 && d.startsWith("52")) {
            d = d.substring(2);
        } else if (d.length() == 13 && d.startsWith("521")) {
            d = d.substring(3);
        }
        return d.length() == 10 ? d : null;
    }
}
