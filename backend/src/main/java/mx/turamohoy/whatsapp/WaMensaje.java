package mx.turamohoy.whatsapp;

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

import java.time.Instant;

/** Un mensaje de una conversación de WhatsApp. */
@Entity
@Table(name = "wa_mensaje")
public class WaMensaje extends PanacheEntityBase {

    /** Lo escribió el cliente. */
    public static final String ENTRANTE = "ENTRANTE";
    /** Lo mandó el sistema (el bot) por la API. */
    public static final String SALIENTE = "SALIENTE";
    /** Lo escribió alguien del negocio en la app WhatsApp Business (coexistencia). */
    public static final String NEGOCIO = "NEGOCIO";

    public static final String ENVIADO = "ENVIADO";
    public static final String ENTREGADO = "ENTREGADO";
    public static final String LEIDO = "LEIDO";
    public static final String FALLIDO = "FALLIDO";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "conversacion_id")
    public WaConversacion conversacion;

    /** Id de Meta ("wamid.…"); único, para no procesar dos veces un reintento. */
    @Column(length = 200, unique = true)
    public String wamid;

    @Column(nullable = false, length = 10)
    public String direccion;

    /** text, interactive, button, image, audio… */
    @Column(nullable = false, length = 20)
    public String tipo;

    @Column(length = 4096)
    public String texto;

    /** De los salientes: ENVIADO, ENTREGADO, LEIDO o FALLIDO. */
    @Column(length = 10)
    public String estado;

    @Column(length = 300)
    public String error;

    @Column(nullable = false)
    public Instant creado;

    public static boolean existe(String wamid) {
        return wamid != null && count("wamid", wamid) > 0;
    }

    public static WaMensaje porWamid(String wamid) {
        return wamid == null ? null : find("wamid", wamid).firstResult();
    }

    static WaMensaje nuevo(WaConversacion c, String direccion, String wamid, String tipo, String texto, Instant ahora) {
        WaMensaje m = new WaMensaje();
        m.conversacion = c;
        m.direccion = direccion;
        m.wamid = wamid;
        m.tipo = tipo == null ? "desconocido" : tipo.substring(0, Math.min(20, tipo.length()));
        m.texto = texto == null ? null : texto.substring(0, Math.min(4096, texto.length()));
        m.creado = ahora;
        m.persist();
        return m;
    }
}
