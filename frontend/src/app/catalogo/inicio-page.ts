import { Component, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { CatalogoService } from './catalogo.service';
import { precioConUnidad } from './contacto';

/**
 * Portada de Sierra Sur en Línea: "la calle de los rótulos".
 * Cada negocio es una fachada pintada con su color y su rótulo.
 */
@Component({
  selector: 'app-inicio-page',
  imports: [RouterLink],
  templateUrl: './inicio-page.html',
  styleUrl: './inicio-page.scss',
})
export class InicioPage {
  private readonly api = inject(CatalogoService);

  readonly negocios = rxResource({ stream: () => this.api.negocios() });
  readonly destacados = rxResource({ stream: () => this.api.destacados() });

  /** Color de cada negocio, para pintar la etiqueta de los productos destacados. */
  colorDe(slug: string): string | null {
    return this.negocios.value()?.find((n) => n.slug === slug)?.colorPrimario ?? null;
  }

  protected readonly precio = precioConUnidad;
}
