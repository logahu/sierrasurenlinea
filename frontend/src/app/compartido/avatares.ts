/**
 * Dibujos que se pueden elegir como avatar (los mismos nombres que acepta el backend:
 * «avatar:flor»…). Trazo blanco sobre un fondo propio de cada uno.
 */
export interface Dibujo {
  id: string;
  nombre: string;
  fondo: string;
  /** Trazos SVG en un lienzo de 24×24. */
  trazos: string[];
}

export const DIBUJOS: Dibujo[] = [
  { id: 'flor', nombre: 'Flor', fondo: '#c2255c', trazos: ['M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z', 'M12 9.5C11 6 13 4.5 14.6 6.3M14.5 12c3.5-1 5 1 3.2 2.6M12 14.5c1 3.5-1 5-2.6 3.2M9.5 12C6 13 4.5 11 6.3 9.4'] },
  { id: 'maguey', nombre: 'Maguey', fondo: '#2b8a3e', trazos: ['M12 20V9', 'M12 20c-1.5-3-4-6-7-7.5', 'M12 20c1.5-3 4-6 7-7.5', 'M12 20c-.8-4-2.5-8-5-10.5', 'M12 20c.8-4 2.5-8 5-10.5', 'M5 20h14'] },
  { id: 'sol', nombre: 'Sol', fondo: '#d9480f', trazos: ['M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z', 'M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4'] },
  { id: 'cerro', nombre: 'Cerro', fondo: '#364fc7', trazos: ['M3 19 9.5 9l3.5 5 2.5-3L21 19Z', 'M9.5 9 11 11.5 9.5 11 8 12', 'M16.5 6.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z'] },
  { id: 'colibri', nombre: 'Colibrí', fondo: '#0b7285', trazos: ['M4 12.5 10 11c2-2.5 4.5-3 6.5-1.5L21 8l-3.6 3.3c0 3-2.4 5.2-5.4 5.2L8 18l1.5-2.5L6 15', 'M14.5 10.5h.01'] },
  { id: 'mariposa', nombre: 'Mariposa', fondo: '#862e9c', trazos: ['M12 7v11', 'M12 9C9.5 5 4.5 5.5 5 9c.3 2 2.5 3 7 3.5', 'M12 9c2.5-4 7.5-3.5 7 0-.3 2-2.5 3-7 3.5', 'M12 12.5c-3 .5-5 2-4.5 4 .5 1.5 3 1 4.5-1.5', 'M12 12.5c3 .5 5 2 4.5 4-.5 1.5-3 1-4.5-1.5', 'M10.5 5.5 12 7l1.5-1.5'] },
  { id: 'nopal', nombre: 'Nopal', fondo: '#5c940d', trazos: ['M12 21v-5', 'M9.5 16a3.5 4 0 1 1 5 0', 'M8 11.5a2.5 3 0 1 1 3-3.8', 'M16 11.5a2.5 3 0 1 0-3-3.8', 'M7 20h10'] },
  { id: 'luna', nombre: 'Luna', fondo: '#3b5bdb', trazos: ['M15.5 4.5a8 8 0 1 0 4 11.5 6.5 6.5 0 0 1-4-11.5Z', 'M18 5l.4 1.1 1.1.4-1.1.4L18 8l-.4-1.1-1.1-.4 1.1-.4Z'] },
  { id: 'taza', nombre: 'Taza de café', fondo: '#7a4b23', trazos: ['M5 10h11v4a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5Z', 'M16 11h1.5a2.5 2.5 0 0 1 0 5H15.5', 'M8.5 4.5c-.6.8.6 1.6 0 2.5M11.5 4c-.6.8.6 1.6 0 2.5', 'M4 21h14'] },
  { id: 'moto', nombre: 'Moto', fondo: '#c92a2a', trazos: ['M6 17a2.5 2.5 0 1 0 0-.01Z', 'M18 17a2.5 2.5 0 1 0 0-.01Z', 'M6 17h5l3-6h3l1 6', 'M14 11l-1.5-3H15', 'M9 11h4'] },
  { id: 'estrella', nombre: 'Estrella', fondo: '#e67700', trazos: ['M12 4l2.3 4.8 5.2.7-3.8 3.6.9 5.2L12 15.8l-4.6 2.5.9-5.2-3.8-3.6 5.2-.7Z'] },
  { id: 'corazon', nombre: 'Corazón', fondo: '#a61e4d', trazos: ['M12 19s-7-4.3-7-9.2A3.8 3.8 0 0 1 12 7.6a3.8 3.8 0 0 1 7 2.2C19 14.7 12 19 12 19Z'] },
];

const POR_ID = new Map(DIBUJOS.map((d) => [d.id, d]));

/** «avatar:flor» → el dibujo; cualquier otra cosa → null. */
export function dibujoDe(avatar: string | null | undefined): Dibujo | null {
  return avatar?.startsWith('avatar:') ? (POR_ID.get(avatar.slice(7)) ?? null) : null;
}

/** Una URL de foto (no un dibujo). */
export function esFoto(avatar: string | null | undefined): boolean {
  return !!avatar && /^https?:\/\//.test(avatar);
}

/** «Ana María López» → «AM». */
export function inicialesDe(nombre: string | null | undefined): string {
  const p = (nombre ?? '').trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase() || '?';
}

const FONDOS_INICIALES = ['#2f6b4f', '#5f3dc4', '#1864ab', '#a61e4d', '#7a4b23', '#0b7285'];

/** Color estable para las iniciales de una persona (siempre el mismo para el mismo nombre). */
export function fondoDeIniciales(nombre: string | null | undefined): string {
  let h = 0;
  for (const c of nombre ?? '') h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return FONDOS_INICIALES[h % FONDOS_INICIALES.length];
}
