package mx.turamohoy.tianguis;

import com.fasterxml.jackson.core.type.TypeReference;
import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.ws.rs.core.Response.Status;
import mx.turamohoy.admin.Errores;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Un artículo a la venta o un servicio ofrecido en el tianguis (lo decide su categoría). */
@Entity
@Table(name = "tianguis_anuncio")
public class AnuncioTianguis extends PanacheEntityBase {

    public enum Condicion { NUEVO_SIN_USO, SEMINUEVO, USADO, REPARADO }

    /** Fijo: el precio exacto. Desde: «desde $300». Cotizar: sin precio. Los artículos siempre son FIJO. */
    public enum TipoPrecio { FIJO, DESDE, COTIZAR }

    public enum Estado { PENDIENTE, PUBLICADO, VENDIDO, VENCIDO, RECHAZADO, PAUSADO }

    /** Clasificado: lo vende su dueño. Consignación / propio: reservados para después (fase 3). */
    public enum Modalidad { CLASIFICADO, CONSIGNACION, PROPIO }

    /** Quién lo pausó: el vendedor puede reanudar solo lo que él pausó. */
    public static final String POR_VENDEDOR = "VENDEDOR";
    public static final String POR_ADMIN = "ADMIN";
    public static final String POR_REPORTES = "REPORTES";
    public static final String POR_BLOQUEO = "BLOQUEO";

    /** Cambios de estado que puede hacer el panel (VENCIDO lo pone el sistema). */
    static final Map<Estado, Set<Estado>> TRANSICIONES = Map.of(
            Estado.PENDIENTE, EnumSet.of(Estado.PUBLICADO, Estado.RECHAZADO),
            Estado.PUBLICADO, EnumSet.of(Estado.PAUSADO, Estado.VENDIDO, Estado.RECHAZADO),
            Estado.PAUSADO, EnumSet.of(Estado.PUBLICADO, Estado.VENDIDO, Estado.RECHAZADO),
            Estado.VENCIDO, EnumSet.of(Estado.PUBLICADO, Estado.VENDIDO),
            Estado.RECHAZADO, EnumSet.of(Estado.PUBLICADO, Estado.PENDIENTE),
            Estado.VENDIDO, EnumSet.of(Estado.PUBLICADO));

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @Column(nullable = false, length = 80)
    public String titulo;

    @Column(nullable = false, length = 2000)
    public String descripcion;

    /** Nulo solo si es «a cotizar». */
    @Column(precision = 12, scale = 2)
    public BigDecimal precio;

    @Enumerated(EnumType.STRING)
    @Column(name = "tipo_precio", nullable = false, length = 10)
    public TipoPrecio tipoPrecio = TipoPrecio.FIJO;

    @Column(nullable = false)
    public boolean negociable;

