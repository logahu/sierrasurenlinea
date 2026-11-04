import { Negocio, Producto } from './catalogo.model';

const formatoPesos = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

/** Precio legible con su unidad: "$650 por día" o "$450". */
export function precioConUnidad(p: Pick<Producto, 'precio' | 'unidadPrecio'>): string {
  const precio = formatoPesos.format(p.precio);
  return p.unidadPrecio ? `${precio} ${p.unidadPrecio}` : precio;
}

/** Enlace wa.me con el mensaje prellenado. El número debe ir con lada internacional. */
export function enlaceWhatsapp(numero: string, mensaje: string): string {
  const soloDigitos = numero.replace(/\D/g, '');
  return `https://wa.me/${soloDigitos}?text=${encodeURIComponent(mensaje)}`;
}

/** Mensaje inicial para preguntar por un producto, distinto si es renta o venta. */
export function mensajeProducto(negocio: Pick<Negocio, 'tipo'>, p: Producto): string {
  const precio = precioConUnidad(p);
  return negocio.tipo === 'RENTA'
    ? `Hola, quiero rentar "${p.nombre}" (${precio}). ¿Qué fechas tienen disponibles?`
    : `Hola, me interesa "${p.nombre}" (${precio}) que vi en Sierra Sur en Línea. ¿Está disponible?`;
}

/** Mensaje para el botón general del negocio. */
export function mensajeNegocio(negocio: Pick<Negocio, 'nombre'>): string {
  return `Hola, vi ${negocio.nombre} en Sierra Sur en Línea y quiero más información.`;
}

/** Enlace tel: a partir de un teléfono escrito con espacios o guiones. */
export function enlaceTelefono(telefono: string): string {
  return `tel:${telefono.replace(/[^\d+]/g, '')}`;
}
