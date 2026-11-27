/** Utilidades de color para que el color de cada negocio siempre se lea. */

function rgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)) as [number, number, number];
}

function luminancia([r, g, b]: [number, number, number]): number {
  const c = (v: number) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b);
}

/** Contraste WCAG del color contra el blanco. */
export function contrasteConBlanco(hex: string): number {
  const v = rgb(hex);
  return v ? 1.05 / (luminancia(v) + 0.05) : 21;
}

/**
 * El color del negocio listo para usarse de acento (botones con texto blanco, enlaces, subrayados).
 * Si es muy claro (por ejemplo marfil), se oscurece mezclándolo con tinta hasta que el texto blanco
 * se lea (contraste ≥ 4.5:1). Un color inválido o vacío regresa null (se usa el acento por omisión).
 */
export function acentoLegible(hex: string | null | undefined): string | null {
  const v = hex ? rgb(hex) : null;
  if (!v) return null;
  const tinta: [number, number, number] = [26, 26, 26];
  for (let t = 0; t <= 1.0001; t += 0.05) {
    const m = v.map((c, i) => Math.round(c * (1 - t) + tinta[i] * t)) as [number, number, number];
    if (1.05 / (luminancia(m) + 0.05) >= 4.5) {
      return '#' + m.map((c) => c.toString(16).padStart(2, '0')).join('');
    }
  }
  return '#1a1a1a';
}

/** Contraste WCAG entre dos colores (#rrggbb); 1 si alguno no es válido. */
export function contraste(a: string, b: string): number {
  const x = rgb(a);
  const y = rgb(b);
  if (!x || !y) return 1;
  const [l1, l2] = [luminancia(x), luminancia(y)].sort((p, q) => q - p);
  return (l1 + 0.05) / (l2 + 0.05);
}

/** Fondos del sitio en modo claro y oscuro (los mismos de styles.scss). */
export const FONDO_CLARO = '#fbf7f2';
export const FONDO_OSCURO = '#1a1412';

/**
 * Si el color del negocio se distingue del fondo (3:1, lo mínimo para puntos, franjas y bordes)
 * en modo claro y en modo oscuro. Un negro o un marfil desaparecen en uno de los dos.
 */
export function colorSeVe(hex: string | null | undefined): { claro: boolean; oscuro: boolean } {
  if (!hex || !rgb(hex)) return { claro: false, oscuro: false };
  return { claro: contraste(hex, FONDO_CLARO) >= 3, oscuro: contraste(hex, FONDO_OSCURO) >= 3 };
}

/** Colores sugeridos para un negocio: todos se distinguen del fondo en modo claro y en modo oscuro. */
export const COLORES_SUGERIDOS: { nombre: string; hex: string }[] = [
  { nombre: 'Verde follaje', hex: '#2f8a5b' },
  { nombre: 'Rosa', hex: '#d6336c' },
  { nombre: 'Morado', hex: '#9c36b5' },
  { nombre: 'Azul', hex: '#1971c2' },
  { nombre: 'Turquesa', hex: '#0c8599' },
  { nombre: 'Naranja', hex: '#e8590c' },
  { nombre: 'Barro', hex: '#b35c1e' },
  { nombre: 'Dorado viejo', hex: '#8a6d3b' },
  { nombre: 'Vino', hex: '#c2255c' },
];
