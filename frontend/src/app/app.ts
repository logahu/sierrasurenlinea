import { Component, DestroyRef, inject, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SwUpdate } from '@angular/service-worker';
import { filter, map, of, switchMap, tap } from 'rxjs';
import { CatalogoService } from './catalogo/catalogo.service';
import { ClienteSesionService } from './cuenta/cliente-sesion';
import { InstalarApp } from './instalar';
import { UltimoPedido } from './cuenta/ultimo-pedido';
import { VisitasService, esRutaDelPanel, folio, rutaDeUrl } from './visitas';

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
  /** Visitas de la página actual, camufladas como folio en el pie (p. ej. SSL-000184). */
  protected readonly folio = signal<string | null>(null);
  /** En /admin se oculta el menú de negocios: el panel tiene su propia barra. */
  protected readonly enPanel = signal(false);
  protected readonly instalar = inject(InstalarApp);
  protected readonly cliente = inject(ClienteSesionService);
  protected readonly ultimoPedido = inject(UltimoPedido);
  /** En Mi cuenta ya se ven los pedidos: ahí no hace falta el aviso. */
  protected readonly enCuenta = signal(false);

  constructor() {
    const visitas = inject(VisitasService);
    inject(Router)
      .events.pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        map((e) => rutaDeUrl(e.urlAfterRedirects)),
        tap((ruta) => {
          this.folio.set(null);
          this.enPanel.set(esRutaDelPanel(ruta));
          // En Mi cuenta y en la confirmación del pedido ya se ve el seguimiento.
          this.enCuenta.set(ruta === '/cuenta' || ruta.endsWith('/pedido'));
        }),
        // El panel no cuenta como visita.
        switchMap((ruta) => (esRutaDelPanel(ruta) ? of(null) : visitas.registrar(ruta))),
        takeUntilDestroyed(),
      )
      .subscribe((total) => this.folio.set(total === null ? null : folio(total)));

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
