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
import java.util.Set;

/** Una tarjeta de "Tu lista del mandado" en un negocio de servicio (Encarguitos). */
@Entity
@Table(name = "tipo_encargo")
public class TipoEncargo extends PanacheEntityBase {

    public static final String MANDADO = "MANDADO";
    public static final String VIAJE = "VIAJE";
    public static final String COMIDA = "COMIDA";
    public static final Set<String> MODOS = Set.of(MANDADO, VIAJE, COMIDA);
    /** Íconos que sabe dibujar el sitio. */
    public static final Set<String> ICONOS = Set.of("bolsa", "caja", "recibo", "estrella", "moto", "pastilla", "llave", "plato");

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "negocio_id")
    public Negocio negocio;

    @Column(nullable = false, length = 60)
    public String titulo;

    @Column(length = 80)
    public String ayuda;

    @Column(length = 200)
    public String ejemplo;

    @Column(name = "etiqueta_recoger", nullable = false, length = 60)
    public String etiquetaRecoger;

    @Column(name = "recoger_obligatorio", nullable = false)
    public boolean recogerObligatorio;

    @Column(name = "maneja_dinero", nullable = false)
    public boolean manejaDinero;

    @Column(nullable = false, length = 10)
    public String modo = MANDADO;

    @Column(nullable = false, length = 20)
    public String icono = "estrella";

    @Column(name = "solo_programado", nullable = false)
    public boolean soloProgramado;

    @Column(nullable = false)
    public int orden;

    @Column(nullable = false)
    public boolean visible = true;

    public static List<TipoEncargo> delNegocio(Negocio n) {
        return list("negocio = ?1 order by orden, id", n);
    }

    public static List<TipoEncargo> visiblesDe(Negocio n) {
        return list("negocio = ?1 and visible = true order by orden, id", n);
    }
}
