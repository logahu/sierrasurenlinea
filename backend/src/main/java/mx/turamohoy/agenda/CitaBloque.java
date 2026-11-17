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
import mx.turamohoy.pedidos.Pedido;

import java.time.LocalDateTime;

/**
 * Un bloque de tiempo apartado con un profesional. La llave única (empleado, inicio) impide
 * que dos citas ocupen la misma hora aunque se pidan al mismo tiempo.
 */
@Entity
@Table(name = "cita_bloque")
public class CitaBloque extends PanacheEntityBase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "pedido_id")
    public Pedido pedido;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "empleado_id")
    public Usuario empleado;

    @Column(nullable = false)
    public LocalDateTime inicio;
}
