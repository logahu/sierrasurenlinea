package mx.turamohoy.catalogo.model;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.util.Optional;

/**
 * Un negocio dentro de Sierra Sur en Línea (TuRamoHoy, cosméticos, inflables...).
 * Cada uno tiene su propia identidad visual y sus datos de contacto.
 */
@Entity
@Table(name = "negocio")
public class Negocio extends PanacheEntityBase {

    @Id
    public Long id;

    /** Identificador para la URL, p. ej. "turamohoy" → /turamohoy. */
    @Column(nullable = false, unique = true, length = 60)
    public String slug;

    @Column(nullable = false, length = 80)
    public String nombre;

    @Column(length = 140)
    public String eslogan;

    @Column(length = 600)
    public String descripcion;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    public TipoNegocio tipo;

    /** Color de acento en hexadecimal, p. ej. "#d6336c". */
    @Column(name = "color_primario", nullable = false, length = 7)
    public String colorPrimario;

    /** Imagen que representa al negocio en la portada. */
    @Column(name = "portada_url", nullable = false, length = 500)
    public String portadaUrl;

    /** Número de WhatsApp con lada internacional y sin espacios, p. ej. "5219511234567". */
    @Column(nullable = false, length = 20)
    public String whatsapp;

    @Column(length = 30)
    public String telefono;

    @Column(length = 200)
    public String direccion;

    @Column(length = 120)
    public String horario;

    /** true = tiene local para visitas; false = «Atención solo en línea». */
    @Column(name = "atencion_en_local", nullable = false)
    public boolean atencionEnLocal;

    @Column(length = 100)
    public String colonia;

    /** «Frente al parque…». */
    @Column(length = 200)
    public String referencias;

    /** Citas con horarios libres (agenda). */
    @Column(name = "agenda_activa", nullable = false)
    public boolean agendaActiva;

    /** "Phone number ID" de Meta con el que contesta la recepcionista de WhatsApp; null = sin conectar. */
    @Column(name = "wa_phone_number_id", length = 30, unique = true)
    public String waPhoneNumberId;

    /** Si la recepcionista IA contesta los mensajes de WhatsApp de este negocio. */
    @Column(name = "bot_activo", nullable = false)
    public boolean botActivo;

    /** {"1":["10:00","19:00"], ... "7":null}; 1 = lunes. Ver {@link mx.turamohoy.agenda.HorarioCitas}. */
    @Column(name = "horario_citas", length = 500)
    public String horarioCitas;

    @Column(name = "minutos_cita", nullable = false)
    public int minutosCita = 60;

    /** Pin del mapa (opcional). */
    @Column(precision = 9, scale = 6)
    public java.math.BigDecimal lat;

    @Column(precision = 9, scale = 6)
    public java.math.BigDecimal lng;

    /** Perfil de Negocio de Google: «Ver en Google Maps» (opcional). */
    @Column(name = "google_maps_url", length = 300)
    public String googleMapsUrl;

    /** Enlace para calificar en Google: «Déjanos tu reseña» (opcional). */
    @Column(name = "google_resenas_url", length = 300)
    public String googleResenasUrl;

    /** Si es true, el sitio muestra el aviso de venta solo a mayores de 18 años. */
    @Column(name = "solo_mayores_edad", nullable = false)
    public boolean soloMayoresEdad;

    @Column(nullable = false)
    public int orden;

    /** Fecha de alta: etiqueta «Nuevo» (30 días) y orden «Nuevos» en la portada. */
    @Column(name = "creado_en", nullable = false)
    public java.time.LocalDateTime creadoEn = java.time.LocalDateTime.now();

    /** Su giro en la portada (Flores y regalos, Belleza…). Son pocos: se carga siempre. */
    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "giro_id", nullable = false)
    public Giro giro;

    /** Lo ven todos los clientes. */
    public static final String PUBLICO = "PUBLICO";
    /** Solo lo ven los clientes probadores (para revisarlo antes de abrirlo). */
    public static final String PRUEBAS = "PRUEBAS";
    /** No aparece en el sitio para nadie. */
    public static final String OCULTO = "OCULTO";
    public static final java.util.Set<String> ESTADOS = java.util.Set.of(PUBLICO, PRUEBAS, OCULTO);

    /** PUBLICO, PRUEBAS u OCULTO (se cambia desde el panel). */
    @Column(nullable = false, length = 10)
    public String estado = PUBLICO;

    /** Si lo ve el público en general. */
    public boolean publico() {
        return PUBLICO.equals(estado);
    }

    /** Si lo puede ver esta persona: el público solo los públicos; un probador también los de pruebas. */
    public boolean visiblePara(boolean probador) {
        return PUBLICO.equals(estado) || (probador && PRUEBAS.equals(estado));
    }

    /** Estados que puede ver alguien en el sitio. */
    public static java.util.List<String> estadosVisibles(boolean probador) {
        return probador ? java.util.List.of(PUBLICO, PRUEBAS) : java.util.List.of(PUBLICO);
    }

    /** Si es false, no aparece dentro de la app de Google Play (en la web sí). */
    @Column(name = "visible_app", nullable = false)
    public boolean visibleApp = true;

    /** Solo en servicios (Encarguitos): cuánto adelanta el repartidor de su bolsa, en MXN. */
    @Column(name = "tope_adelanto")
    public Integer topeAdelanto;

    /**
     * Cómo se piden sus productos en línea: COMPRA, RENTA o CITA (ver {@link ModoPedido}).
     * Vacío en servicios (Encarguitos usa su propio formulario).
     */
    @Column(name = "modo_pedido", length = 10)
    public String modoPedido;

    /** El modo de pedido, o el que le toca por su tipo si no se definió. */
    public String modoPedido() {
        if (modoPedido != null) {
            return modoPedido;
        }
        return switch (tipo) {
            case VENTA -> ModoPedido.COMPRA;
            case RENTA -> ModoPedido.RENTA;
            case SERVICIO -> null;
        };
    }

    public static Optional<Negocio> porSlug(String slug) {
        return find("slug", slug).firstResultOptional();
    }

    /** Solo si está visible en el sitio público. */
    public static Optional<Negocio> visiblePorSlug(String slug) {
        return visiblePorSlug(slug, false);
    }

    /** Visible para esta persona (un probador también ve los negocios en pruebas). */
    public static Optional<Negocio> visiblePorSlug(String slug, boolean probador) {
        return find("slug = ?1 and estado in ?2", slug, estadosVisibles(probador)).firstResultOptional();
    }
}
