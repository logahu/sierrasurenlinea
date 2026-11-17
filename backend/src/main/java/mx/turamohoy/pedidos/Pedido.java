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
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import mx.turamohoy.admin.Usuario;
import mx.turamohoy.catalogo.model.Negocio;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
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

    /** Se lleva al domicilio del cliente (o al lugar del evento). */
    public static final String DOMICILIO = "DOMICILIO";
    /** El cliente pasa al negocio (recoger o ver el producto). */
    public static final String RECOGER = "RECOGER";

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

    /** Colonia, barrio o comunidad de entrega (texto: se conserva aunque cambie el catálogo). */
    @Column(length = 100)
    public String colonia;

    /** El cliente eligió «Otra» y la escribió él (se pidió agregarla al catálogo). */
    @Column(name = "colonia_otra", nullable = false)
    public boolean coloniaOtra;

    @Column(name = "total_estimado", precision = 10, scale = 2)
    public BigDecimal totalEstimado;

    @Column(nullable = false, length = 4000)
    public String mensaje;

    @Column(nullable = false, length = 12)
    public String estado = NUEVO;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "repartidor_id")
    public Usuario repartidor;

    /** Citas con agenda: quién atiende y de qué hora a qué hora (hora local de Miahuatlán). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "empleado_id")
    public Usuario empleado;

    @Column(name = "cita_inicio")
    public java.time.LocalDateTime citaInicio;

    @Column(name = "cita_fin")
    public java.time.LocalDateTime citaFin;

    /** Cliente con cuenta que hizo el pedido. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cliente_id")
    public mx.turamohoy.clientes.Cliente cliente;

    /** DOMICILIO o RECOGER; vacío en encargos (siempre a domicilio). */
    @Column(length = 10)
    public String entrega;

    /** Para cuándo: "Lo antes posible", la fecha del evento o de la cita. */
    @Column(length = 120)
    public String cuando;

    @Column(length = 500)
    public String notas;

    /** Pedido de un cliente probador: no cuenta en el tablero y se marca en el panel. */
    @Column(nullable = false)
    public boolean prueba;

    /** Punto de entrega marcado en el mapa (opcional). */
    @Column(precision = 9, scale = 6)
    public BigDecimal lat;

    @Column(precision = 9, scale = 6)
    public BigDecimal lng;

    @OneToMany(mappedBy = "pedido", fetch = FetchType.LAZY)
    @OrderBy("orden")
    public List<PedidoLinea> lineas = new ArrayList<>();

    @Column(nullable = false)
    public Instant creado = Instant.now();

    @Column(nullable = false)
    public Instant actualizado = Instant.now();

    /** Si alguien tiene que llevarlo (los repartidores generales solo ven estos). */
    public boolean aDomicilio() {
        return !RECOGER.equals(entrega);
    }

    public boolean activo() {
        return ACTIVOS.contains(estado);
    }

    /** ENC-00012: tres letras del negocio y el número. */
    public static String folioDe(Negocio n, long id) {
        String prefijo = n.slug.replaceAll("[^a-z]", "").toUpperCase();
        return prefijo.substring(0, Math.min(3, prefijo.length())) + "-" + String.format("%05d", id);
    }
}
