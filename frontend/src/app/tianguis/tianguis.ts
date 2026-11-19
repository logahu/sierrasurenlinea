import { Params } from '@angular/router';
import { Condicion, EstadoAnuncio, MotivoReporte, OrdenTianguis } from './tianguis.model';

export const NOMBRE_TIANGUIS = 'Tianguis Sierra Sur';
export const SUBTITULO_TIANGUIS = 'Compra y vende de segunda mano';

export const CONDICIONES: { valor: Condicion; texto: string }[] = [
  { valor: 'NUEVO_SIN_USO', texto: 'Nuevo sin usar' },
  { valor: 'SEMINUEVO', texto: 'Seminuevo' },
  { valor: 'USADO', texto: 'Usado' },
  { valor: 'REPARADO', texto: 'Reparado' },
];

export const ORDENES_TIANGUIS: { valor: OrdenTianguis; texto: string }[] = [
  { valor: 'recientes', texto: 'Más recientes' },
  { valor: 'precioAsc', texto: 'Menor precio' },
  { valor: 'precioDesc', texto: 'Mayor precio' },
];

export const MOTIVOS_REPORTE: { valor: MotivoReporte; texto: string }[] = [
  { valor: 'FRAUDE', texto: 'Fraude o estafa' },
  { valor: 'PROHIBIDO', texto: 'Artículo prohibido' },
  { valor: 'VENDIDO', texto: 'Ya se vendió' },
  { valor: 'FALSO', texto: 'Información falsa' },
  { valor: 'OTRO', texto: 'Otro' },
];

export const ESTADOS: Record<EstadoAnuncio, string> = {
  PENDIENTE: 'En revisión',
  PUBLICADO: 'Publicado',
  VENDIDO: 'Vendido',
  VENCIDO: 'Vencido',
  RECHAZADO: 'Rechazado',
  PAUSADO: 'Pausado',
};

export function textoCondicion(c: Condicion | string): string {
  return CONDICIONES.find((x) => x.valor === c)?.texto ?? c;
}

const PESOS = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
const PESOS_CENTAVOS = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 });

/** $85,000 (con centavos solo si los hay). */
export function precioMxn(n: number): string {
  return Number.isInteger(n) ? PESOS.format(n) : PESOS_CENTAVOS.format(n);
}

/** «hoy», «ayer», «hace 3 días», «hace 2 semanas», «hace 1 mes». */
export function haceCuanto(fecha: string | null | undefined, ahora: Date = new Date()): string {
  if (!fecha) return '';
  const f = new Date(fecha);
  if (isNaN(f.getTime())) return '';
  const inicio = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dias = Math.round((inicio(ahora) - inicio(f)) / 86_400_000);
  if (dias <= 0) return 'hoy';
  if (dias === 1) return 'ayer';
  if (dias < 14) return `hace ${dias} días`;
  if (dias < 60) return `hace ${Math.floor(dias / 7)} semanas`;
  const meses = Math.floor(dias / 30);
  return `hace ${meses} ${meses === 1 ? 'mes' : 'meses'}`;
}

/** Valor de un atributo para mostrarlo: las cantidades con unidad llevan separador de miles («120,000 km»). */
export function valorAtributo(valor: string, unidad: string | null | undefined): string {
  if (!unidad) return valor;
  const n = /^\d+(\.\d+)?$/.test(valor) ? Number(valor).toLocaleString('es-MX') : valor;
  return `${n} ${unidad}`;
}

/** Mensaje de contacto ya escrito, como pide la spec. */
export function mensajeContacto(titulo: string, url: string): string {
  return `Hola, vi tu anuncio "${titulo}" en ${NOMBRE_TIANGUIS} (${url}). ¿Sigue disponible?`;
}

export function enlaceWhatsapp(whatsapp: string, mensaje: string): string {
  return `https://wa.me/${whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(mensaje)}`;
}

/** «12-sofa-de-3-plazas» → 12. */
export function idDe(idSlug: string | null | undefined): number | null {
  const m = /^(\d+)/.exec(idSlug ?? '');
  return m ? Number(m[1]) : null;
}

/** 10 dígitos (acepta espacios, guiones, +52 o 521). */
export function whatsappValido(texto: string): boolean {
  let d = texto.replace(/\D/g, '');
  if (d.length === 13 && d.startsWith('521')) d = d.slice(3);
  if (d.length === 12 && d.startsWith('52')) d = d.slice(2);
  return d.length === 10;
}

export interface FiltrosTianguis {
  q: string;
  condicion: Condicion | null;
  precioMin: number | null;
  precioMax: number | null;
  orden: OrdenTianguis;
}

const numero = (v: unknown): number | null => {
  const n = typeof v === 'string' && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : null;
};

/** Filtros desde la URL (?q=&condicion=&min=&max=&orden=). */
export function filtrosDeUrl(p: Params): FiltrosTianguis {
  const condicion = CONDICIONES.some((c) => c.valor === p['condicion']) ? (p['condicion'] as Condicion) : null;
  const orden = ORDENES_TIANGUIS.some((o) => o.valor === p['orden']) ? (p['orden'] as OrdenTianguis) : 'recientes';
  return { q: typeof p['q'] === 'string' ? p['q'] : '', condicion, precioMin: numero(p['min']), precioMax: numero(p['max']), orden };
}

/** Para la URL: solo lo que no es el valor por omisión. */
export function urlDeFiltros(f: FiltrosTianguis): Params {
  return {
    q: f.q.trim() || null,
    condicion: f.condicion,
    min: f.precioMin,
    max: f.precioMax,
    orden: f.orden === 'recientes' ? null : f.orden,
  };
}

/** ¿Hay algún filtro puesto (además de la categoría)? */
export function hayFiltros(f: FiltrosTianguis): boolean {
  return !!f.q.trim() || !!f.condicion || f.precioMin !== null || f.precioMax !== null;
}
