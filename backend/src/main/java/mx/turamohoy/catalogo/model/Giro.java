package mx.turamohoy.catalogo.model;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import io.quarkus.panache.common.Sort;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.util.List;
import java.util.Optional;

/**
 * Giro de un negocio (Flores y regalos, Belleza, Fiestas y eventos…): cada giro es una
 * «calle» de la portada. Es tabla para poder agregar giros sin deploy.
 */
@Entity
@Table(name = "giro")
public class Giro extends PanacheEntityBase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    /** Para la URL: /giro/flores. */
    @Column(nullable = false, unique = true, length = 40)
    public String slug;

    @Column(nullable = false, length = 60)
    public String nombre;

    /** Nombre corto del dibujo (flor, belleza, fiesta…); el sitio lo pinta en SVG. */
    @Column(length = 30)
    public String icono;

    @Column(nullable = false)
    public int orden;

    public static List<Giro> enOrden() {
        return listAll(Sort.by("orden").and("id"));
    }

    public static Optional<Giro> porSlug(String slug) {
        return find("slug", slug).firstResultOptional();
    }
}
