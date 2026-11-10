package mx.turamohoy.catalogo.model;

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

import java.math.BigDecimal;
import java.util.Collection;
import java.util.List;

/** Platillo del menú de un lugar de comida. */
@Entity
@Table(name = "platillo")
public class Platillo extends PanacheEntityBase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "restaurante_id")
    public Restaurante restaurante;

    @Column(nullable = false, length = 100)
    public String nombre;

    @Column(length = 300)
    public String descripcion;

    @Column(nullable = false, precision = 10, scale = 2)
    public BigDecimal precio;

    @Column(name = "imagen_url", length = 500)
    public String imagenUrl;

    @Column(nullable = false)
    public int orden;

    @Column(nullable = false)
    public boolean disponible = true;

    public static List<Platillo> deRestaurantes(Collection<Restaurante> restaurantes, boolean soloDisponibles) {
        if (restaurantes.isEmpty()) {
            return List.of();
        }
        return list("restaurante in ?1" + (soloDisponibles ? " and disponible = true" : "") + " order by orden, id",
                restaurantes);
    }
}
