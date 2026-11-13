import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';
import { environment } from '../../environments/environment';

/** Colonia, barrio o comunidad del catálogo (las que el administrador dejó activas). */
export interface Colonia {
  id: number;
  nombre: string;
  tipo: string;
  codigoPostal: string | null;
  /** Nombre de la tarifa de Encarguitos que le toca (p. ej. «Centro»), o null. */
  zona: string | null;
}

/** Lo que eligió el cliente. */
export interface SeleccionColonia {
  /** null si la escribió en «Otra». */
  id: number | null;
  /** Texto que se guarda en el pedido. */
  nombre: string;
  zona: string | null;
  otra: boolean;
}

/** Orden de los grupos en el combo. */
export const TIPOS_COLONIA = ['Barrio', 'Colonia', 'Fraccionamiento', 'Agencia', 'Ranchería', 'Localidad'] as const;

const PLURAL: Record<string, string> = {
  Barrio: 'Barrios', Colonia: 'Colonias', Fraccionamiento: 'Fraccionamientos', Agencia: 'Agencias',
  Ranchería: 'Rancherías y comunidades', Localidad: 'Localidades',
};

export function plural(tipo: string): string {
  return PLURAL[tipo] ?? tipo;
}

/** Sin acentos ni mayúsculas ni signos, como compara el servidor. */
export function clave(texto: string | null | undefined): string {
  return (texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/** Agrupadas por tipo y ordenadas por nombre. */
export function agrupar(colonias: readonly Colonia[]): { tipo: string; titulo: string; colonias: Colonia[] }[] {
  const orden = (t: string) => {
    const i = (TIPOS_COLONIA as readonly string[]).indexOf(t);
    return i < 0 ? 99 : i;
  };
  const tipos = [...new Set(colonias.map((c) => c.tipo))].sort((a, b) => orden(a) - orden(b) || a.localeCompare(b, 'es'));
  return tipos.map((tipo) => ({
    tipo,
    titulo: plural(tipo),
    colonias: colonias.filter((c) => c.tipo === tipo).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { numeric: true })),
  }));
}

/** Texto que se guarda: si hay dos con el mismo nombre (Barrio y Colonia Dolores), se aclara el tipo. */
export function nombreParaPedido(c: Colonia, todas: readonly Colonia[]): string {
  const repetido = todas.some((o) => o.id !== c.id && clave(o.nombre) === clave(c.nombre));
  return repetido ? `${c.nombre} (${c.tipo})` : c.nombre;
}

/** La lista se pide una vez y la comparten el carrito y Encarguitos. */
@Injectable({ providedIn: 'root' })
export class ColoniasService {
  private readonly http = inject(HttpClient);
  readonly lista = rxResource({
    stream: () => this.http.get<Colonia[]>(`${environment.apiUrl}/colonias`).pipe(catchError(() => of([] as Colonia[]))),
  });
}
