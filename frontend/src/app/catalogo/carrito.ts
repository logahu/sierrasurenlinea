import { Injectable, computed, signal } from '@angular/core';
import { ModoPedido, Negocio, Producto } from './catalogo.model';
import { precioConUnidad } from './contacto';
import { Punto, enlaceVer } from '../mapa/ubicacion';

/** Un renglón del carrito (se guarda en este navegador). */
export interface LineaCarrito {
  productoId: number;
  nombre: string;
  precio: number;
  unidadPrecio: string | null;
  imagenUrl: string;
  cantidad: number;
}

export type Entrega = 'DOMICILIO' | 'RECOGER';

/** Datos de entrega que llena el cliente al confirmar. */
export interface DatosPedido {
  entrega: Entrega;
  entregar: string;
  /** Texto final de "para cuándo", ya armado (ver textoCuando). */
  cuando: string;
  notas: string;
  /** Punto de entrega marcado en el mapa (opcional). */
  punto?: Punto | null;
}

export const MAXIMO_POR_PRODUCTO = 99;

/** Textos que cambian según cómo se pide en cada negocio. */
export const TEXTOS_PEDIDO: Record<
  ModoPedido,
  { agregar: string; titulo: string; ver: string; enviar: string; pieza: [string, string]; nota: string }
> = {
  COMPRA: {
    agregar: 'Agregar al pedido',
    titulo: 'Tu pedido',
    ver: 'Ver mi pedido',
    enviar: 'Realizar pedido',
    pieza: ['producto', 'productos'],
    nota: 'El negocio te confirma por WhatsApp la disponibilidad, el costo de envío y la forma de pago.',
  },
  RENTA: {
    agregar: 'Agregar a la reservación',
    titulo: 'Tu reservación',
    ver: 'Ver mi reservación',
    enviar: 'Realizar pedido',
    pieza: ['artículo', 'artículos'],
    nota: 'El negocio te confirma por WhatsApp la disponibilidad para tu fecha, el anticipo y la hora de instalación.',
  },
  CITA: {
    agregar: 'Agendar visita',
    titulo: 'Tu visita',
    ver: 'Ver mi visita',
    enviar: 'Realizar pedido',
    pieza: ['vehículo', 'vehículos'],
    nota: 'Te confirmamos por WhatsApp el día y la hora para que lo veas en persona y hagas prueba de manejo.',
  },
};

export function modoDe(n: Pick<Negocio, 'tipo' | 'modoPedido'> | undefined | null): ModoPedido | null {
  if (!n || n.tipo === 'SERVICIO') return null;
  return n.modoPedido ?? (n.tipo === 'RENTA' ? 'RENTA' : 'COMPRA');
}

export function piezasDe(lineas: LineaCarrito[]): number {
  return lineas.reduce((s, l) => s + l.cantidad, 0);
}

export function totalDe(lineas: LineaCarrito[]): number {
  return Math.round(lineas.reduce((s, l) => s + l.precio * l.cantidad, 0) * 100) / 100;
}

/** "3 productos", "1 artículo". */
export function textoPiezas(modo: ModoPedido, n: number): string {
  const [uno, varios] = TEXTOS_PEDIDO[modo].pieza;
  return `${n} ${n === 1 ? uno : varios}`;
}

/** "sábado 20 de diciembre" a partir de "2026-12-20". */
export function fechaLarga(fecha: string): string {
  const d = new Date(`${fecha}T12:00:00`);
  if (Number.isNaN(d.getTime())) return fecha;
  return d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
}

/** Texto de "para cuándo" que se guarda y va en el mensaje. */
export function textoCuando(modo: ModoPedido, programado: boolean, fecha: string, hora: string): string {
  if (modo === 'COMPRA' && !programado) return 'Lo antes posible';
  if (!fecha) return '';
  const dia = fechaLarga(fecha);
  return hora.trim() ? `${dia}, ${hora.trim()}` : dia;
}

/** Lo que falta para poder enviar (vacío = listo). */
export function faltantesPedido(
  modo: ModoPedido,
  lineas: LineaCarrito[],
  d: DatosPedido,
  soloMayores: boolean,
  mayorDeEdad: boolean,
): string[] {
  const faltan: string[] = [];
  if (!lineas.length) faltan.push(`al menos un ${TEXTOS_PEDIDO[modo].pieza[0]}`);
  const aDomicilio = modo === 'RENTA' || (modo === 'COMPRA' && d.entrega === 'DOMICILIO');
  if (aDomicilio && !d.entregar.trim()) faltan.push(modo === 'RENTA' ? 'la dirección del evento' : 'la dirección de entrega');
  if (modo !== 'COMPRA' && !d.cuando) faltan.push(modo === 'RENTA' ? 'la fecha del evento' : 'el día de tu visita');
  if (modo === 'COMPRA' && !d.cuando) faltan.push('el día de entrega');
  if (soloMayores && !mayorDeEdad) faltan.push('confirmar que eres mayor de 18 años');
  return faltan;
}

const pesos = (n: number) => precioConUnidad({ precio: n, unidadPrecio: null });

