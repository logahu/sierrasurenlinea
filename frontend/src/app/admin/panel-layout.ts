import { Component, effect, DestroyRef, ViewEncapsulation, inject } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TianguisAdminApi } from './tianguis/tianguis-admin.api';
import { PedidosService } from './pedidos';
import { Avatar } from '../compartido/avatar';
import { SesionService } from './sesion';

/**
 * Marco del panel: barra con las secciones y "Salir". Sus estilos (encapsulation
 * None, todo dentro de .panel) los comparten todas las pantallas del panel.
 */
@Component({
  selector: 'app-panel-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Avatar],
  encapsulation: ViewEncapsulation.None,
  styleUrl: './panel.scss',
  template: `
    <div class="panel">
      @if (sesion.usuario(); as u) {
        <nav class="panel-nav" aria-label="Panel">
@if (sesion.esEmpleado()) {
            <a routerLink="/admin/agenda" routerLinkActive="activo">Mi agenda</a>
          } @else {
                    <a routerLink="/admin/pedidos" routerLinkActive="activo">
            Pedidos @if (pedidos.nuevos()) { <span class="marca-nuevos">{{ pedidos.nuevos() }}</span> }
          </a>
          }
          @if (sesion.veAgenda() && !sesion.esEmpleado()) {
            <a routerLink="/admin/agenda" routerLinkActive="activo">Agenda</a>
          }
          @if (!sesion.esRepartidor() && !sesion.esEmpleado()) {
            <a routerLink="/admin" routerLinkActive="activo" [routerLinkActiveOptions]="{ exact: true }">Negocios</a>
          }
          @if (!sesion.esRepartidor() && !sesion.esEmpleado()) {
            <a routerLink="/admin/tablero" routerLinkActive="activo">Tablero</a>
            <a routerLink="/admin/historial" routerLinkActive="activo">Historial</a>
          }
          @if (sesion.veTianguis()) {
            <a routerLink="/admin/tianguis" routerLinkActive="activo">
              Tianguis @if (tianguis.porAtender()) { <span class="marca-nuevos" [attr.aria-label]="tianguis.porAtender() + ' por atender'">{{ tianguis.porAtender() }}</span> }
            </a>
          }
          @if (sesion.esDueno()) {
            <a routerLink="/admin/visibilidad" routerLinkActive="activo">En el sitio</a>
            <a routerLink="/admin/colonias" routerLinkActive="activo">Colonias</a>
            <a routerLink="/admin/publicidad" routerLinkActive="activo">Publicidad</a>
            <a routerLink="/admin/usuarios" routerLinkActive="activo">Usuarios</a>
          }
          <a class="panel-perfil" routerLink="/admin/cuenta" routerLinkActive="activo" [attr.aria-label]="'Mi perfil (' + u.nombre + ')'">
            <app-avatar [avatar]="u.avatar" [nombre]="u.nombre" />
            <span>Mi perfil</span>
          </a>
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
  protected readonly tianguis = inject(TianguisAdminApi);
  private readonly router = inject(Router);

  constructor() {
    // Que los buscadores no indexen el panel (y quitarlo al volver al sitio).
    const meta = inject(Meta);
    meta.updateTag({ name: 'robots', content: 'noindex, nofollow' });
    // El panel se instala como su propia app ("Sierra Sur Pedidos"), separada de la de clientes.
    const manifiesto = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    manifiesto?.setAttribute('href', 'manifest-panel.webmanifest');
    // Contador del tianguis (pendientes + reportes): al entrar y cada 2 minutos.
    let reloj: ReturnType<typeof setInterval> | undefined;
    effect(() => {
      clearInterval(reloj);
      if (!this.sesion.veTianguis()) return;
      this.tianguis.actualizarResumen();
      reloj = setInterval(() => this.tianguis.actualizarResumen(), 120_000);
    });
    inject(DestroyRef).onDestroy(() => {
      clearInterval(reloj);
      meta.removeTag("name='robots'");
      manifiesto?.setAttribute('href', 'manifest.webmanifest');
    });
  }

  protected salir(): void {
    this.sesion.salir();
    void this.router.navigate(['/admin/entrar']);
  }
}
