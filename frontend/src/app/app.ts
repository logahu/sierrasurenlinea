import { Component, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CatalogoService } from './catalogo/catalogo.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly api = inject(CatalogoService);

  /** Negocios para el menú del encabezado. */
  protected readonly negocios = rxResource({ stream: () => this.api.negocios() });
  protected readonly anio = new Date().getFullYear();
}
