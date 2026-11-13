import { GrupoOpciones, Platillo } from './catalogo.model';

/** Lo que eligió el cliente en un grupo. */
export interface Elegida {
  grupo: string;
  opcion: string;
}

const misma = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export function gruposDe(p: Platillo): GrupoOpciones[] {
  return p.opciones ?? [];
}

export function tieneOpciones(p: Platillo): boolean {
  return gruposDe(p).length > 0;
}

/** Cuántas se pueden elegir en el grupo. */
export function maximoDe(g: GrupoOpciones): number {
  return g.multiple ? (g.maximo ?? g.opciones.length) : 1;
}

export function estaElegida(elegidas: readonly Elegida[], g: GrupoOpciones, opcion: string): boolean {
  return elegidas.some((e) => misma(e.grupo, g.nombre) && misma(e.opcion, opcion));
}

/**
 * Marca o desmarca una opción. En «elige una» reemplaza la anterior; en «varias» no deja
 * pasar del máximo (devuelve lo mismo si ya está lleno).
 */
export function alternar(elegidas: readonly Elegida[], g: GrupoOpciones, opcion: string): Elegida[] {
  const delGrupo = elegidas.filter((e) => misma(e.grupo, g.nombre));
  const otras = elegidas.filter((e) => !misma(e.grupo, g.nombre));
  if (estaElegida(elegidas, g, opcion)) {
    // En «elige una» obligatoria no se puede quedar vacío con un clic.
    if (!g.multiple && g.obligatorio) return [...elegidas];
    return elegidas.filter((e) => !(misma(e.grupo, g.nombre) && misma(e.opcion, opcion)));
  }
  if (!g.multiple) return [...otras, { grupo: g.nombre, opcion }];
  if (delGrupo.length >= maximoDe(g)) return [...elegidas];
  return [...elegidas, { grupo: g.nombre, opcion }];
}

/** Precio de una pieza con sus extras. */
export function precioUnitario(p: Platillo, elegidas: readonly Elegida[] = []): number {
  let total = p.precio;
  for (const g of gruposDe(p)) {
    for (const o of g.opciones) if (estaElegida(elegidas, g, o.nombre)) total += o.precio;
  }
  return total;
}

/** Lo que falta elegir, p. ej. ['Carne']. */
export function gruposFaltantes(p: Platillo, elegidas: readonly Elegida[]): string[] {
  return gruposDe(p)
    .filter((g) => g.obligatorio && !elegidas.some((e) => misma(e.grupo, g.nombre)))
    .map((g) => g.nombre);
}

/** «Pastor · Queso (+$15)», en el orden de los grupos del menú. */
export function textoOpciones(p: Platillo, elegidas: readonly Elegida[] = []): string {
  const partes: string[] = [];
  for (const g of gruposDe(p)) {
    for (const o of g.opciones) {
      if (estaElegida(elegidas, g, o.nombre)) partes.push(o.precio > 0 ? `${o.nombre} (+$${o.precio})` : o.nombre);
    }
  }
  return partes.join(' · ');
}

/** Para comparar dos renglones: mismas opciones sin importar el orden. */
export function firmaOpciones(elegidas: readonly Elegida[] = []): string {
  return elegidas.map((e) => `${e.grupo.trim().toLowerCase()}=${e.opcion.trim().toLowerCase()}`).sort().join('|');
}

/** «Elige 1», «Opcional · hasta 2»… para la etiqueta del grupo. */
export function reglaDe(g: GrupoOpciones): string {
  if (!g.multiple) return g.obligatorio ? 'Elige 1' : 'Opcional · elige 1';
  const max = maximoDe(g);
  const hasta = max < g.opciones.length ? `hasta ${max}` : 'varias';
  return g.obligatorio ? `Elige ${hasta}` : `Opcional · ${hasta}`;
}
