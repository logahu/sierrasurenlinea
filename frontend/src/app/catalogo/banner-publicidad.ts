import { NgTemplateOutlet } from '@angular/common';
import { Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { VisitasService } from '../visitas';
import { Anuncio, PosicionAnuncio } from './catalogo.model';
import { CatalogoService } from './catalogo.service';
import { PublicidadService, esEnlaceInterno, textoSobre } from './publicidad';

/** Cada cuánto cambia el anuncio cuando hay varios. */
const CAMBIO_MS = 6000;

/**
 * Banner de publicidad de la portada: carrusel simple con la etiqueta «Publicidad». La ×
 * lo oculta 7 días y deja «Mostrar publicidad». Sin anuncios vigentes no muestra nada.
 */
@Component({
  selector: 'app-banner-publicidad',
  imports: [RouterLink, NgTemplateOutlet],
  template: `
    @if (anuncios().length) {
      @if (publicidad.oculta()) {
        <p class="mostrar"><button type="button" (click)="publicidad.mostrar()">Mostrar publicidad</button></p>
      } @else {
        @let a = actual();
        <aside class="banner" aria-label="Publicidad" [style.--fondo]="a.colorFondo || null" [style.--sobre]="sobre()"
               (mouseenter)="pausado.set(true)" (mouseleave)="pausado.set(false)"
               (focusin)="pausado.set(true)" (focusout)="pausado.set(false)">
          <span class="etiqueta">Publicidad</span>
          @if (a.enlace) {
            @if (interno(a)) {
              <a class="contenido" [routerLink]="a.enlace" (click)="clic(a)">
                <ng-container *ngTemplateOutlet="cuerpo" />
              </a>
            } @else {
              <a class="contenido" [href]="a.enlace" target="_blank" rel="noopener sponsored" (click)="clic(a)">
                <ng-container *ngTemplateOutlet="cuerpo" />
              </a>
            }
          } @else {
            <div class="contenido"><ng-container *ngTemplateOutlet="cuerpo" /></div>
          }
          <ng-template #cuerpo>
            @if (a.imagenUrl) { <img [src]="a.imagenUrl" alt="" width="160" height="160" loading="lazy" /> }
            <span class="textos">
              <strong>{{ a.titulo }}</strong>
              @if (a.texto) { <span>{{ a.texto }}</span> }
            </span>
            @if (a.enlace) { <span class="ir" aria-hidden="true">›</span> }
          </ng-template>
          @if (anuncios().length > 1) {
            <div class="puntos" role="group" aria-label="Elegir anuncio">
              @for (x of anuncios(); track x.id; let i = $index) {
                <button type="button" [class.activo]="i === indice()" [attr.aria-current]="i === indice() ? 'true' : null"
                        [attr.aria-label]="'Anuncio ' + (i + 1) + ' de ' + anuncios().length" (click)="indice.set(i)"></button>
              }
            </div>
          }
          <button type="button" class="cerrar" aria-label="Ocultar publicidad por 7 días" title="Ocultar publicidad por 7 días"
                  (click)="publicidad.ocultar()">×</button>
        </aside>
      }
    }
  `,
  styleUrl: './banner-publicidad.scss',
})
export class BannerPublicidad {
  readonly posicion = input.required<PosicionAnuncio>();

  private readonly api = inject(CatalogoService);
  private readonly visitas = inject(VisitasService);
  protected readonly publicidad = inject(PublicidadService);

  private readonly carga = rxResource({
    params: () => this.posicion(),
    stream: ({ params }) => this.api.anuncios(params).pipe(catchError(() => of([] as Anuncio[]))),
  });
  protected readonly anuncios = computed(() => (this.carga.hasValue() ? (this.carga.value() ?? []) : []));
  protected readonly indice = signal(0);
  protected readonly pausado = signal(false);
  protected readonly actual = computed(() => this.anuncios()[this.indice() % Math.max(1, this.anuncios().length)]);
  protected readonly sobre = computed(() => textoSobre(this.actual()?.colorFondo));
  protected readonly interno = (a: Anuncio) => esEnlaceInterno(a.enlace);

  constructor() {
    // Carrusel: cambia cada 6 s, salvo con movimiento reducido o con el cursor o el foco encima.
    const quieto = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t = setInterval(() => {
      const n = this.anuncios().length;
      if (quieto || n < 2 || this.pausado() || this.publicidad.oculta()) return;
      this.indice.update((i) => (i + 1) % n);
    }, CAMBIO_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(t));
    // Si cambia la lista, se vuelve al primero.
    effect(() => {
      this.anuncios();
      this.indice.set(0);
    });
  }

  /** El clic se cuenta con el contador de visitas (ruta /anuncio/{id}). */
  protected clic(a: Anuncio): void {
    this.visitas.registrar(`/anuncio/${a.id}`).subscribe();
  }
}
