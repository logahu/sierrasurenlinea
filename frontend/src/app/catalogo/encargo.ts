import { Platillo, Producto, Restaurante, TipoEncargo } from './catalogo.model';
import { Punto, enlaceVer } from '../mapa/ubicacion';
import { precioConUnidad } from './contacto';

/**
 * Lógica de Encarguitos (mandados y viajes en moto): opciones, validación y mensaje.
 * Las opciones vienen del negocio (se editan en el panel); TIPOS_ENCARGO es el respaldo.
 */

export type PagoCompra = 'repartidor-adelanta' | 'cliente-paga-antes';
export type Cuando = 'ahora' | 'programado';

/** Tope por omisión; el de cada negocio se edita en el panel (negocio.topeAdelanto). */
export const TOPE_ADELANTO = 500;
/** Unidad de las tarifas de viaje (las demás son de mandados o cargos extra). */
export const UNIDAD_VIAJE = 'por viaje';

/** Respaldo si el servidor todavía no manda las opciones. */
export const TIPOS_ENCARGO: readonly TipoEncargo[] = [
  {
    id: 'super', titulo: 'Súper o mercado', ayuda: 'Te compramos lo de tu lista',
    ejemplo: 'Ej. 1 kg de tortillas, 2 litros de leche, 6 huevos, un jabón para trastes…',
    etiquetaRecoger: 'Dónde comprar (opcional)', recogerObligatorio: false, manejaDinero: true,
    modo: 'MANDADO', icono: 'bolsa', soloProgramado: false,
  },
  {
    id: 'llevar', titulo: 'Llevar o recoger algo', ayuda: 'Paquetes, comida, documentos',
    ejemplo: 'Ej. una caja con ropa para mi mamá; pregunten por Doña Rosa.',
    etiquetaRecoger: 'Dónde lo recogemos', recogerObligatorio: true, manejaDinero: false,
    modo: 'MANDADO', icono: 'caja', soloProgramado: false,
  },
  {
    id: 'pagos', titulo: 'Pagos y trámites', ayuda: 'Recibos, depósitos, recoger papeles',
    ejemplo: 'Ej. pagar el recibo de luz de $350 y traerme el comprobante.',
    etiquetaRecoger: 'Dónde se paga (opcional)', recogerObligatorio: false, manejaDinero: true,
    modo: 'MANDADO', icono: 'recibo', soloProgramado: false,
  },
  {
    id: 'otro', titulo: 'Otro encargo', ayuda: 'Cuéntanos qué necesitas',
    ejemplo: 'Ej. recoger un pastel en la panadería y llevarlo a una fiesta.',
    etiquetaRecoger: 'Dónde empezamos (opcional)', recogerObligatorio: false, manejaDinero: false,
    modo: 'MANDADO', icono: 'estrella', soloProgramado: false,
  },
];

export interface DatosEncargo {
  /** Id de la opción elegida (como texto, por el formulario). */
  tipo: string;
  detalle: string;
  recoger: string;
  /** Enlace de Google Maps con la ubicación del cliente (botón "Usar mi ubicación"). */
  ubicacion: string;
  entregar: string;
  /** Punto de entrega marcado en el mapa (no es parte del formulario). */
  puntoEntrega?: Punto | null;
  /** Id de la tarifa (producto) de la zona. */
  zona: string;
  cuando: Cuando;
  /** AAAA-MM-DD; vacío = hoy. */
  fecha: string;
  hora: string;
  nombre: string;
  /** Teléfono del cliente (10 dígitos) para que el repartidor lo contacte. */
  telefono: string;
  pagoCompra: PagoCompra;
  /** Solo viajes: lleva mochila o bolsa. */
  equipaje: boolean;
}

export const ENCARGO_VACIO: DatosEncargo = {
  tipo: '',
  detalle: '',
  recoger: '',
  ubicacion: '',
  entregar: '',
  zona: '',
  cuando: 'ahora',
  fecha: '',
  hora: '',
  nombre: '',
  telefono: '',
  pagoCompra: 'repartidor-adelanta',
  equipaje: false,
};

export function opcionDe(tipos: readonly TipoEncargo[], id: string): TipoEncargo {
  return tipos.find((t) => String(t.id) === id) ?? tipos[0] ?? TIPOS_ENCARGO[0];
}

export const esViaje = (o: TipoEncargo): boolean => o.modo === 'VIAJE';
export const esComida = (o: TipoEncargo): boolean => o.modo === 'COMIDA';

