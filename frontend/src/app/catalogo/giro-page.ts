import { Component, computed, effect, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { combineLatest } from 'rxjs';
import { CatalogoService } from './catalogo.service';
import { callesPorGiro } from './calles';
import { Fachada } from './fachada';
import { IconoGiro } from './icono-giro';

/** /giro/:slug — todas las fachadas de un giro, en cuadrícula («Ver todos» de cada calle). */
@Component({
  selector: 'app-giro-page',
  imports: [RouterLink, Fachada, IconoGiro],
  template: `
    <a class="volver" routerLink="/">‹ Todas las calles</a>
    @if (datos.error()) {
      <div class="estado" role="alert">
        <p>No pudimos cargar los negocios. Revisa tu conexión e inténtalo de nuevo.</p>
        <button type="button" (click)="datos.reload()">Reintentar</button>
      </div>
    } @else if (!datos.hasValue()) {
      <p class="estado" aria-busy="true">Cargando…</p>
    } @else if (calle(); as c) {
      <header class="cabeza">
        <app-icono-giro [icono]="c.giro.icono" />
        <div>
          <p class="sobre">Calle de</p>
          <h1>{{ c.giro.nombre }}</h1>
          <p class="cuantos">{{ c.negocios.length }} {{ c.negocios.length === 1 ? 'negocio' : 'negocios' }}</p>
        </div>
      </header>
      <ul class="cuadra" [attr.aria-label]="'Negocios de ' + c.giro.nombre">
        @for (n of c.negocios; track n.id; let i = $index) {
          <li><app-fachada [negocio]="n" [variante]="i" /></li>
        }
      </ul>
      <div class="banqueta" aria-hidden="true"></div>
    } @else {
      <div class="estado">
        <h1>No encontramos esa calle</h1>
        <p>Puede que ya no tenga negocios. <a routerLink="/">Ver todas las calles</a></p>
      </div>
    }
  `,
  styleUrl: './giro-page.scss',
})
export class GiroPage {
  readonly slug = input.required<string>();

  private readonly api = inject(CatalogoService);
  protected readonly datos = rxResource({
    stream: () => combineLatest({ giros: this.api.giros(), negocios: this.api.negocios() }),
  });
  protected readonly calle = computed(() => {
    const v = this.datos.hasValue() ? this.datos.value() : undefined;
    return v ? (callesPorGiro(v.giros, v.negocios).find((c) => c.giro.slug === this.slug()) ?? null) : null;
  });

  constructor() {
    const titulo = inject(Title);
    effect(() => {
      const c = this.calle();
      if (c) titulo.setTitle(`${c.giro.nombre} · Sierra Sur en Línea`);
    });
  }
}
