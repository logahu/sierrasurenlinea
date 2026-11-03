package mx.turamohoy.catalogo.model;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * Agrupa los productos del catálogo: ramos, arreglos, flores sueltas, etc.
 */
@Entity
@Table(name = "categoria")
public class Categoria extends PanacheEntityBase {

    @Id
    public Long id;

    /** Identificador amigable para URLs, p. ej. "ramos". */
    @Column(nullable = false, unique = true, length = 60)
    public String slug;

    @Column(nullable = false, length = 80)
    public String nombre;

    @Column(length = 255)
    public String descripcion;

    /** Orden en que se muestra en el menú del catálogo. */
    @Column(nullable = false)
    public int orden;
}
