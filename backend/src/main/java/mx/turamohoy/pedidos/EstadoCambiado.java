package mx.turamohoy.pedidos;

/** Evento: un pedido cambió de estado (se avisa al cliente después de guardar). */
public record EstadoCambiado(Long pedidoId) {
}