/** Pedido de comida: el lugar y cuántos de cada platillo. */
export interface PedidoComida {
  restaurante: Restaurante;
  lineas: { platillo: Platillo; cantidad: number }[];
}

export function subtotalComida(p: PedidoComida | undefined): number {
  return (p?.lineas ?? []).reduce((s, l) => s + l.platillo.precio * l.cantidad, 0);
}

const pesos = (n: number) => precioConUnidad({ precio: n, unidadPrecio: null });

/** Zonas con precio para esa opción (viaje o mandado), de la más barata a la más cara. */
export function zonasPara(tarifas: readonly Producto[], opcion: TipoEncargo): Producto[] {
  return tarifas
    .filter((t) => (esViaje(opcion) ? t.unidadPrecio === UNIDAD_VIAJE : t.unidadPrecio !== 'extra' && t.unidadPrecio !== UNIDAD_VIAJE))
    .sort((a, b) => a.precio - b.precio);
}

/** Las zonas de mandados (compatibilidad). */
export function zonasDeEntrega(tarifas: readonly Producto[]): Producto[] {
  return zonasPara(tarifas, TIPOS_ENCARGO[0]);
}

/** Textos de los campos según sea mandado o viaje. */
export function etiquetas(o: TipoEncargo) {
  return esViaje(o)
    ? { detalle: 'Notas para el conductor (opcional)', entregar: '¿A dónde vas?', zona: 'Zona de destino', nombre: 'Nombre de quien viaja' }
    : esComida(o)
      ? { detalle: 'Indicaciones (opcional)', entregar: 'Entregar en', zona: 'Zona de entrega', nombre: 'Tu nombre' }
      : { detalle: 'Qué necesitas que hagamos', entregar: 'Entregar en', zona: 'Zona de entrega', nombre: 'Tu nombre' };
}

/** Campos que faltan, en lenguaje del cliente. Vacío = se puede enviar. */
export function camposFaltantes(
  d: DatosEncargo,
  opcion: TipoEncargo = opcionDe(TIPOS_ENCARGO, d.tipo),
  comida?: PedidoComida,
): string[] {
  const viaje = esViaje(opcion);
  const faltan: string[] = [];
  if (esComida(opcion)) {
    if (!comida?.lineas.length) faltan.push('qué platillos quieres');
  } else if (!viaje && !d.detalle.trim()) faltan.push('qué necesitas que hagamos');
  if (opcion.recogerObligatorio && !d.recoger.trim() && !d.ubicacion) {
    faltan.push(viaje ? 'dónde te recogemos' : 'dónde lo recogemos');
  }
  if (!d.entregar.trim()) faltan.push(viaje ? 'a dónde vas' : 'a dónde lo llevamos');
  if (!d.zona) faltan.push(viaje ? 'la zona de destino' : 'la zona de entrega');
  if ((d.cuando === 'programado' || opcion.soloProgramado) && !d.hora) faltan.push('a qué hora lo necesitas');
  if (!d.nombre.trim()) faltan.push(viaje ? 'el nombre de quien viaja' : 'tu nombre');
  if (!telefonoValido(d.telefono)) faltan.push('tu teléfono (10 dígitos)');
  return faltan;
}

/** 10 dígitos (acepta espacios, guiones y +52). */
export function telefonoValido(t: string): boolean {
  const d = t.replace(/\D/g, '');
  return d.length === 10 || (d.length === 12 && d.startsWith('52'));
}

export function textoPagoCompra(pago: PagoCompra, opcion: TipoEncargo, tope = TOPE_ADELANTO): string {
  const que = opcion.icono === 'recibo' ? 'el monto a pagar' : esComida(opcion) ? 'la comida' : 'los productos';
  return pago === 'repartidor-adelanta'
    ? `El repartidor adelanta ${que} (hasta $${tope}) y le pago todo al recibir`
    : `Pago ${que} antes, por transferencia`;
}

/** "hoy a las 18:30" o "el sábado 8 de noviembre a las 9:00". */
export function textoCuando(d: DatosEncargo, opcion: TipoEncargo, hoy = new Date()): string {
  if (d.cuando === 'ahora' && !opcion.soloProgramado) return 'lo antes posible';
  const hoyIso = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
  if (!d.fecha || d.fecha === hoyIso) return `hoy a las ${d.hora}`;
  const [a, m, dia] = d.fecha.split('-').map(Number);
  const fecha = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(a, m - 1, dia));
  return `el ${fecha} a las ${d.hora}`;
}

