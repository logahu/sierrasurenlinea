import { Component, computed, input } from '@angular/core';
import { dibujoDe, esFoto, fondoDeIniciales, inicialesDe } from './avatares';

/**
 * Avatar redondo de una persona: su foto, el dibujo que eligió o sus iniciales.
 * El tamaño lo da quien lo usa (ancho y alto del elemento; por omisión 2.5rem).
 */
@Component({
  selector: 'app-avatar',
  host: { '[attr.title]': 'titulo() ? nombre() : null' },
  template: `
    @if (foto()) {
      <img [src]="avatar()" alt="" loading="lazy" (error)="fallo = true" [hidden]="fallo" />
    }
    @if (!foto() || fallo) {
      @if (dibujo(); as d) {
        <span class="circulo" [style.background]="d.fondo">
          <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            @for (t of d.trazos; track $index) { <path [attr.d]="t" /> }
          </svg>
        </span>
      } @else {
        <span class="circulo iniciales" [style.background]="fondo()" aria-hidden="true">{{ iniciales() }}</span>
      }
    }
  `,
  styles: `
    :host { display: inline-block; flex: none; width: 2.5rem; height: 2.5rem; border-radius: 50%; overflow: hidden; vertical-align: middle; container-type: size; }
    img, .circulo { display: block; width: 100%; height: 100%; }
    img { object-fit: cover; }
    .circulo { display: grid; place-items: center; border-radius: 50%; }
    svg { width: 62%; height: 62%; }
    .iniciales { color: #fff; font-weight: 700; font-size: 38cqw; line-height: 1; letter-spacing: .02em; }
  `,
})
export class Avatar {
  readonly avatar = input<string | null | undefined>(null);
  readonly nombre = input<string | null | undefined>('');
  /** Muestra el nombre al pasar el cursor. */
  readonly titulo = input(false);

  protected fallo = false;
  protected readonly foto = computed(() => esFoto(this.avatar()));
  protected readonly dibujo = computed(() => dibujoDe(this.avatar()));
  protected readonly iniciales = computed(() => inicialesDe(this.nombre()));
  protected readonly fondo = computed(() => fondoDeIniciales(this.nombre()));
}
