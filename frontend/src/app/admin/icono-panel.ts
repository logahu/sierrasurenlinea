import { Component, input } from '@angular/core';

/** Iconos de trazo del menú del panel (sin dependencias). */
@Component({
  selector: 'app-icono-panel',
  template: `
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8"
         stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      @switch (nombre()) {
        @case ('casa') { <path d="M3 11 12 4l9 7v9H3z" /><path d="M9 20v-6h6v6" /> }
        @case ('pedidos') { <path d="M5 4h14v16H5z" /><path d="M9 9h6M9 13h6M9 17h3" /> }
        @case ('agenda') { <rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /> }
        @case ('tianguis') { <path d="M3 9h18l-2-5H5z" /><path d="M5 9v11h14V9M10 20v-5h4v5" /> }
        @case ('negocio') { <path d="M3 10 5 4h14l2 6M4 10v10h16V10M3 10h18" /><path d="M9 20v-5h6v5" /> }
        @case ('portada') { <rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M8 13h8M8 16h5" /> }
        @case ('colonias') { <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /> }
        @case ('personas') { <circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.6-3.5 3.3-5.5 6.5-5.5s5.9 2 6.5 5.5" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c2 .7 3.2 2.5 3.5 5.2" /> }
        @case ('tablero') { <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /> }
        @case ('historial') { <circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3 2" /> }
        @case ('mas') { <path d="M4 7h16M4 12h16M4 17h16" /> }
        @default { <circle cx="12" cy="12" r="8" /> }
      }
    </svg>
  `,
  styles: `:host { display: inline-grid; place-items: center; line-height: 0; flex: none; }`,
})
export class IconoPanel {
  readonly nombre = input<string>('');
}
