package mx.turamohoy.pedidos;

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
import mx.turamohoy.catalogo.model.Producto;

import java.math.BigDecimal;

/**
 * Un renglón del pedido. Guarda el nombre y el precio del momento: el historial no cambia
 * si después se edita o se da de baja el producto.
 */
@Entity
@Table(name = "pedido_linea")
public class PedidoLinea extends PanacheEntityBase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "pedido_id")
    public Pedido pedido;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "producto_id")
    public Producto producto;

    @Column(nullable = false, length = 120)
    public String nombre;

    @Column(nullable = false)
    public int cantidad;

    @Column(name = "precio_unitario", nullable = false, precision = 10, scale = 2)
    public BigDecimal precioUnitario;

    @Column(length = 30)
    public String unidad;

    @Column(nullable = false)
    public int orden;

    /** Comida a domicilio: el platillo, para quién es, lo que eligió y su nota. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "platillo_id")
    public mx.turamohoy.catalogo.model.Platillo platillo;

    @Column(length = 60)
    public String persona;

    @Column(length = 400)
    public String detalle;

    @Column(length = 200)
    public String nota;

    public BigDecimal subtotal() {
        return precioUnitario.multiply(BigDecimal.valueOf(cantidad));
    }
}
