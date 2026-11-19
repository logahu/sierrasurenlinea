package mx.turamohoy.tianguis;

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

import java.time.LocalDateTime;
import java.util.Map;

/** Reporte de un visitante sobre un anuncio. Con 3 sin atender, el anuncio se pausa. */
@Entity
@Table(name = "tianguis_reporte")
public class ReporteTianguis extends PanacheEntityBase {

    public static final Map<String, String> MOTIVOS = Map.of(
            "FRAUDE", "Fraude o estafa",
            "PROHIBIDO", "Artículo prohibido",
            "VENDIDO", "Ya se vendió",
            "FALSO", "Información falsa",
            "OTRO", "Otro");
    /** Reportes sin atender que pausan el anuncio. */
    public static final int PARA_PAUSAR = 3;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "anuncio_id")
    public AnuncioTianguis anuncio;

    @Column(nullable = false, length = 20)
    public String motivo;

    @Column(length = 500)
    public String comentario;

    @Column(nullable = false)
    public LocalDateTime fecha = Tianguis.ahora();

    @Column(nullable = false)
    public boolean atendido;

    @Column(length = 60)
    public String ip;

    public static long sinAtender(AnuncioTianguis a) {
        return count("anuncio = ?1 and atendido = false", a);
    }
}
