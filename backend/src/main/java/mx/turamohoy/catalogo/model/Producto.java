package mx.turamohoy.catalogo.model;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.util.List;

/**
 * Un artículo visible en el catálogo (un ramo, un arreglo, una flor por pieza...).
 */
@Entity
@Table(name = "producto")
public class Producto extends PanacheEntityBase {

    @Id
    public Long id;

    @Column(nullable = false, length = 120)
    public String nombre;

    @Column(length = 1000)
    public String descripcion;

    /** Precio en MXN. En la fase 1 solo se muestra; aún no se cobra. */
    @Column(nullable = false, precision = 10, scale = 2)
    public BigDecimal precio;

    /** Ruta de la imagen. Puede ser relativa al frontend (img/...) o una URL absoluta. */
    @Column(name = "imagen_url", nullable = false, length = 500)
    public String imagenUrl;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "categoria_id", nullable = false)
    public Categoria categoria;

    @Column(nullable = false)
    public boolean destacado;

    @Column(nullable = false)
    public boolean disponible;

    public static List<Producto> disponibles() {
        return list("select p from Producto p join fetch p.categoria "
                + "where p.disponible = true order by p.destacado desc, p.nombre");
    }

    public static List<Producto> disponiblesPorCategoria(String slugCategoria) {
        return list("select p from Producto p join fetch p.categoria c "
                + "where p.disponible = true and c.slug = ?1 order by p.destacado desc, p.nombre",
                slugCategoria);
    }

    public static Producto buscarConCategoria(Long id) {
        return find("select p from Producto p join fetch p.categoria where p.id = ?1", id)
                .firstResult();
    }
}
