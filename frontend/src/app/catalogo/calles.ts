import { Giro, GiroResumen, Negocio } from './catalogo.model';

/** Fachadas que caben en una calle de la portada; las demás, en «Ver todos». */
export const MAX_FACHADAS = 6;

/** Una calle de la portada: un giro con sus negocios, en orden. */
export interface Calle {
  giro: GiroResumen & { icono: string | null };
  negocios: Negocio[];
}

/** Giro para los negocios que no traen uno (no debería pasar, pero no se pierden). */
const OTROS: Calle['giro'] = { slug: 'otros', nombre: 'Otros negocios', icono: null };

/**
 * Agrupa los negocios en calles, en el orden de los giros. Los giros sin negocios no
 * aparecen; dentro de cada calle se respeta el orden en que llegan los negocios.
 */
export function callesPorGiro(giros: Giro[], negocios: Negocio[]): Calle[] {
  const porGiro = new Map<string, Negocio[]>();
  for (const n of negocios) {
    const slug = n.giro?.slug && giros.some((g) => g.slug === n.giro!.slug) ? n.giro.slug : OTROS.slug;
    porGiro.set(slug, [...(porGiro.get(slug) ?? []), n]);
  }
  const calles: Calle[] = [...giros]
    .sort((a, b) => a.orden - b.orden)
    .filter((g) => porGiro.has(g.slug))
    .map((g) => ({ giro: { slug: g.slug, nombre: g.nombre, icono: g.icono }, negocios: porGiro.get(g.slug)! }));
  if (porGiro.has(OTROS.slug)) calles.push({ giro: OTROS, negocios: porGiro.get(OTROS.slug)! });
  return calles;
}

/** Solo la calle del giro elegido (o todas si no hay giro o no existe). */
export function filtrarCalles(calles: Calle[], giro: string | null | undefined): Calle[] {
  if (!giro) return calles;
  const una = calles.filter((c) => c.giro.slug === giro);
  return una.length ? una : calles;
}

/** Las fachadas que se ven en la calle y cuántas quedan para «+N Ver todos». */
export function fachadasDe(calle: Calle, max = MAX_FACHADAS): { visibles: Negocio[]; resto: number } {
  return { visibles: calle.negocios.slice(0, max), resto: Math.max(0, calle.negocios.length - max) };
}

/** Dónde va el banner ENTRE_CALLES: después de la segunda calle (o de la última, si hay menos). */
export function indiceBannerEntreCalles(calles: number): number {
  return Math.min(1, calles - 1);
}
