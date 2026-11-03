import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { CatalogoService } from './catalogo.service';

@Component({
  selector: 'app-catalogo-page',
  imports: [RouterLink, CurrencyPipe],
  templateUrl: './catalogo-page.html',
  styleUrl: './catalogo-page.scss',
})
export class CatalogoPage {
  private readonly api = inject(CatalogoService);

  /** Viene del query param ?categoria=... (withComponentInputBinding). */
  readonly categoria = input<string | undefined>();

  readonly categorias = rxResource({ stream: () => this.api.categorias() });

  readonly productos = rxResource({
    params: () => this.categoria() ?? null,
    stream: ({ params }) => this.api.productos(params),
  });

  readonly titulo = computed(() => {
    const slug = this.categoria();
    if (!slug) return 'Todo el catálogo';
    return this.categorias.value()?.find((c) => c.slug === slug)?.nombre ?? 'Catálogo';
  });

  reintentar(): void {
    this.categorias.reload();
    this.productos.reload();
  }
}
