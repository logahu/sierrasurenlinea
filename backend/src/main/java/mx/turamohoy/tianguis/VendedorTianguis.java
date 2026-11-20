package mx.turamohoy.tianguis;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.LocalDateTime;
import java.util.Optional;

/** Quien vende en el tianguis. Sin cuenta: se identifica por su WhatsApp. */
@Entity
@Table(name = "tianguis_vendedor")
public class VendedorTianguis extends PanacheEntityBase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @Column(nullable = false, length = 80)
    public String nombre;

    /** 52 + 10 dígitos. */
    @Column(nullable = false, length = 12, unique = true)
    public String whatsapp;

    /** El administrador confirmó su WhatsApp a mano. */
    @Column(nullable = false)
    public boolean verificado;

    /** No puede publicar y sus anuncios quedan pausados. */
    @Column(nullable = false)
    public boolean bloqueado;

    @Column(name = "fecha_registro", nullable = false)
    public LocalDateTime fechaRegistro = Tianguis.ahora();

    /** Solo para el panel; nunca sale en la API pública. */
    @Column(name = "notas_internas", length = 1000)
    public String notasInternas;

    public static Optional<VendedorTianguis> porWhatsapp(String whatsapp) {
        return find("whatsapp", whatsapp).firstResultOptional();
    }

    /** Lo busca por WhatsApp o lo crea; el nombre se actualiza si llega uno nuevo. */
    public static VendedorTianguis obtener(String nombre, String whatsapp) {
        VendedorTianguis v = porWhatsapp(whatsapp).orElseGet(() -> {
            VendedorTianguis x = new VendedorTianguis();
            x.whatsapp = whatsapp;
            return x;
        });
        if (nombre != null && !nombre.isBlank()) {
            v.nombre = nombre.trim();
        }
        if (v.id == null) {
            v.persist();
        }
        return v;
    }
}
