import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, inject } from '@angular/core';
import { Negocio } from './catalogo.model';

const LOCALIDAD = 'Miahuatlán de Porfirio Díaz';

/** Tipo de schema.org según el giro; si no hay uno más preciso, LocalBusiness. */
const TIPO_POR_GIRO: Record<string, string> = {
  belleza: 'BeautySalon',
  flores: 'Florist',
  bebidas: 'LiquorStore',
  comida: 'Restaurant',
  autos: 'AutoDealer',
};

/**
 * Datos estructurados (schema.org, JSON-LD) de un negocio: le dicen a Google qué es, dónde está y
 * cuál es su perfil de Google Maps (sameAs), para que relacione la página con ese perfil.
 * {@code origen}: https://sierrasurenlinea.com.mx (sin diagonal final).
 */
export function datosEstructurados(n: Negocio, origen: string): Record<string, unknown> {
  const url = `${origen}/${n.slug}`;
  const absoluta = (u: string) => (/^https?:\/\//.test(u) ? u : `${origen}/${u.replace(/^\//, '')}`);
  const d: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': TIPO_POR_GIRO[n.giro?.slug ?? ''] ?? 'LocalBusiness',
    '@id': `${url}#negocio`,
    name: n.nombre,
    url,
  };
  const descripcion = n.descripcion || n.eslogan;
  if (descripcion) d['description'] = descripcion;
  if (n.portadaUrl) d['image'] = absoluta(n.portadaUrl);
  const tel = (n.telefono || n.whatsapp || '').replace(/\D/g, '');
  if (tel.length >= 10) d['telephone'] = `+52${tel.slice(-10)}`;
  if (n.atencionEnLocal && n.direccion) {
    d['address'] = {
      '@type': 'PostalAddress',
      streetAddress: [n.direccion, n.colonia].filter(Boolean).join(', '),
      addressLocality: LOCALIDAD,
      addressRegion: 'Oaxaca',
      addressCountry: 'MX',
    };
  }
  if (n.atencionEnLocal && n.lat != null && n.lng != null) {
    d['geo'] = { '@type': 'GeoCoordinates', latitude: Number(n.lat), longitude: Number(n.lng) };
  }
  if (n.googleMapsUrl) {
    d['hasMap'] = n.googleMapsUrl;
    d['sameAs'] = [n.googleMapsUrl];
  }
  // El horario es texto libre («Lun a sáb, 10:00 a 19:00»): no se inventa openingHours.
  return d;
}

/** Pone y quita el <script type="application/ld+json"> del negocio en el <head>. */
@Injectable()
export class DatosEstructurados {
  private readonly doc = inject(DOCUMENT);
  private script: HTMLScriptElement | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.quitar());
  }

  poner(n: Negocio | null | undefined): void {
    if (!n) return this.quitar();
    if (!this.script) {
      this.script = this.doc.createElement('script');
      this.script.type = 'application/ld+json';
      this.script.id = 'ld-negocio';
      this.doc.head.appendChild(this.script);
    }
    const origen = this.doc.location?.origin || 'https://sierrasurenlinea.com.mx';
    // «<» escapado para que el texto del negocio no pueda cerrar la etiqueta.
    this.script.textContent = JSON.stringify(datosEstructurados(n, origen)).replace(/</g, '\\u003c');
  }

  quitar(): void {
    this.script?.remove();
    this.script = null;
  }
}
