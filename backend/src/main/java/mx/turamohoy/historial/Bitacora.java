package mx.turamohoy.historial;

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
import mx.turamohoy.clientes.Cliente;

import java.time.Instant;

/**
 * Un renglón del historial: quién hizo qué y cuándo. Solo se agregan renglones; nunca se
 * editan ni se borran. Se escribe dentro de la misma transacción del cambio, así que si el
 * cambio no se guarda, tampoco queda en el historial.
 */
@Entity
@Table(name = "bitacora")
public class Bitacora extends PanacheEntityBase {

    public static final String NEGOCIO = "NEGOCIO";
    public static final String PRODUCTO = "PRODUCTO";
    public static final String CATEGORIA = "CATEGORIA";
    public static final String USUARIO = "USUARIO";
    public static final String CLIENTE = "CLIENTE";
    public static final String PEDIDO = "PEDIDO";
    public static final String FOTO = "FOTO";
    public static final String ENCARGO = "ENCARGO";
    public static final String COMIDA = "COMIDA";
    public static final String COLONIA = "COLONIA";
    public static final String ANUNCIO = "ANUNCIO";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @Column(nullable = false)
    public Instant cuando;

    @Column(name = "actor_tipo", nullable = false, length = 10)
    public String actorTipo;

    @Column(name = "actor_id")
    public Long actorId;

    @Column(name = "actor_nombre", nullable = false, length = 80)
    public String actorNombre;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "negocio_id")
    public Negocio negocio;

    @Column(nullable = false, length = 20)
    public String entidad;

    @Column(name = "entidad_id")
    public Long entidadId;

    @Column(nullable = false, length = 200)
    public String accion;

    @Column(length = 1000)
    public String detalle;

    /** Algo que hizo una persona del panel. */
    public static void anotar(Usuario quien, Negocio negocio, String entidad, Long entidadId, String accion,
                              String detalle) {
        nuevo("USUARIO", quien.id, quien.nombre, negocio, entidad, entidadId, accion, detalle);
    }

    /** Algo que hizo un cliente en el sitio. */
    public static void anotar(Cliente quien, Negocio negocio, String entidad, Long entidadId, String accion,
                              String detalle) {
        nuevo("CLIENTE", quien.id, quien.nombre, negocio, entidad, entidadId, accion, detalle);
    }

    /** Algo que hizo el sistema solo (p. ej. crear la primera cuenta). */
    public static void delSistema(String entidad, Long entidadId, String accion, String detalle) {
        nuevo("SISTEMA", null, "Sistema", null, entidad, entidadId, accion, detalle);
    }

    private static void nuevo(String tipo, Long actorId, String nombre, Negocio negocio, String entidad,
                              Long entidadId, String accion, String detalle) {
        Bitacora b = new Bitacora();
        b.cuando = Instant.now();
        b.actorTipo = tipo;
        b.actorId = actorId;
        b.actorNombre = recortar(nombre, 80);
        b.negocio = negocio;
        b.entidad = entidad;
        b.entidadId = entidadId;
        b.accion = recortar(accion, 200);
        b.detalle = detalle == null || detalle.isBlank() ? null : recortar(detalle, 1000);
        b.persist();
    }

    static String recortar(String s, int max) {
        return s.length() <= max ? s : s.substring(0, max - 1) + "…";
    }
}
