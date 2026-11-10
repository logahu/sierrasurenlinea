package mx.turamohoy.catalogo.model;

import java.util.Set;

/** Cómo se piden en línea los productos de un negocio (pedidos con carrito). */
public final class ModoPedido {

    /** Venta: entrega a domicilio o recoger en el negocio. */
    public static final String COMPRA = "COMPRA";
    /** Renta: fecha del evento obligatoria; se lleva al lugar del evento. */
    public static final String RENTA = "RENTA";
    /** Cita: el cliente pide ver el producto en persona (autos). */
    public static final String CITA = "CITA";

    public static final Set<String> TODOS = Set.of(COMPRA, RENTA, CITA);

    private ModoPedido() {
    }
}
