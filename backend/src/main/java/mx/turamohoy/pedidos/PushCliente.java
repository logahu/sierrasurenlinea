package mx.turamohoy.pedidos;

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
import mx.turamohoy.clientes.Cliente;

import java.time.Instant;

/** Un navegador (celular) de un cliente que quiere avisos de sus pedidos. */
@Entity
@Table(name = "push_cliente")
public class PushCliente extends PanacheEntityBase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "cliente_id")
    public Cliente cliente;

    @Column(nullable = false, length = 1000, unique = true)
    public String endpoint;

    @Column(nullable = false, length = 200)
    public String p256dh;

    @Column(nullable = false, length = 100)
    public String auth;

    @Column(nullable = false)
    public Instant creado = Instant.now();
}
