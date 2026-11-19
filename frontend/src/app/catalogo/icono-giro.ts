import { Component, input } from '@angular/core';

/** Dibujo de cada giro (trazo, sin dependencias). Uno genérico si el nombre no se conoce. */
@Component({
  selector: 'app-icono-giro',
  template: `
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8"
         stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      @switch (icono()) {
        @case ('flor') {
          <circle cx="12" cy="8" r="2.2" /><path d="M12 5.8c-1-2.6 2-3.4 2.2-1.4M14.2 8c2.6-1 3.4 2 1.4 2.2M12 10.2c1 2.6-2 3.4-2.2 1.4M9.8 8c-2.6 1-3.4-2-1.4-2.2" /><path d="M12 10.5V21M12 16c-2.5 0-4-1.5-4.5-3.5 2.5 0 4 1.3 4.5 3.5ZM12 18.5c2.5 0 4-1.5 4.5-3.5-2.5 0-4 1.3-4.5 3.5Z" />
        }
        @case ('belleza') {
          <path d="M9 21h6M10 21V11h4v10M10.5 11 11 6.5 13.5 4.5 14 11" /><path d="M18 4v4M16 6h4" />
        }
        @case ('fiesta') {
          <path d="M8 21 4 7l14 6-10 8Z" /><path d="M14 4c1 .5 1.5 1.5 1 2.5M18 7c.8-.5 2-.3 2.5.5M19 3l.3 1M21 11l-1 .3" />
        }
        @case ('bebida') {
          <path d="M8 3h8l-1 7a3 3 0 0 1-6 0L8 3Z" /><path d="M12 13v6M9 21h6M8.6 6.5h6.8" />
        }
        @case ('comida') {
          <path d="M4 12h16a8 8 0 0 1-16 0Z" /><path d="M9 4c-.8 1 .8 2 0 3M12 3c-.8 1 .8 2 0 3M15 4c-.8 1 .8 2 0 3M3 20h18" />
        }
        @case ('auto') {
          <path d="M5 16V12l2-5h10l2 5v4M3 16h18v2H3z" /><circle cx="7.5" cy="18.5" r="1.5" /><circle cx="16.5" cy="18.5" r="1.5" /><path d="M5.5 12h13" />
        }
        @case ('moto') {
          <circle cx="5.5" cy="17" r="3" /><circle cx="18.5" cy="17" r="3" /><path d="M5.5 17h5l3-6h3l2 6M13.5 11 12 7h3M9 11h4" />
        }
        @case ('tianguis') {
          <path d="M3 9h18l-1.5-4h-15L3 9Z" /><path d="M5 9v11h14V9M3 9c0 1.4 1 2.2 2.2 2.2S7.5 10.4 7.5 9c0 1.4 1 2.2 2.2 2.2S12 10.4 12 9c0 1.4 1 2.2 2.2 2.2s2.3-.8 2.3-2.2c0 1.4 1 2.2 2.2 2.2S21 10.4 21 9" /><path d="M10 20v-4.5h4V20" />
        }
        @case ('celular') {
          <rect x="7" y="3" width="10" height="18" rx="2" /><path d="M11 18h2" />
        }
        @case ('mueble') {
          <path d="M5 11V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3" /><path d="M3 11h18v6H3zM5 17v3M19 17v3" />
        }
        @case ('herramienta') {
          <path d="M14.5 5.5a4 4 0 0 0-5 5L4 16l4 4 5.5-5.5a4 4 0 0 0 5-5l-2.5 2.5-2.5-.5-.5-2.5 2.5-2.5Z" />
        }
        @case ('ropa') {
          <path d="M9 4 4 7l2 4 2-1v10h8V10l2 1 2-4-5-3a3 3 0 0 1-6 0Z" />
        }
        @case ('oficio') {
          <path d="M3 11 12 4l9 7M5 9.5V20h14V9.5" /><path d="M14.5 13.5a2 2 0 0 0-2.6 2.6L9 19l1 1 2.9-2.9a2 2 0 0 0 2.6-2.6l-1.2 1.2-1-.2-.2-1 1.2-1.2Z" />
        }
        @case ('clases') {
          <path d="M3 5.5C5.5 4.5 9 4.5 12 6.5c3-2 6.5-2 9-1V19c-2.5-1-6-1-9 1-3-2-6.5-2-9-1V5.5Z" /><path d="M12 6.5V20" />
        }
        @case ('flete') {
          <path d="M2 6h11v10H2zM13 9h4.5l3.5 3.5V16h-8" /><circle cx="6" cy="17.5" r="1.8" /><circle cx="17" cy="17.5" r="1.8" />
        }
        @case ('caja') {
          <path d="M3 8 12 4l9 4-9 4-9-4Z" /><path d="M3 8v8l9 4 9-4V8M12 12v8" />
        }
        @default {
          <path d="M3 10 5 4h14l2 6M4 10v10h16V10M3 10h18M9 20v-5h6v5" />
        }
      }
    </svg>
  `,
  styles: `:host { display: inline-grid; place-items: center; line-height: 0; } svg { width: 1.25em; height: 1.25em; }`,
})
export class IconoGiro {
  readonly icono = input<string | null | undefined>(null);
}
