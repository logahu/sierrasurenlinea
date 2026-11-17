import { Injectable, signal } from '@angular/core';

/** Cuánto dura oculta la publicidad cuando el visitante toca ×. */
export const DIAS_OCULTA = 7;
const CLAVE = 'ssl:publicidad-oculta';
const DIA_MS = 24 * 60 * 60 * 1000;

/** Hasta cuándo (ms) queda oculta si se oculta en `ahora`. */
export function ocultaHasta(ahora: number, dias = DIAS_OCULTA): number {
  return ahora + dias * DIA_MS;
}

/** Si lo guardado sigue vigente. Cualquier valor raro cuenta como «no oculta». */
export function sigueOculta(guardado: string | null, ahora: number): boolean {
  const hasta = Number(guardado);
  return Number.isFinite(hasta) && hasta > ahora;
}

/** Ruta del sitio (se abre en la misma app) o dirección externa. */
export function esEnlaceInterno(enlace: string | null | undefined): boolean {
  return !!enlace && enlace.startsWith('/') && !enlace.startsWith('//');
}

/** Color de texto legible (4.5:1 o más) sobre el fondo del anuncio. */
export function textoSobre(fondo: string | null | undefined): '#ffffff' | '#14181f' {
  const m = /^#?([0-9a-f]{6})$/i.exec(fondo ?? '');
  if (!m) return '#ffffff'; // fondo por omisión: añil oscuro
  const canal = (i: number) => {
    const c = parseInt(m[1].slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const l = 0.2126 * canal(0) + 0.7152 * canal(2) + 0.0722 * canal(4);
  const contraBlanco = 1.05 / (l + 0.05);
  const contraOscuro = (l + 0.05) / (0.0091 + 0.05); // #14181f
  return contraBlanco >= contraOscuro ? '#ffffff' : '#14181f';
}

/**
 * Si el visitante ocultó la publicidad. Es una sola preferencia para todos los banners:
 * al tocar × en uno se ocultan todos durante 7 días, y «Mostrar publicidad» los regresa.
 */
@Injectable({ providedIn: 'root' })
export class PublicidadService {
  readonly oculta = signal(sigueOculta(leer(), Date.now()));

  ocultar(ahora = Date.now()): void {
    this.oculta.set(true);
    guardar(String(ocultaHasta(ahora)));
  }

  mostrar(): void {
    this.oculta.set(false);
    guardar(null);
  }
}

// localStorage puede no estar disponible (modo privado, vista previa): entonces dura la visita.
function leer(): string | null {
  try {
    return localStorage.getItem(CLAVE);
  } catch {
    return null;
  }
}

function guardar(valor: string | null): void {
  try {
    if (valor === null) localStorage.removeItem(CLAVE);
    else localStorage.setItem(CLAVE, valor);
  } catch {
    /* sin almacenamiento */
  }
}
