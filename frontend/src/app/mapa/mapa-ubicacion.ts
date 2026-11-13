import {
  Component, DestroyRef, ElementRef, ViewEncapsulation, afterNextRender, effect, inject, input, model, signal, untracked,
  viewChild,
} from '@angular/core';
import type { Map as MapaLeaflet, Marker } from 'leaflet';
import { MIAHUATLAN, Punto, enlaceVer } from './ubicacion';

const PIN = `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="46" viewBox="0 0 34 46" aria-hidden="true">
  <path d="M17 1C8.2 1 1 8.1 1 16.9 1 28.7 17 45 17 45s16-16.3 16-28.1C33 8.1 25.8 1 17 1z" fill="#c92a2a" stroke="#fff" stroke-width="2"/>
  <circle cx="17" cy="17" r="6" fill="#fff"/></svg>`;

/**
 * Mapa para marcar el punto de entrega (OpenStreetMap con Leaflet, sin clave ni costo).
 * Se toca el mapa o se arrastra el pin; "Usar mi ubicación" lo pone donde está el celular.
 * Con [soloLectura] solo muestra el punto.
 */
@Component({
  selector: 'app-mapa-ubicacion',
  encapsulation: ViewEncapsulation.None,
  styleUrl: './mapa-ubicacion.scss',
  template: `
    <div class="mapa-ubicacion" [class.solo-lectura]="soloLectura()">
      @if (!soloLectura()) {
        <div class="mapa-barra">
          <button type="button" class="mapa-boton" (click)="usarMiUbicacion()" [disabled]="buscando()">
            {{ buscando() ? 'Buscando…' : '📍 Usar mi ubicación' }}
          </button>
          @if (punto()) {
            <a [href]="ver()" target="_blank" rel="noopener">Ver en Google Maps</a>
            <button type="button" class="mapa-quitar" (click)="quitar()">Quitar punto</button>
          }
        </div>
      }
      <div #lienzo class="mapa-lienzo" role="application" [attr.aria-label]="soloLectura() ? 'Mapa con ' + (para() === 'negocio' ? 'la ubicación del negocio' : 'el punto de entrega') : 'Mapa: toca para marcar ' + (para() === 'negocio' ? 'dónde está el negocio' : 'el punto de entrega')"></div>
      @if (!soloLectura()) {
        <p class="mapa-ayuda" [class.mapa-error]="!!error()">
          {{ error() ?? (punto() ? 'Arrastra el pin si hace falta para dejarlo justo en la entrada.' : para() === 'negocio' ? 'Toca el mapa donde está el negocio, o usa tu ubicación si estás ahí.' : 'Toca el mapa en el lugar de entrega, o usa tu ubicación.') }}
        </p>
      }
      @if (fallo()) {
        <p class="mapa-error">No se pudo cargar el mapa. Escribe bien la dirección y las referencias.</p>
      }
    </div>
  `,
})
export class MapaUbicacion {
  /** Punto marcado (dos sentidos). */
  readonly punto = model<Punto | null>(null);
  readonly soloLectura = input(false);
  /** Para los textos: el punto de entrega de un pedido o dónde está un negocio. */
  readonly para = input<'entrega' | 'negocio'>('entrega');

  private readonly lienzo = viewChild.required<ElementRef<HTMLDivElement>>('lienzo');
  protected readonly buscando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly fallo = signal(false);

  private mapa?: MapaLeaflet;
  private pin?: Marker;
  private L?: typeof import('leaflet');

  constructor() {
    afterNextRender(() => void this.iniciar());
    inject(DestroyRef).onDestroy(() => this.mapa?.remove());
    // Si el punto cambia desde fuera (p. ej. llega la ubicación de la cuenta), se mueve el pin.
    effect(() => {
      const p = this.punto();
      untracked(() => this.dibujar(p, true));
    });
  }

  protected ver(): string {
    const p = this.punto();
    return p ? enlaceVer(p) : '#';
  }

  private async iniciar(): Promise<void> {
    try {
      // Leaflet no es un módulo ES: según cómo se empaquete, llega directo o dentro de "default".
      const modulo = (await import('leaflet')) as typeof import('leaflet') & { default?: typeof import('leaflet') };
      this.L = modulo.default ?? modulo;
      if (typeof this.L.map !== 'function') throw new Error('Leaflet no cargó');
    } catch {
      this.fallo.set(true);
      return;
    }
    const L = this.L;
    const inicio = this.punto() ?? MIAHUATLAN;
    this.mapa = L.map(this.lienzo().nativeElement, {
      center: [inicio.lat, inicio.lng],
      zoom: this.punto() ? 17 : 15,
      scrollWheelZoom: false,
      dragging: !this.soloLectura() || !L.Browser.mobile,
      zoomControl: true,
      attributionControl: true,
    });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
    }).addTo(this.mapa);
    if (!this.soloLectura()) {
      this.mapa.on('click', (e) => this.marcar({ lat: e.latlng.lat, lng: e.latlng.lng }));
    }
    this.dibujar(this.punto(), true);
  }

  private dibujar(p: Punto | null, centrar: boolean): void {
    const L = this.L;
    if (!L || !this.mapa) return;
    if (!p) {
      this.pin?.remove();
      this.pin = undefined;
      return;
    }
    if (!this.pin) {
      this.pin = L.marker([p.lat, p.lng], {
        draggable: !this.soloLectura(),
        keyboard: false,
        icon: L.divIcon({ html: PIN, className: 'mapa-pin', iconSize: [34, 46], iconAnchor: [17, 45] }),
      }).addTo(this.mapa);
      this.pin.on('dragend', () => {
        const ll = this.pin!.getLatLng();
        this.punto.set({ lat: ll.lat, lng: ll.lng });
      });
    } else {
      this.pin.setLatLng([p.lat, p.lng]);
    }
    if (centrar) this.mapa.setView([p.lat, p.lng], Math.max(this.mapa.getZoom(), 17));
  }

  private marcar(p: Punto): void {
    this.error.set(null);
    this.punto.set(p);
  }

  protected quitar(): void {
    this.punto.set(null);
  }

  protected usarMiUbicacion(): void {
    this.error.set(null);
    if (!('geolocation' in navigator)) {
      this.error.set('Tu navegador no comparte la ubicación. Toca el mapa en el lugar de entrega.');
      return;
    }
    this.buscando.set(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.buscando.set(false);
        this.marcar({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        this.buscando.set(false);
        this.error.set('No pudimos obtener tu ubicación (revisa el permiso). Toca el mapa en el lugar de entrega.');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  }
}
