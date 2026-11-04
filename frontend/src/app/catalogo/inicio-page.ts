import { Component, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { CatalogoService } from './catalogo.service';

/** Portada de Sierra Sur en Línea: presenta todos los negocios. */
@Component({
  selector: 'app-inicio-page',
  imports: [RouterLink],
  templateUrl: './inicio-page.html',
  styleUrl: './inicio-page.scss',
})
export class InicioPage {
  private readonly api = inject(CatalogoService);

  readonly negocios = rxResource({ stream: () => this.api.negocios() });
}
