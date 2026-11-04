package mx.turamohoy.catalogo.model;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.util.List;

/**
 * Agrupa los productos de un negocio: ramos, maquillaje, brincolines, mezcal, etc.
 */
@Entity
@Table(name = "categoria",
        uniqueConstraints = @UniqueConstraint(columnNames = {"negocio_id", "slug"}))
public class Categoria extends PanacheEntityBase {

    @Id
    public Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "negocio_id", nullable = false)
    public Negocio negocio;

    /** Identificador amigable para URLs, único dentro de su negocio, p. ej. "ramos". */
    @Column(nullable = false, length = 60)
    public String slug;

    @Column(nullable = false, length = 80)
    public String nombre;

    @Column(length = 255)
    public String descripcion;

    /** Orden en que se muestra en el menú del negocio. */
    @Column(nullable = false)
    public int orden;

    public static List<Categoria> todas() {
        return list("select c from Categoria c join fetch c.negocio n order by n.orden, c.orden");
    }

    public static List<Categoria> delNegocio(Negocio negocio) {
        return list("negocio = ?1 order by orden", negocio);
    }
}
