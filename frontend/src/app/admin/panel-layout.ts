import { Component, DestroyRef, ViewEncapsulation, inject } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { PedidosService } from './pedidos';
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
          <a routerLink="/admin/pedidos" routerLinkActive="activo">
            Pedidos @if (pedidos.nuevos()) { <span class="marca-nuevos">{{ pedidos.nuevos() }}</span> }
          </a>
          @if (!sesion.esRepartidor()) {
            <a routerLink="/admin" routerLinkActive="activo" [routerLinkActiveOptions]="{ exact: true }">Negocios</a>
          }
          @if (!sesion.esRepartidor()) {
            <a routerLink="/admin/tablero" routerLinkActive="activo">Tablero</a>
            <a routerLink="/admin/historial" routerLinkActive="activo">Historial</a>
          }
          @if (sesion.esDueno()) {
            <a routerLink="/admin/visibilidad" routerLinkActive="activo">En el sitio</a>
            <a routerLink="/admin/colonias" routerLinkActive="activo">Colonias</a>
            <a routerLink="/admin/usuarios" routerLinkActive="activo">Usuarios</a>
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
  protected readonly pedidos = inject(PedidosService);
  private readonly router = inject(Router);

  constructor() {
    // Que los buscadores no indexen el panel (y quitarlo al volver al sitio).
    const meta = inject(Meta);
    meta.updateTag({ name: 'robots', content: 'noindex, nofollow' });
    // El panel se instala como su propia app ("Sierra Sur Pedidos"), separada de la de clientes.
    const manifiesto = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    manifiesto?.setAttribute('href', 'manifest-panel.webmanifest');
    inject(DestroyRef).onDestroy(() => {
      meta.removeTag("name='robots'");
      manifiesto?.setAttribute('href', 'manifest.webmanifest');
    });
  }

  protected salir(): void {
    this.sesion.salir();
    void this.router.navigate(['/admin/entrar']);
  }
}
