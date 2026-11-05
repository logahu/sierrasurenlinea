package mx.turamohoy.catalogo.model;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

/** Total de visitas de una página del sitio, identificada por su ruta. */
@Entity
@Table(name = "visita")
public class Visita extends PanacheEntityBase {

    @Id
    @Column(length = 120)
    public String ruta;

    @Column(nullable = false)
    public long total;

    @Column(nullable = false)
    public LocalDateTime actualizada;

    public static Visita nueva(String ruta) {
        Visita v = new Visita();
        v.ruta = ruta;
        v.total = 1;
        v.actualizada = LocalDateTime.now();
        return v;
    }

    /** Suma una visita de forma atómica en la base. Devuelve cuántas filas cambió (0 si no existe). */
    public static int sumar(String ruta) {
        return update("total = total + 1, actualizada = ?2 where ruta = ?1", ruta, LocalDateTime.now());
    }
}