/** Enlace de Google Maps para unas coordenadas. */
export function enlaceMapa(lat: number, lng: number): string {
  return `https://maps.google.com/?q=${lat.toFixed(6)},${lng.toFixed(6)}`;
}

/** Mensaje de WhatsApp ordenado, con negritas de WhatsApp (*texto*). */
export function armarMensajeEncargo(
  d: DatosEncargo,
  zona: Producto | undefined,
  tope = TOPE_ADELANTO,
  opcion: TipoEncargo = opcionDe(TIPOS_ENCARGO, d.tipo),
  comida?: PedidoComida,
  folio?: string,
): string {
  const viaje = esViaje(opcion);
  let lineas: string[];
  if (esComida(opcion) && comida) {
    lineas = ['Hola Encarguitos, quiero pedir comida:', '', `*Lugar:* ${comida.restaurante.nombre}`, '*Pedido:*'];
    for (const l of comida.lineas) {
      lineas.push(`• ${l.cantidad} × ${l.platillo.nombre} — ${pesos(l.platillo.precio * l.cantidad)}`);
    }
    lineas.push(`*Subtotal de la comida:* ${pesos(subtotalComida(comida))}`);
    if (d.detalle.trim()) lineas.push(`*Indicaciones:* ${d.detalle.trim()}`);
  } else {
    lineas = viaje
      ? ['Hola Encarguitos, quiero un viaje en moto:', '']
      : ['Hola Encarguitos, quiero hacer un encargo:', '', `*Tipo:* ${opcion.titulo}`, `*Qué necesito:* ${d.detalle.trim()}`];
  }
  const etiquetaRecoger = opcion.etiquetaRecoger.replace(/\s*\(opcional\)\s*$/, '');
  if (d.recoger.trim()) lineas.push(`*${etiquetaRecoger}:* ${d.recoger.trim()}`);
  if (d.ubicacion) lineas.push(`*Mi ubicación:* ${d.ubicacion}`);
  lineas.push(`*${viaje ? 'Voy a' : 'Entregar en'}:* ${d.entregar.trim()}`);
  if (d.puntoEntrega) lineas.push(`*Ubicación de entrega:* ${enlaceVer(d.puntoEntrega)}`);
  if (zona) lineas.push(`*Zona:* ${zona.nombre} (${precioConUnidad(zona)})`);
  if (esComida(opcion) && comida && zona && !zona.unidadPrecio?.startsWith('extra')) {
    lineas.push(`*Total aproximado:* ${pesos(subtotalComida(comida) + zona.precio)} (comida + envío)`);
  }
  lineas.push(`*${viaje ? 'Cuándo' : 'Para'}:* ${textoCuando(d, opcion)}`);
  if (viaje) {
    if (d.equipaje) lineas.push('*Equipaje:* llevo mochila o bolsa');
    if (d.detalle.trim()) lineas.push(`*Notas:* ${d.detalle.trim()}`);
  }
  if (opcion.manejaDinero && !viaje) lineas.push(`*Pago:* ${textoPagoCompra(d.pagoCompra, opcion, tope)}`);
  lineas.push(`*${viaje ? 'Pasajero' : 'Nombre'}:* ${d.nombre.trim()}`);
  if (d.telefono.trim()) lineas.push(`*Teléfono:* ${d.telefono.trim()}`);
  if (folio) lineas.splice(2, 0, `*Folio:* ${folio}`);
  if (viaje) lineas.push('', 'Por favor confírmenme el nombre del conductor, la placa y una foto de la moto.');
  lineas.push('', 'Enviado desde Sierra Sur en Línea.');
  return lineas.join('\n');
}

/** Datos que se registran en el sistema para el panel de pedidos. */
export function datosDelPedido(
  d: DatosEncargo,
  opcion: TipoEncargo,
  negocio: string,
  mensaje: string,
  zona: Producto | undefined,
  comida?: PedidoComida,
) {
  const total = esComida(opcion) && comida ? subtotalComida(comida) + (zona?.precio ?? 0) : null;
  return {
    negocio,
    tipo: esComida(opcion) && comida ? `${opcion.titulo} · ${comida.restaurante.nombre}` : opcion.titulo,
    modo: opcion.modo,
    nombre: d.nombre.trim(),
    telefono: d.telefono.trim(),
    entregar: d.entregar.trim(),
    zona: zona?.nombre ?? null,
    total,
    lat: d.puntoEntrega?.lat ?? null,
    lng: d.puntoEntrega?.lng ?? null,
    mensaje,
  };
}
