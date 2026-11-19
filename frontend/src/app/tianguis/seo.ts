import { DOCUMENT } from '@angular/common';
import { DestroyRef, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

export interface DatosSeo {
  titulo: string;
  descripcion: string;
  /** Ruta del sitio (/tianguis/12-sofa) o URL completa. */
  ruta: string;
  imagen?: string | null;
}

const ETIQUETAS = ['description', 'og:title', 'og:description', 'og:url', 'og:image', 'og:type'] as const;

/**
 * Título, descripción y Open Graph de una página del tianguis. Devuelve la función para ponerlos
 * (se puede llamar varias veces); al salir de la página se restauran los del sitio.
 */
export function usarSeo(): (d: DatosSeo) => void {
  const titulo = inject(Title);
  const meta = inject(Meta);
  const doc = inject(DOCUMENT);
  const antes = { titulo: titulo.getTitle(), etiquetas: new Map<string, string | null>() };
  const selector = (n: string) => (n.startsWith('og:') ? `property="${n}"` : `name="${n}"`);
  for (const n of ETIQUETAS) antes.etiquetas.set(n, meta.getTag(selector(n))?.content ?? null);
  inject(DestroyRef).onDestroy(() => {
    titulo.setTitle(antes.titulo);
    for (const [n, v] of antes.etiquetas) {
      if (v === null) meta.removeTag(selector(n));
      else poner(n, v);
    }
  });
  function poner(n: string, v: string): void {
    if (n.startsWith('og:')) meta.updateTag({ property: n, content: v });
    else meta.updateTag({ name: n, content: v });
  }
  return (d: DatosSeo) => {
    const origen = doc.location?.origin || 'https://sierrasurenlinea.com.mx';
    const absoluta = (u: string) => (/^https?:\/\//.test(u) ? u : `${origen}/${u.replace(/^\//, '')}`);
    titulo.setTitle(d.titulo);
    poner('description', d.descripcion);
    poner('og:title', d.titulo);
    poner('og:description', d.descripcion);
    poner('og:url', absoluta(d.ruta));
    poner('og:type', 'website');
    poner('og:image', absoluta(d.imagen || 'img/tianguis.svg'));
  };
}
