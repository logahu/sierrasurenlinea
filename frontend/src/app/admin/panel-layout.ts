import { Component, computed, effect, DestroyRef, ViewEncapsulation, inject, signal } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TianguisAdminApi } from './tianguis/tianguis-admin.api';
import { PedidosService } from './pedidos';
import { Avatar } from '../compartido/avatar';
import { SesionService } from './sesion';
import { IconoPanel } from './icono-panel';
import { Contador, menuDe, principales, secundarias } from './menu-panel';

/**
 * Marco del panel: barra con las secciones y "Salir". Sus estilos (encapsulation
 * None, todo dentro de .panel) los comparten todas las pantallas del panel.
 */
@Component({
  selector: 'app-panel-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Avatar, IconoPanel],
  encapsulation: ViewEncapsulation.None,
  styleUrl: './panel.scss',
  template: `
    <div class="panel-marco" [class.con-menu]="!!sesion.usuario()">
      @if (sesion.usuario(); as u) {
        <!-- Escritorio: menú lateral agrupado -->
        <nav class="panel-lateral" aria-label="Panel">
          @for (g of menu(); track g.titulo) {
            <div class="panel-grupo">
              <p class="panel-grupo-titulo">{{ g.titulo }}</p>
              @for (o of g.opciones; track o.ruta) {
                <a [routerLink]="o.ruta" routerLinkActive="activo" [routerLinkActiveOptions]="{ exact: !!o.exacta }"
                   ariaCurrentWhenActive="page">
                  <app-icono-panel [nombre]="o.icono" />
                  <span>{{ o.texto }}</span>
                  @if (cuenta(o.contador); as c) { <span class="marca-nuevos" [attr.aria-label]="c + ' por atender'">{{ c }}</span> }
                </a>
              }
            </div>
          }
          <div class="panel-yo">
            <a routerLink="/admin/cuenta" routerLinkActive="activo" ariaCurrentWhenActive="page" class="panel-perfil">
              <app-avatar [avatar]="u.avatar" [nombre]="u.nombre" />
              <span><strong>Mi perfil</strong><small>{{ u.nombre }}</small></span>
            </a>
            <button type="button" class="panel-salir" (click)="salir()">Salir</button>
          </div>
        </nav>

        <!-- Celular: barra de abajo con lo de todos los días y «Más» con el resto -->
        <nav class="panel-barra" aria-label="Panel">
          @for (o of barra(); track o.ruta) {
            <a [routerLink]="o.ruta" routerLinkActive="activo" [routerLinkActiveOptions]="{ exact: !!o.exacta }"
               ariaCurrentWhenActive="page" (click)="masAbierto.set(false)">
              <app-icono-panel [nombre]="o.icono" />
              <span>{{ o.texto }}</span>
              @if (cuenta(o.contador); as c) { <span class="marca-nuevos" [attr.aria-label]="c + ' por atender'">{{ c }}</span> }
            </a>
          }
          <button type="button" [class.activo]="masAbierto()" [attr.aria-expanded]="masAbierto()" aria-controls="panel-mas"
                  (click)="masAbierto.set(!masAbierto())">
            <app-icono-panel nombre="mas" />
            <span>Más</span>
            @if (cuentaMas(); as c) { <span class="marca-nuevos" [attr.aria-label]="c + ' por atender'">{{ c }}</span> }
          </button>
        </nav>
        @if (masAbierto()) {
          <div class="panel-mas-fondo" (click)="masAbierto.set(false)" aria-hidden="true"></div>
          <section id="panel-mas" class="panel-mas" aria-label="Más opciones">
            <div class="panel-yo">
              <a routerLink="/admin/cuenta" class="panel-perfil" (click)="masAbierto.set(false)">
                <app-avatar [avatar]="u.avatar" [nombre]="u.nombre" />
                <span><strong>{{ u.nombre }}</strong><small>Mi perfil</small></span>
              </a>
              <button type="button" class="panel-salir" (click)="salir()">Salir</button>
            </div>
            @for (g of mas(); track g.titulo) {
              <p class="panel-grupo-titulo">{{ g.titulo }}</p>
              <div class="panel-mas-rejilla">
                @for (o of g.opciones; track o.ruta) {
                  <a [routerLink]="o.ruta" routerLinkActive="activo" (click)="masAbierto.set(false)">
                    <app-icono-panel [nombre]="o.icono" />
                    <span>{{ o.texto }}</span>
                    @if (cuenta(o.contador); as c) { <span class="marca-nuevos">{{ c }}</span> }
                  </a>
                }
              </div>
            }
          </section>
        }
      }
      <div class="panel-contenido">
        <div class="panel">
          <router-outlet />
        </div>
      </div>
    </div>
  `,
})
export class PanelLayout {
  protected readonly sesion = inject(SesionService);
  protected readonly pedidos = inject(PedidosService);
  protected readonly tianguis = inject(TianguisAdminApi);
  private readonly router = inject(Router);

  /** Menú según quién entra (grupos: día a día, negocios, el sitio, personas y números). */
  protected readonly menu = computed(() => {
    const u = this.sesion.usuario();
    return u
      ? menuDe({ rol: u.rol, negocioSlug: u.negocioSlug, veAgenda: this.sesion.veAgenda(), veTianguis: this.sesion.veTianguis() })
      : [];
  });
  protected readonly barra = computed(() => principales(this.menu()));
  protected readonly mas = computed(() => secundarias(this.menu()));
  protected readonly masAbierto = signal(false);
  /** Pendientes que quedan escondidos en «Más» (para avisar en el botón). */
  protected readonly cuentaMas = computed(() =>
    this.mas().flatMap((g) => g.opciones).reduce((s, o) => s + this.cuenta(o.contador), 0),
  );

  protected cuenta(c: Contador | undefined): number {
    if (c === 'pedidos') return this.pedidos.nuevos();
    if (c === 'tianguis') return this.tianguis.porAtender();
    return 0;
  }

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
    this.masAbierto.set(false);
    this.sesion.salir();
    void this.router.navigate(['/admin/entrar']);
  }
}
