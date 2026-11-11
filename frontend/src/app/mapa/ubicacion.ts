/** Un punto en el mapa. */
export interface Punto {
  lat: number;
  lng: number;
}

/** Centro de Miahuatlán de Porfirio Díaz (zócalo), donde abre el mapa si no hay punto. */
export const MIAHUATLAN: Punto = { lat: 16.3283, lng: -96.5961 };

/** Enlace para ver el punto en Google Maps (no necesita clave). */
export function enlaceVer(p: Punto): string {
  return `https://maps.google.com/?q=${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;
}

/** Enlace "Cómo llegar": abre la navegación de Google Maps hacia el punto. */
export function enlaceComoLlegar(p: Punto): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;
}

/** Solo puntos razonables (dentro de México), igual que el backend. */
export function puntoValido(p: Punto | null | undefined): p is Punto {
  return !!p && Number.isFinite(p.lat) && Number.isFinite(p.lng) && p.lat >= 14 && p.lat <= 33 && p.lng >= -119 && p.lng <= -86;
}

/** Del API (números o null) a un punto, si viene completo. */
export function puntoDe(lat: number | null | undefined, lng: number | null | undefined): Punto | null {
  const p = lat != null && lng != null ? { lat: Number(lat), lng: Number(lng) } : null;
  return puntoValido(p) ? p : null;
}
