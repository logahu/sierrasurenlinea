package mx.turamohoy.catalogo.model;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.SequenceGenerator;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.util.List;

/**
 * Un artículo visible en el catálogo de un negocio: un ramo, un labial,
 * un brincolín en renta, una botella de mezcal...
 */
@Entity
@Table(name = "producto")
public class Producto extends PanacheEntityBase {

    private static final String BASE = "select p from Producto p join fetch p.categoria c join fetch c.negocio n ";
    private static final String ORDEN = " order by p.destacado desc, p.nombre";

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "producto_seq")
    @SequenceGenerator(name = "producto_seq", sequenceName = "producto_seq", allocationSize = 1)
    public Long id;

    @Column(nullable = false, length = 120)
    public String nombre;

    @Column(length = 1000)
    public String descripcion;

    /** Precio en MXN. Por ahora solo se muestra; aún no se cobra en línea. */
    @Column(nullable = false, precision = 10, scale = 2)
    public BigDecimal precio;

    /**
     * Unidad del precio cuando no es una venta simple, p. ej. "por día" o
     * "por evento" en los negocios de renta. Nulo = precio de venta.
     */
    @Column(name = "unidad_precio", length = 30)
    public String unidadPrecio;

    /**
     * Datos clave separados por "|", p. ej. "Medidas: 4 × 4 m|Capacidad: 8 niños".
     * Se muestran como lista en el detalle del producto.
     */
    @Column(length = 500)
    public String caracteristicas;

    /** Ruta de la imagen. Puede ser relativa al frontend (img/...) o una URL absoluta. */
    @Column(name = "imagen_url", nullable = false, length = 500)
    public String imagenUrl;

    /** Fotos adicionales (galería), URLs separadas por "|". */
    @Column(length = 2000)
    public String galeria;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "categoria_id", nullable = false)
    public Categoria categoria;

    @Column(nullable = false)
    public boolean destacado;

    @Column(nullable = false)
    public boolean disponible;

    /**
     * En negocios con agenda: cuántos bloques de {@code negocio.minutosCita} ocupa este servicio
     * (p. ej. con bloques de 30 min, una limpieza 1 y una ortodoncia 2). Entre 1 y 8.
     */
    @Column(name = "bloques_cita", nullable = false)
    public int bloquesCita = 1;

    public static List<Producto> disponibles(boolean probador) {
        return list(BASE + "where p.disponible = true and n.estado in ?1" + ORDEN, Negocio.estadosVisibles(probador));
    }

    public static List<Producto> disponiblesDelNegocio(String slugNegocio) {
        return list(BASE + "where p.disponible = true and n.slug = ?1" + ORDEN, slugNegocio);
    }

    public static List<Producto> disponiblesDelNegocio(String slugNegocio, String slugCategoria) {
        return list(BASE + "where p.disponible = true and n.slug = ?1 and c.slug = ?2" + ORDEN,
                slugNegocio, slugCategoria);
    }

    public static Producto buscarCompleto(Long id) {
        return find(BASE + "where p.id = ?1", id).firstResult();
    }
}
