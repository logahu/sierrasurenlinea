package mx.turamohoy.catalogo.model;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.util.Optional;

/**
 * Un negocio dentro de Sierra Sur en Línea (TuRamoHoy, cosméticos, inflables...).
 * Cada uno tiene su propia identidad visual y sus datos de contacto.
 */
@Entity
@Table(name = "negocio")
public class Negocio extends PanacheEntityBase {

    @Id
    public Long id;

    /** Identificador para la URL, p. ej. "turamohoy" → /turamohoy. */
    @Column(nullable = false, unique = true, length = 60)
    public String slug;

    @Column(nullable = false, length = 80)
    public String nombre;

    @Column(length = 140)
    public String eslogan;

    @Column(length = 600)
    public String descripcion;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    public TipoNegocio tipo;

    /** Color de acento en hexadecimal, p. ej. "#d6336c". */
    @Column(name = "color_primario", nullable = false, length = 7)
    public String colorPrimario;

    /** Imagen que representa al negocio en la portada. */
    @Column(name = "portada_url", nullable = false, length = 500)
    public String portadaUrl;

    /** Número de WhatsApp con lada internacional y sin espacios, p. ej. "5219511234567". */
    @Column(nullable = false, length = 20)
    public String whatsapp;

    @Column(length = 30)
    public String telefono;

    @Column(length = 200)
    public String direccion;

    @Column(length = 120)
    public String horario;

    /** Si es true, el sitio muestra el aviso de venta solo a mayores de 18 años. */
    @Column(name = "solo_mayores_edad", nullable = false)
    public boolean soloMayoresEdad;

    @Column(nullable = false)
    public int orden;

    /** Si es false, el negocio no aparece en el sitio (se oculta desde el panel). */
    @Column(nullable = false)
    public boolean visible = true;

    public static Optional<Negocio> porSlug(String slug) {
        return find("slug", slug).firstResultOptional();
    }

    /** Solo si está visible en el sitio público. */
    public static Optional<Negocio> visiblePorSlug(String slug) {
        return find("slug = ?1 and visible = true", slug).firstResultOptional();
    }
}
