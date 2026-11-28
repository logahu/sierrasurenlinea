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
import mx.turamohoy.catalogo.model.Negocio;
import mx.turamohoy.clientes.Cliente;

import java.time.Duration;
import java.time.Instant;

/** Conversación de WhatsApp entre un negocio y un cliente (una por par). */
@Entity
@Table(name = "wa_conversacion")
public class WaConversacion extends PanacheEntityBase {

    /** Meta permite contestar sin plantilla durante 24 h después del último mensaje del cliente. */
    public static final Duration VENTANA = Duration.ofHours(24);

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "negocio_id")
    public Negocio negocio;

    /** Como lo manda Meta, p. ej. "5219511234567". */
    @Column(name = "wa_id", nullable = false, length = 20)
    public String waId;

    /** Los 10 dígitos (para ligar con el cliente del sitio); null si no es un número de México. */
    @Column(length = 10)
    public String telefono;

    /** Identificador de usuario de Meta (llega aunque algún día no venga el teléfono). */
    @Column(name = "user_id", length = 60)
    public String userId;

    /** Nombre del perfil de WhatsApp (lo escribe el cliente; no es su nombre verificado). */
    @Column(name = "nombre_perfil", length = 120)
    public String nombrePerfil;

    /** Mientras esté en el futuro, el bot no contesta: alguien del negocio tomó la conversación. */
    @Column(name = "humano_hasta")
    public Instant humanoHasta;

    @Column(name = "ultimo_entrante")
    public Instant ultimoEntrante;

    @Column(nullable = false)
    public Instant creado;

    @Column(nullable = false)
    public Instant actualizado;

    /** ¿La está atendiendo una persona del negocio? */
    public boolean atiendeHumano(Instant ahora) {
        return humanoHasta != null && humanoHasta.isAfter(ahora);
    }

    /** ¿Se le puede escribir texto libre (sin plantilla)? */
    public boolean ventanaAbierta(Instant ahora) {
        return ultimoEntrante != null && ultimoEntrante.plus(VENTANA).isAfter(ahora);
    }

    /**
     * A qué número se le contesta. Meta manda los de México como 521 + 10 dígitos, pero los
     * mensajes salientes deben ir a 52 + 10 dígitos.
     */
    public String destino() {
        return destinoDe(waId);
    }

    static String destinoDe(String waId) {
        return waId != null && waId.length() == 13 && waId.startsWith("521") ? "52" + waId.substring(3) : waId;
    }

    public static WaConversacion de(Negocio n, String waId) {
        return find("negocio = ?1 and waId = ?2", n, waId).firstResult();
    }

    /** La conversación del negocio con ese cliente; la crea si es la primera vez. */
    public static WaConversacion obtener(Negocio n, String waId, Instant ahora) {
        WaConversacion c = de(n, waId);
        if (c == null) {
            c = new WaConversacion();
            c.negocio = n;
            c.waId = waId;
            c.telefono = Cliente.normalizarTelefono(waId);
            c.creado = ahora;
            c.actualizado = ahora;
            c.persist();
        }
        return c;
    }
}
