package mx.turamohoy.catalogo.model;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;

import java.io.Serializable;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Objects;

/** Visitas de una página en un día (hora de México). */
@Entity
@Table(name = "visita_dia")
@IdClass(VisitaDia.Llave.class)
public class VisitaDia extends PanacheEntityBase {

    /** Los días se cuentan con la hora de Miahuatlán. */
    public static final ZoneId ZONA = ZoneId.of("America/Mexico_City");

    @Id
    @Column(length = 120)
    public String ruta;

    @Id
    public LocalDate dia;

    @Column(nullable = false)
    public long total;

    public static LocalDate hoy() {
        return LocalDate.now(ZONA);
    }

    public static VisitaDia nueva(String ruta, LocalDate dia) {
        VisitaDia v = new VisitaDia();
        v.ruta = ruta;
        v.dia = dia;
        v.total = 1;
        return v;
    }

    /** Suma una visita de forma atómica. Devuelve cuántas filas cambió (0 si aún no existe). */
    public static int sumar(String ruta, LocalDate dia) {
        return update("total = total + 1 where ruta = ?1 and dia = ?2", ruta, dia);
    }

    public static class Llave implements Serializable {
        public String ruta;
        public LocalDate dia;

        @Override
        public boolean equals(Object o) {
            return o instanceof Llave l && Objects.equals(ruta, l.ruta) && Objects.equals(dia, l.dia);
        }

        @Override
        public int hashCode() {
            return Objects.hash(ruta, dia);
        }
    }
}
