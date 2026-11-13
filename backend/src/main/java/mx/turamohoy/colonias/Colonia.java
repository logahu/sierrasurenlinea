package mx.turamohoy.colonias;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.text.Normalizer;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

/** Colonia, barrio o comunidad que se ofrece al hacer un pedido. */
@Entity
@Table(name = "colonia")
public class Colonia extends PanacheEntityBase {

    public static final String ACTIVA = "ACTIVA";
    public static final String SOLICITADA = "SOLICITADA";
    public static final List<String> TIPOS = List.of("Barrio", "Colonia", "Fraccionamiento", "Ranchería", "Agencia",
            "Localidad");

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @Column(nullable = false, length = 100)
    public String nombre;

    @Column(nullable = false, length = 20)
    public String tipo = "Colonia";

    @Column(name = "codigo_postal", length = 5)
    public String codigoPostal;

    /** Nombre de la tarifa de Encarguitos (p. ej. "Centro"); null = el cliente elige la zona. */
    @Column(length = 80)
    public String zona;

    @Column(nullable = false, length = 12)
    public String estado = ACTIVA;

    /** SEPOMEX, ADMIN o CLIENTE. */
    @Column(nullable = false, length = 10)
    public String origen = "ADMIN";

    /** Cuántas veces la escribieron clientes en «Otra». */
    @Column(nullable = false)
    public int solicitudes;

    @Column(nullable = false)
    public Instant creada = Instant.now();

    /** Sin acentos, mayúsculas ni espacios de más: «Sta. Cecilia» y «sta cecilia» se comparan igual. */
    public static String clave(String nombre) {
        String s = Normalizer.normalize(nombre == null ? "" : nombre, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        return s.toLowerCase().replaceAll("[^a-z0-9]+", " ").trim();
    }

    /** La primera con ese nombre (sin importar acentos ni tipo). */
    public static Optional<Colonia> porNombre(String nombre) {
        String clave = clave(nombre);
        return Colonia.<Colonia>listAll().stream().filter(c -> clave(c.nombre).equals(clave)).findFirst();
    }
}
