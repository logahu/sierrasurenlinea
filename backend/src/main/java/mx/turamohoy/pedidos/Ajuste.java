package mx.turamohoy.pedidos;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** Ajuste interno clave/valor (p. ej. las llaves VAPID). */
@Entity
@Table(name = "ajuste")
public class Ajuste extends PanacheEntityBase {

    @Id
    @Column(length = 60)
    public String clave;

    @Column(nullable = false, length = 2000)
    public String valor;
}