/** Mensaje de WhatsApp: el mismo texto queda guardado con el pedido en el panel. */
export function armarMensajeCarrito(
  negocio: Pick<Negocio, 'nombre'>,
  modo: ModoPedido,
  lineas: LineaCarrito[],
  d: DatosPedido,
  cliente: { nombre: string; telefono: string },
  folio?: string,
): string {
  const saludo = {
    COMPRA: `Hola ${negocio.nombre}, quiero hacer un pedido:`,
    RENTA: `Hola ${negocio.nombre}, quiero reservar:`,
    CITA: `Hola ${negocio.nombre}, quiero agendar una visita para ver:`,
  }[modo];
  const r: string[] = [saludo, ''];
  if (folio) r.push(`*Folio:* ${folio}`);
  for (const l of lineas) {
    r.push(
      modo === 'CITA'
        ? `• ${l.nombre} — ${precioConUnidad(l)}`
        : `• ${l.cantidad} × ${l.nombre} — ${pesos(l.precio * l.cantidad)}${l.unidadPrecio ? ` (${precioConUnidad(l)})` : ''}`,
    );
  }
  if (modo !== 'CITA') r.push(`*Total aprox.:* ${pesos(totalDe(lineas))}`);
  r.push('');
  if (modo === 'COMPRA') {
    r.push(d.entrega === 'RECOGER' ? '*Entrega:* Paso a recogerlo' : `*Entregar en:* ${d.entregar.trim()}`);
    if (d.entrega === 'DOMICILIO' && d.punto) r.push(`*Ubicación:* ${enlaceVer(d.punto)}`);
    r.push(`*Para cuándo:* ${d.cuando}`);
  } else if (modo === 'RENTA') {
    r.push(`*Fecha del evento:* ${d.cuando}`, `*Lugar del evento:* ${d.entregar.trim()}`);
    if (d.punto) r.push(`*Ubicación:* ${enlaceVer(d.punto)}`);
  } else {
    r.push(`*Día de la visita:* ${d.cuando}`);
  }
  if (d.notas.trim()) r.push(`*Notas:* ${d.notas.trim()}`);
  r.push(`*Nombre:* ${cliente.nombre}`, `*Teléfono:* ${cliente.telefono}`);
  return r.join('\n');
}

const CLAVE = 'ssl:carrito';

/**
 * Carritos del cliente, uno por negocio, guardados en este navegador para que no se
 * pierdan al cambiar de página o cerrar la pestaña.
 */
@Injectable({ providedIn: 'root' })
export class CarritoService {
  private readonly carritos = signal<Record<string, LineaCarrito[]>>(leer());

  lineas(slug: string): LineaCarrito[] {
    return this.carritos()[slug] ?? [];
  }

  /** Señal con los renglones de un negocio. */
  de(slug: () => string | undefined) {
    return computed(() => {
      const s = slug();
      return s ? (this.carritos()[s] ?? []) : [];
    });
  }

  agregar(slug: string, p: Producto, cantidad = 1, modo: ModoPedido = 'COMPRA'): void {
    this.actualizar(slug, (lineas) => {
      const actual = lineas.find((l) => l.productoId === p.id);
      if (actual) {
        const nueva = modo === 'CITA' ? 1 : Math.min(MAXIMO_POR_PRODUCTO, actual.cantidad + cantidad);
        return lineas.map((l) => (l === actual ? { ...l, cantidad: nueva, precio: p.precio } : l));
      }
      return [
        ...lineas,
        {
          productoId: p.id,
          nombre: p.nombre,
          precio: p.precio,
          unidadPrecio: p.unidadPrecio,
          imagenUrl: p.imagenUrl,
          cantidad: modo === 'CITA' ? 1 : Math.max(1, Math.min(MAXIMO_POR_PRODUCTO, cantidad)),
        },
      ];
    });
  }

  cambiarCantidad(slug: string, productoId: number, cantidad: number): void {
    if (cantidad <= 0) return this.quitar(slug, productoId);
    this.actualizar(slug, (lineas) =>
      lineas.map((l) => (l.productoId === productoId ? { ...l, cantidad: Math.min(MAXIMO_POR_PRODUCTO, cantidad) } : l)),
    );
  }

  quitar(slug: string, productoId: number): void {
    this.actualizar(slug, (lineas) => lineas.filter((l) => l.productoId !== productoId));
  }

  vaciar(slug: string): void {
    this.actualizar(slug, () => []);
  }

  private actualizar(slug: string, cambio: (l: LineaCarrito[]) => LineaCarrito[]): void {
    this.carritos.update((c) => {
      const nuevas = cambio(c[slug] ?? []);
      const resto = { ...c };
      if (nuevas.length) resto[slug] = nuevas;
      else delete resto[slug];
      return resto;
    });
    try {
      localStorage.setItem(CLAVE, JSON.stringify(this.carritos()));
    } catch {
      /* sin almacenamiento: el carrito dura mientras la pestaña esté abierta */
    }
  }
}

function leer(): Record<string, LineaCarrito[]> {
  try {
    const crudo = localStorage.getItem(CLAVE);
    const c = crudo ? (JSON.parse(crudo) as Record<string, LineaCarrito[]>) : {};
    return c && typeof c === 'object' ? c : {};
  } catch {
    return {};
  }
}
