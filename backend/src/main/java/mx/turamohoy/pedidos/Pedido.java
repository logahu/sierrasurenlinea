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
import mx.turamohoy.admin.Usuario;
import mx.turamohoy.catalogo.model.Negocio;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Set;

/** Un pedido o encargo hecho en el sitio. */
@Entity
@Table(name = "pedido")
public class Pedido extends PanacheEntityBase {

    public static final String NUEVO = "NUEVO";
    public static final String ACEPTADO = "ACEPTADO";
    public static final String EN_CAMINO = "EN_CAMINO";
    public static final String ENTREGADO = "ENTREGADO";
    public static final String CANCELADO = "CANCELADO";
    public static final Set<String> ACTIVOS = Set.of(NUEVO, ACEPTADO, EN_CAMINO);

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "negocio_id")
    public Negocio negocio;

    @Column(length = 20, unique = true)
    public String folio;

    @Column(nullable = false, length = 60)
    public String tipo;

    @Column(nullable = false, length = 10)
    public String modo;

    @Column(name = "cliente_nombre", nullable = false, length = 80)
    public String clienteNombre;

    @Column(name = "cliente_telefono", nullable = false, length = 15)
    public String clienteTelefono;

    @Column(nullable = false, length = 300)
    public String entregar;

    @Column(length = 80)
    public String zona;

    @Column(name = "total_estimado", precision = 10, scale = 2)
    public BigDecimal totalEstimado;

    @Column(nullable = false, length = 4000)
    public String mensaje;

    @Column(nullable = false, length = 12)
    public String estado = NUEVO;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "repartidor_id")
    public Usuario repartidor;

    /** Cliente con cuenta que hizo el pedido. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cliente_id")
    public mx.turamohoy.clientes.Cliente cliente;

    @Column(nullable = false)
    public Instant creado = Instant.now();

    @Column(nullable = false)
    public Instant actualizado = Instant.now();

    public boolean activo() {
        return ACTIVOS.contains(estado);
    }

    /** ENC-00012: tres letras del negocio y el número. */
    public static String folioDe(Negocio n, long id) {
        String prefijo = n.slug.replaceAll("[^a-z]", "").toUpperCase();
        return prefijo.substring(0, Math.min(3, prefijo.length())) + "-" + String.format("%05d", id);
    }
}
