import { Component, DestroyRef, ViewEncapsulation, inject } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SesionService } from './sesion';

/**
 * Marco del panel: barra con las secciones y "Salir". Sus estilos (encapsulation
 * None, todo dentro de .panel) los comparten todas las pantallas del panel.
 */
@Component({
  selector: 'app-panel-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  encapsulation: ViewEncapsulation.None,
  styleUrl: './panel.scss',
  template: `
    <div class="panel">
      @if (sesion.usuario(); as u) {
        <nav class="panel-nav" aria-label="Panel">
          <a routerLink="/admin" routerLinkActive="activo" [routerLinkActiveOptions]="{ exact: true }">Negocios</a>
          @if (sesion.esDueno()) {
            <a routerLink="/admin/visibilidad" routerLinkActive="activo">En el sitio</a>
            <a routerLink="/admin/usuarios" routerLinkActive="activo">Encargados</a>
          }
          <a routerLink="/admin/cuenta" routerLinkActive="activo">Mi cuenta</a>
          <span class="panel-quien">{{ u.nombre }}</span>
          <button type="button" class="panel-salir" (click)="salir()">Salir</button>
        </nav>
      }
      <router-outlet />
    </div>
  `,
})
export class PanelLayout {
  protected readonly sesion = inject(SesionService);
  private readonly router = inject(Router);

  constructor() {
    // Que los buscadores no indexen el panel (y quitarlo al volver al sitio).
    const meta = inject(Meta);
    meta.updateTag({ name: 'robots', content: 'noindex, nofollow' });
    inject(DestroyRef).onDestroy(() => meta.removeTag("name='robots'"));
  }

  protected salir(): void {
    this.sesion.salir();
    void this.router.navigate(['/admin/entrar']);
  }
}
