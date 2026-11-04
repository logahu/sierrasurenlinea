import { Component, DestroyRef, inject } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SwUpdate } from '@angular/service-worker';
import { filter } from 'rxjs';
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

  constructor() {
    // La PWA guarda la app en caché. Cuando se publica una versión nueva, el service
    // worker la descarga en segundo plano; recargamos para no mostrar la versión vieja
    // (que podría no entenderse con el backend actualizado).
    const sw = inject(SwUpdate, { optional: true });
    if (sw?.isEnabled) {
      sw.versionUpdates
        .pipe(
          filter((e) => e.type === 'VERSION_READY'),
          takeUntilDestroyed(inject(DestroyRef)),
        )
        .subscribe(() => document.location.reload());
      void sw.checkForUpdate().catch(() => undefined);
    }
  }
}