    /** Solo artículos; los servicios no llevan condición. */
    @Enumerated(EnumType.STRING)
    @Column(length = 15)
    public Condicion condicion;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    public Estado estado = Estado.PENDIENTE;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 12)
    public Modalidad modalidad = Modalidad.CLASIFICADO;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "categoria_id")
    public CategoriaTianguis categoria;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "vendedor_id")
    public VendedorTianguis vendedor;

    /** JSON: URLs públicas en orden; la primera es la portada. */
    @Column(nullable = false, length = 4000)
    public String fotos = "[]";

    /** JSON: {marca: "Nissan", anio: "2015"…} validado contra la categoría. */
    @Column(nullable = false, length = 4000)
    public String atributos = "{}";

    /** Localidad o colonia; nunca la dirección exacta. */
    @Column(nullable = false, length = 80)
    public String ubicacion;

    /** Reservado para los destacados de pago (fase 3). */
    @Column(nullable = false)
    public boolean destacado;

    @Column(name = "motivo_rechazo", length = 300)
    public String motivoRechazo;

    @Column(name = "pausado_por", length = 10)
    public String pausadoPor;

    @Column(nullable = false)
    public int renovaciones;

    @Column(name = "token_hash", length = 64, unique = true)
    public String tokenHash;

    @Column(nullable = false, length = 3000)
    public String busqueda = "";

    @Column(name = "ip_origen", length = 60)
    public String ipOrigen;

    @Column(name = "fecha_creacion", nullable = false)
    public LocalDateTime fechaCreacion = Tianguis.ahora();

    @Column(nullable = false)
    public LocalDateTime actualizado = Tianguis.ahora();

    @Column(name = "fecha_publicacion")
    public LocalDateTime fechaPublicacion;

    @Column(name = "fecha_vencimiento")
    public LocalDateTime fechaVencimiento;

    @Column(name = "fecha_vendido")
    public LocalDateTime fechaVendido;

    @Column(nullable = false)
    public int vistas;

    public boolean esServicio() {
        return categoria != null && categoria.esServicio();
    }

    /** Para los DTO: nombre de la condición o null (servicios). */
    public String condicionTexto() {
        return condicion == null ? null : condicion.name();
    }

    // ---- Fotos y atributos (JSON)

    public List<String> listaFotos() {
        try {
            return CampoAtributo.JSON.readValue(fotos, new TypeReference<List<String>>() { });
        } catch (Exception e) {
            return List.of();
        }
    }

    public void ponerFotos(List<String> urls) {
        try {
            fotos = CampoAtributo.JSON.writeValueAsString(urls);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    public Map<String, String> mapaAtributos() {
        return CampoAtributo.leerValores(atributos);
    }

    public void ponerAtributos(Map<String, String> valores) {
        atributos = CampoAtributo.escribirValores(valores);
    }

    /** Texto sin acentos con título, descripción, categoría y atributos (para el buscador). */
    public void actualizarBusqueda() {
        String t = Tianguis.normalizar(titulo + " " + descripcion + " " + categoria.nombre + " "
                + String.join(" ", mapaAtributos().values()) + " " + ubicacion);
        busqueda = t.length() > 3000 ? t.substring(0, 3000) : t;
    }

    // ---- Estados

    /** Lo ve el público: publicado y sin vencer, o vendido hace menos de 7 días. */
    public boolean visible(LocalDateTime ahora) {
        return (estado == Estado.PUBLICADO && fechaVencimiento != null && fechaVencimiento.isAfter(ahora))
                || (estado == Estado.VENDIDO && fechaVendido != null
                && fechaVendido.isAfter(ahora.minusDays(Tianguis.DIAS_VENDIDO_VISIBLE)));
    }

    /** Publica por 30 días desde ahora. */
    public void publicar(LocalDateTime ahora) {
        estado = Estado.PUBLICADO;
        fechaPublicacion = ahora;
        fechaVencimiento = ahora.plusDays(Tianguis.DIAS_PUBLICADO);
        fechaVendido = null;
        motivoRechazo = null;
        pausadoPor = null;
    }

    public void marcarVendido(LocalDateTime ahora) {
        estado = Estado.VENDIDO;
        fechaVendido = ahora;
        pausadoPor = null;
    }

    public void pausar(String por) {
        estado = Estado.PAUSADO;
        pausadoPor = por;
    }

    public void rechazar(String motivo) {
        if (motivo == null || motivo.isBlank()) {
            throw Errores.de(Status.BAD_REQUEST, "Escribe el motivo del rechazo; el vendedor lo verá.");
        }
        estado = Estado.RECHAZADO;
        motivoRechazo = motivo.trim().length() > 300 ? motivo.trim().substring(0, 300) : motivo.trim();
        pausadoPor = null;
    }

    /** Cambio de estado desde el panel, con las transiciones válidas. */
    public void cambiarEstado(Estado nuevo, String motivo, LocalDateTime ahora) {
        if (nuevo == estado) {
            return;
        }
        if (!TRANSICIONES.getOrDefault(estado, Set.of()).contains(nuevo)) {
            throw Errores.de(Status.CONFLICT, "No se puede pasar de " + estado + " a " + nuevo + ".");
        }
        if (nuevo == Estado.VENDIDO && esServicio()) {
            throw Errores.de(Status.CONFLICT, "Un servicio no se marca como vendido; páusalo.");
        }
        if (nuevo == Estado.PUBLICADO && vendedor.bloqueado) {
            throw Errores.de(Status.CONFLICT, "El vendedor está bloqueado; desbloquéalo primero.");
        }
        switch (nuevo) {
            case PUBLICADO -> publicar(ahora);
            case VENDIDO -> marcarVendido(ahora);
            case PAUSADO -> pausar(POR_ADMIN);
            case RECHAZADO -> rechazar(motivo);
            case PENDIENTE -> {
                estado = Estado.PENDIENTE;
                pausadoPor = null;
            }
            default -> throw Errores.de(Status.CONFLICT, "Ese estado lo pone el sistema.");
        }
    }

    /** Ficha: /tianguis/12-sofa-de-3-plazas. */
    public String idSlug() {
        String s = Tianguis.slug(titulo);
        return s.isEmpty() ? String.valueOf(id) : id + "-" + s;
    }
}
