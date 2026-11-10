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

import java.util.List;

/** Lugar de comida (fonda, taquería...) del catálogo de "Comida a domicilio" de Encarguitos. */
@Entity
@Table(name = "restaurante")
public class Restaurante extends PanacheEntityBase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "negocio_id")
    public Negocio negocio;

    @Column(nullable = false, length = 80)
    public String nombre;

    @Column(length = 200)
    public String descripcion;

    @Column(length = 120)
    public String horario;

    @Column(length = 200)
    public String direccion;

    @Column(name = "imagen_url", length = 500)
    public String imagenUrl;

    @Column(nullable = false)
    public int orden;

    @Column(nullable = false)
    public boolean visible = true;

    public static List<Restaurante> delNegocio(Negocio n) {
        return list("negocio = ?1 order by orden, id", n);
    }

    public static List<Restaurante> visiblesDe(Negocio n) {
        return list("negocio = ?1 and visible = true order by orden, id", n);
    }
}
