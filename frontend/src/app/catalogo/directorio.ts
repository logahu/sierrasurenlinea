import { Params } from '@angular/router';
import { Giro, Negocio } from './catalogo.model';

/** Orden del directorio. «Recomendados» es el del servidor: patrocinados y luego el orden del sitio. */
export type OrdenDirectorio = 'recomendados' | 'nuevos' | 'az';

export const ORDENES: { valor: OrdenDirectorio; texto: string }[] = [
  { valor: 'recomendados', texto: 'Recomendados' },
  { valor: 'nuevos', texto: 'Nuevos' },
  { valor: 'az', texto: 'A–Z' },
];

/** Cuántos días un negocio lleva la etiqueta «Nuevo». */
export const DIAS_NUEVO = 30;

export interface FiltrosDirectorio {
  giro: string | null;
  q: string;
  orden: OrdenDirectorio;
}

/** Sin acentos, sin mayúsculas y sin espacios de sobra: «Florería  San José» → «floreria san jose». */
export function normalizar(texto: string | null | undefined): string {
  return (texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Busca cada palabra en el nombre, el eslogan y el giro del negocio. */
export function coincide(n: Negocio, q: string): boolean {
  const palabras = normalizar(q).split(' ').filter(Boolean);
  if (!palabras.length) return true;
  const donde = normalizar(`${n.nombre} ${n.eslogan ?? ''} ${n.giro?.nombre ?? ''}`);
  return palabras.every((p) => donde.includes(p));
}

export function filtrar(negocios: Negocio[], f: Pick<FiltrosDirectorio, 'giro' | 'q'>): Negocio[] {
  return negocios.filter((n) => (!f.giro || n.giro?.slug === f.giro) && coincide(n, f.q));
}

/**
 * Ordena sin mover el original. Recomendados: los patrocinados primero y luego el orden del
 * servidor. Nuevos: el alta más reciente primero. A–Z: por nombre, en español.
 */
export function ordenar(negocios: Negocio[], orden: OrdenDirectorio): Negocio[] {
  const l = [...negocios];
  const az = (a: Negocio, b: Negocio) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' });
  if (orden === 'az') return l.sort(az);
  if (orden === 'nuevos') return l.sort((a, b) => (b.creadoEn ?? '').localeCompare(a.creadoEn ?? '') || az(a, b));
  return l.sort((a, b) => Number(!!b.patrocinado) - Number(!!a.patrocinado));
}

export interface ChipGiro {
  giro: Giro;
  negocios: number;
}

/** Un chip por giro con negocios (en el orden de los giros), con cuántos tiene. */
export function chipsDeGiro(giros: Giro[], negocios: Negocio[]): ChipGiro[] {
  return [...giros]
    .sort((a, b) => a.orden - b.orden)
    .map((giro) => ({ giro, negocios: negocios.filter((n) => n.giro?.slug === giro.slug).length }))
    .filter((c) => c.negocios > 0);
}

/** Dado de alta en los últimos 30 días. */
export function esNuevo(n: Negocio, hoy: Date = new Date()): boolean {
  if (!n.creadoEn) return false;
  const alta = new Date(n.creadoEn);
  if (isNaN(alta.getTime())) return false;
  return hoy.getTime() - alta.getTime() <= DIAS_NUEVO * 24 * 60 * 60 * 1000;
}

/** Venta, Renta, Servicio o Citas. */
export function tipoDe(n: Pick<Negocio, 'tipo' | 'modoPedido'>): string {
  if (n.tipo === 'SERVICIO') return 'Servicio';
  if (n.modoPedido === 'CITA') return 'Citas';
  if (n.modoPedido === 'RENTA' || n.tipo === 'RENTA') return 'Renta';
  return 'Venta';
}

/** «Renta de Inflables» → «RI»; «TuRamoHoy» → «TU». */
export function iniciales(nombre: string): string {
  const palabras = nombre.split(/\s+/).filter((w) => w.length > 2);
  const r = palabras.length >= 2 ? palabras[0][0] + palabras[1][0] : (palabras[0] ?? nombre).slice(0, 2);
  return r.toUpperCase();
}

/** Lee giro, búsqueda y orden de la URL (?giro=flores&q=rosas&orden=nuevos). */
export function filtrosDeUrl(p: Params): FiltrosDirectorio {
  const orden = ORDENES.some((o) => o.valor === p['orden']) ? (p['orden'] as OrdenDirectorio) : 'recomendados';
  const giro = typeof p['giro'] === 'string' && p['giro'].trim() ? p['giro'].trim() : null;
  const q = typeof p['q'] === 'string' ? p['q'] : '';
  return { giro, q, orden };
}

/** Para la URL: solo lo que no es el valor por omisión (null borra el parámetro). */
export function urlDeFiltros(f: FiltrosDirectorio): Params {
  return {
    giro: f.giro || null,
    q: f.q.trim() || null,
    orden: f.orden === 'recomendados' ? null : f.orden,
  };
}
