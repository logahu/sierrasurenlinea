import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, effect, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { CatalogoService } from './catalogo.service';
import { ContactoNegocio } from './contacto-negocio';
import { precioConUnidad } from './contacto';

/** Catálogo de un negocio: /turamohoy, /inflables?categoria=brincolines, etc. */
@Component({
  selector: 'app-catalogo-page',
  imports: [RouterLink, ContactoNegocio],
  templateUrl: './catalogo-page.html',
  styleUrl: './catalogo-page.scss',
  host: { '[style.--acento]': 'negocio.value()?.colorPrimario' },
})
export class CatalogoPage {
  private readonly api = inject(CatalogoService);
  private readonly title = inject(Title);

  /** Parámetro de ruta :negocio (withComponentInputBinding). */
  readonly slug = input.required<string>({ alias: 'negocio' });
  /** Query param ?categoria=... */
  readonly categoria = input<string | undefined>();

  readonly negocio = rxResource({
    params: () => this.slug(),
    stream: ({ params }) => this.api.negocio(params),
  });

  readonly productos = rxResource({
    params: () => ({ negocio: this.slug(), categoria: this.categoria() ?? null }),
    stream: ({ params }) => this.api.productos(params.negocio, params.categoria),
  });

  readonly noExiste = computed(() => {
    const err = this.negocio.error();
    return err instanceof HttpErrorResponse && err.status === 404;
  });

  readonly titulo = computed(() => {
    const slug = this.categoria();
    if (!slug) return 'Todo el catálogo';
    return this.negocio.value()?.categorias.find((c) => c.slug === slug)?.nombre ?? 'Catálogo';
  });

  protected readonly precio = precioConUnidad;

  constructor() {
    effect(() => {
      const n = this.negocio.value();
      this.title.setTitle(n ? `${n.nombre} | Sierra Sur en Línea` : 'Sierra Sur en Línea');
    });
  }

  reintentar(): void {
    this.negocio.reload();
    this.productos.reload();
  }
}
