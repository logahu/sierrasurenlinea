package mx.turamohoy.agenda;

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
import mx.turamohoy.admin.Usuario;
import mx.turamohoy.catalogo.model.Negocio;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Un rango sin servicio. Sin empleado aplica a todo el negocio; con empleado, solo a esa
 * persona (los demás siguen atendiendo).
 */
@Entity
@Table(name = "agenda_bloqueo")
public class AgendaBloqueo extends PanacheEntityBase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "negocio_id")
    public Negocio negocio;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "empleado_id")
    public Usuario empleado;

    @Column(nullable = false)
    public LocalDateTime inicio;

    @Column(nullable = false)
    public LocalDateTime fin;

    @Column(length = 80)
    public String motivo;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "creado_por_id")
    public Usuario creadoPor;

    @Column(nullable = false)
    public LocalDateTime creado = LocalDateTime.now();

    /** Bloqueos del negocio que se cruzan con [desde, hasta). */
    public static List<AgendaBloqueo> entre(Negocio n, LocalDateTime desde, LocalDateTime hasta) {
        return find("select b from AgendaBloqueo b left join fetch b.empleado where b.negocio = ?1"
                + " and b.inicio < ?3 and b.fin > ?2 order by b.inicio", n, desde, hasta).list();
    }

    /** ¿Cubre a esa persona en algún momento de [desde, hasta)? */
    public boolean cubre(Long empleadoId, LocalDateTime desde, LocalDateTime hasta) {
        return (empleado == null || empleado.id.equals(empleadoId)) && inicio.isBefore(hasta) && fin.isAfter(desde);
    }

    public boolean deTodos() {
        return empleado == null;
    }
}
