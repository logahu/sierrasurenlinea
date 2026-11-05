import { Producto } from './catalogo.model';
import { precioConUnidad } from './contacto';

/** Lógica de Encarguitos (mandados en moto): tipos de encargo, validación y mensaje. */

export type TipoEncargo = 'super' | 'llevar' | 'pagos' | 'otro';
export type PagoCompra = 'repartidor-adelanta' | 'cliente-paga-antes';
export type Cuando = 'ahora' | 'programado';

/** Hasta cuánto adelanta el repartidor con su dinero (de ejemplo). */
export const TOPE_ADELANTO = 500;

export interface OpcionEncargo {
  id: TipoEncargo;
  titulo: string;
  ayuda: string;
  ejemplo: string;
  etiquetaRecoger: string;
  /** Si es obligatorio decir dónde se recoge (para llevar algo de un lugar a otro sí). */
  recogerObligatorio: boolean;
  /** Si el encargo implica pagar algo además del envío (compras, recibos). */
  manejaDinero: boolean;
}

export const TIPOS_ENCARGO: readonly OpcionEncargo[] = [
  {
    id: 'super',
    titulo: 'Súper o mercado',
    ayuda: 'Te compramos lo de tu lista',
    ejemplo: 'Ej. 1 kg de tortillas, 2 litros de leche, 6 huevos, un jabón para trastes…',
    etiquetaRecoger: 'Dónde comprar (opcional)',
    recogerObligatorio: false,
    manejaDinero: true,
  },
  {
    id: 'llevar',
    titulo: 'Llevar o recoger algo',
    ayuda: 'Paquetes, comida, documentos',
    ejemplo: 'Ej. una caja con ropa para mi mamá; pregunten por Doña Rosa.',
    etiquetaRecoger: 'Dónde lo recogemos',
    recogerObligatorio: true,
    manejaDinero: false,
  },
  {
    id: 'pagos',
    titulo: 'Pagos y trámites',
    ayuda: 'Recibos, depósitos, recoger papeles',
    ejemplo: 'Ej. pagar el recibo de luz de $350 y traerme el comprobante.',
    etiquetaRecoger: 'Dónde se paga (opcional)',
    recogerObligatorio: false,
    manejaDinero: true,
  },
  {
    id: 'otro',
    titulo: 'Otro encargo',
    ayuda: 'Cuéntanos qué necesitas',
    ejemplo: 'Ej. recoger un pastel en la panadería y llevarlo a una fiesta.',
    etiquetaRecoger: 'Dónde empezamos (opcional)',
    recogerObligatorio: false,
    manejaDinero: false,
  },
];

export interface DatosEncargo {
  tipo: TipoEncargo;
  detalle: string;
  recoger: string;
  entregar: string;
  /** Id de la tarifa (producto) de la zona de entrega. */
  zona: string;
  cuando: Cuando;
  hora: string;
  nombre: string;
  pagoCompra: PagoCompra;
}

export const ENCARGO_VACIO: DatosEncargo = {
  tipo: 'super',
  detalle: '',
  recoger: '',
  entregar: '',
  zona: '',
  cuando: 'ahora',
  hora: '',
  nombre: '',
  pagoCompra: 'repartidor-adelanta',
};

export function opcionDe(tipo: TipoEncargo): OpcionEncargo {
  return TIPOS_ENCARGO.find((t) => t.id === tipo) ?? TIPOS_ENCARGO[0];
}

/** Las tarifas que son zonas de entrega (no los cargos extra), de la más barata a la más cara. */
export function zonasDeEntrega(tarifas: readonly Producto[]): Producto[] {
  return tarifas.filter((t) => t.unidadPrecio !== 'extra').sort((a, b) => a.precio - b.precio);
}

/** Campos que faltan, en lenguaje del cliente. Vacío = se puede enviar. */
export function camposFaltantes(d: DatosEncargo): string[] {
  const faltan: string[] = [];
  const opcion = opcionDe(d.tipo);
  if (!d.detalle.trim()) faltan.push('qué necesitas que hagamos');
  if (opcion.recogerObligatorio && !d.recoger.trim()) faltan.push('dónde lo recogemos');
  if (!d.entregar.trim()) faltan.push('a dónde lo llevamos');
  if (!d.zona) faltan.push('la zona de entrega');
  if (d.cuando === 'programado' && !d.hora) faltan.push('a qué hora lo necesitas');
  if (!d.nombre.trim()) faltan.push('tu nombre');
  return faltan;
}

export function textoPagoCompra(pago: PagoCompra, tipo: TipoEncargo): string {
  const que = tipo === 'pagos' ? 'el monto a pagar' : 'los productos';
  return pago === 'repartidor-adelanta'
    ? `El repartidor adelanta ${que} (hasta $${TOPE_ADELANTO}) y le pago todo al recibir`
    : `Pago ${que} antes, por transferencia`;
}

/** Mensaje de WhatsApp ordenado, con negritas de WhatsApp (*texto*). */
export function armarMensajeEncargo(d: DatosEncargo, zona: Producto | undefined): string {
  const opcion = opcionDe(d.tipo);
  const lineas = [
    'Hola Encarguitos, quiero hacer un encargo:',
    '',
    `*Tipo:* ${opcion.titulo}`,
    `*Qué necesito:* ${d.detalle.trim()}`,
  ];
  if (d.recoger.trim()) lineas.push(`*${opcion.etiquetaRecoger.replace(' (opcional)', '')}:* ${d.recoger.trim()}`);
  lineas.push(`*Entregar en:* ${d.entregar.trim()}`);
  if (zona) lineas.push(`*Zona:* ${zona.nombre} (${precioConUnidad(zona)})`);
  lineas.push(`*Para:* ${d.cuando === 'ahora' ? 'lo antes posible' : `hoy a las ${d.hora}`}`);
  if (opcion.manejaDinero) lineas.push(`*Pago:* ${textoPagoCompra(d.pagoCompra, d.tipo)}`);
  lineas.push(`*Nombre:* ${d.nombre.trim()}`, '', 'Enviado desde Sierra Sur en Línea.');
  return lineas.join('\n');
}
