package mx.turamohoy.tianguis;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.util.List;
import java.util.Optional;

/** Categoría del tianguis (Vehículos, Motos…) con los campos propios de sus anuncios. */
@Entity
@Table(name = "tianguis_categoria")
public class CategoriaTianguis extends PanacheEntityBase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @Column(nullable = false, length = 60)
    public String nombre;

    @Column(nullable = false, length = 60, unique = true)
    public String slug;

    @Column(length = 30)
    public String icono;

    @Column(nullable = false)
    public int orden;

    @Column(nullable = false)
    public boolean activa = true;

    /** JSON con la definición de los campos (ver {@link CampoAtributo}). */
    @Column(name = "campos_atributos", nullable = false, length = 4000)
    public String camposAtributos = "[]";

    public List<CampoAtributo> campos() {
        return CampoAtributo.leer(camposAtributos);
    }

    public static Optional<CategoriaTianguis> activaPorSlug(String slug) {
        return find("slug = ?1 and activa = true", slug).firstResultOptional();
    }
}
