import { Negocio } from './catalogo.model';
import { Punto, enlaceComoLlegar, puntoDe } from '../mapa/ubicacion';

/** Lo que se muestra cuando el negocio no tiene local. */
export const LEYENDA_EN_LINEA =
  'Este negocio no tiene local para visitas. Haz tu pedido aquí o escríbenos por WhatsApp; te lo llevamos o te confirmamos por mensaje.';

const MUNICIPIO = 'Miahuatlán de Porfirio Díaz, Oax.';

type DatosUbicacion = Pick<Negocio, 'direccion' | 'colonia' | 'referencias' | 'lat' | 'lng' | 'atencionEnLocal'>;

/** ¿Muestra datos de local? (con local y con algo que enseñar). */
export function tieneLocal(n: DatosUbicacion): boolean {
  return !!n.atencionEnLocal;
}

/** «Av. Juárez 25, Centro» (sin el municipio). */
export function direccionCorta(n: DatosUbicacion): string {
  return [n.direccion?.trim(), n.colonia?.trim()].filter(Boolean).join(', ');
}

export function puntoNegocio(n: DatosUbicacion): Punto | null {
  return n.atencionEnLocal ? puntoDe(n.lat, n.lng) : null;
}

/** «Cómo llegar»: al pin si lo hay; si no, se busca la dirección escrita en Miahuatlán. */
export function enlaceLlegarNegocio(n: DatosUbicacion): string | null {
  if (!n.atencionEnLocal) return null;
  const p = puntoNegocio(n);
  if (p) return enlaceComoLlegar(p);
  const dir = direccionCorta(n);
  return dir ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${dir}, ${MUNICIPIO}`)}` : null;
}

/** «Lun a sáb, 9:00 a 19:00» → más corto para la franja: «Lun a sáb 9–19». */
export function horarioCorto(horario: string | null | undefined): string {
  return (horario ?? '').trim().replace(/,\s*/, ' ').replace(/(\d{1,2}):00\s*a\s*(\d{1,2}):00/, '$1–$2');
}
