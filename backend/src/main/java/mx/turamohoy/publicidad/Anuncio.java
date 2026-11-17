package mx.turamohoy.publicidad;

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
import mx.turamohoy.agenda.Agenda;
import mx.turamohoy.catalogo.model.Negocio;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;

/**
 * Banner de publicidad de la portada. Siempre se muestra con la etiqueta «Publicidad» y el
 * visitante lo puede ocultar. Solo lo administra el dueño del sitio.
 */
@Entity
@Table(name = "anuncio")
public class Anuncio extends PanacheEntityBase {

    /** Bajo el encabezado de la portada. */
    public static final String PORTADA_ARRIBA = "PORTADA_ARRIBA";
    /** Después de la segunda calle. */
    public static final String ENTRE_CALLES = "ENTRE_CALLES";
    public static final Set<String> POSICIONES = Set.of(PORTADA_ARRIBA, ENTRE_CALLES);

    /** Reloj de Miahuatlán (las pruebas lo fijan). */
    static Clock reloj = Clock.system(Agenda.ZONA);

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @Column(nullable = false, length = 80)
    public String titulo;

    @Column(length = 200)
    public String texto;

    @Column(name = "imagen_url", length = 500)
    public String imagenUrl;

    /** Ruta del sitio (/turamohoy) o URL https://; vacío = no lleva a ningún lado. */
    @Column(length = 300)
    public String enlace;

    /** Negocio que se anuncia (opcional). Si deja de verse, su anuncio tampoco se muestra. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "negocio_id")
    public Negocio negocio;

    @Column(name = "color_fondo", length = 7)
    public String colorFondo;

    @Column(nullable = false, length = 20)
    public String posicion;

    /** Fechas de Miahuatlán, inclusivas; vacías = sin límite. */
    public LocalDate inicio;
    public LocalDate fin;

    @Column(nullable = false)
    public boolean activo = true;

    @Column(nullable = false)
    public int orden;

    public Instant creado;

    public static LocalDate hoy() {
        return LocalDate.now(reloj);
    }

    /** Activo y dentro de sus fechas. */
    public boolean vigente(LocalDate hoy) {
        return activo && (inicio == null || !hoy.isBefore(inicio)) && (fin == null || !hoy.isAfter(fin));
    }

    /** Los que se muestran hoy en esa posición, en orden. */
    public static List<Anuncio> vigentes(String posicion, LocalDate hoy) {
        return Anuncio.<Anuncio>find("select a from Anuncio a left join fetch a.negocio where a.posicion = ?1"
                        + " and a.activo = true and (a.inicio is null or a.inicio <= ?2) and (a.fin is null or a.fin >= ?2)"
                        + " order by a.orden, a.id", posicion, hoy)
                .list();
    }
}
