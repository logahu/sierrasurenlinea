import { CurrencyPipe } from '@angular/common';
import { Component, inject, input, numberAttribute } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { CatalogoService } from './catalogo.service';

@Component({
  selector: 'app-producto-page',
  imports: [RouterLink, CurrencyPipe],
  templateUrl: './producto-page.html',
  styleUrl: './producto-page.scss',
})
export class ProductoPage {
  private readonly api = inject(CatalogoService);

  /** Viene del parámetro de ruta :id. */
  readonly id = input.required({ transform: numberAttribute });

  readonly producto = rxResource({
    params: () => this.id(),
    stream: ({ params }) => this.api.producto(params),
  });
}
