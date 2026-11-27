import { Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { AdminApi } from './admin.api';
import { mensajeDeError } from './autorizacion';
import { avanceDe } from './configuracion';
import { NegociosTabla } from './negocios-tabla';
import { PedidosService } from './pedidos';
import { SesionService } from './sesion';
import { TianguisAdminApi } from './tianguis/tianguis-admin.api';

/** Inicio del panel: lo que necesita atención hoy y el estado de cada negocio. */
@Component({
  selector: 'app-inicio-panel',
  imports: [RouterLink, NegociosTabla],
  template: `
    <header class="panel-titulo">
      <h1>Hola, {{ primerNombre() }}</h1>
      <p class="ayuda">Lo que necesita tu atención y el estado de {{ sesion.esDueno() ? 'cada negocio' : 'tu negocio' }}.</p>
    </header>

    <section class="pendientes" aria-labelledby="titulo-pendientes">
      <h2 id="titulo-pendientes" class="subtitulo">Pendientes</h2>
      <div class="pendientes-rejilla">
        <a class="pendiente" routerLink="/admin/pedidos" [class.hay]="pedidos.nuevos() > 0">
          <strong>{{ pedidos.nuevos() }}</strong>
          <span>{{ pedidos.nuevos() === 1 ? 'Pedido nuevo' : 'Pedidos nuevos' }}</span>
          <small>{{ pedidos.nuevos() ? 'Atender →' : 'Ver pedidos →' }}</small>
        </a>
        @if (sesion.veTianguis()) {
          <a class="pendiente" routerLink="/admin/tianguis" [class.hay]="tianguis.porAtender() > 0">
            <strong>{{ tianguis.porAtender() }}</strong>
            <span>Del tianguis por revisar</span>
            <small>Revisar →</small>
          </a>
        }
        @if (porCompletar(); as p) {
          <a class="pendiente hay" [routerLink]="['/admin/negocios', p.slug]">
            <strong>{{ p.cuantos }}</strong>
            <span>{{ p.cuantos === 1 ? 'Negocio por completar' : 'Negocios por completar' }}</span>
            <small>{{ p.cuantos === 1 ? 'Completar →' : 'Empezar por ' + p.nombre + ' →' }}</small>
          </a>
        }
      </div>
    </section>

    <section aria-labelledby="titulo-negocios">
      <h2 id="titulo-negocios" class="subtitulo">{{ sesion.esDueno() ? 'Tus negocios' : 'Tu negocio' }}</h2>
      @if (negocios.error(); as e) {
        <p class="error" role="alert">{{ mensaje(e) }}</p>
        <button class="btn secundario" type="button" (click)="negocios.reload()">Reintentar</button>
      } @else if (negocios.hasValue()) {
        <app-negocios-tabla [negocios]="negocios.value() ?? []" />
      } @else {
        <p class="ayuda" role="status">Cargando negocios…</p>
      }
    </section>
  `,
})
export class InicioPanel {
  protected readonly sesion = inject(SesionService);
  protected readonly pedidos = inject(PedidosService);
  protected readonly tianguis = inject(TianguisAdminApi);
  private readonly api = inject(AdminApi);
  protected readonly negocios = rxResource({ stream: () => this.api.negocios() });
  protected readonly mensaje = mensajeDeError;
  protected readonly primerNombre = computed(() => (this.sesion.usuario()?.nombre ?? '').trim().split(/\s+/)[0]);

  /** Negocios visibles (público o en pruebas) a los que les falta algo; el primero, para ir directo. */
  protected readonly porCompletar = computed(() => {
    const lista = (this.negocios.hasValue() ? (this.negocios.value() ?? []) : []).filter((n) => {
      const a = avanceDe(n);
      return n.estado !== 'OCULTO' && a.listos < a.total;
    });
    return lista.length ? { cuantos: lista.length, slug: lista[0].slug, nombre: lista[0].nombre } : null;
  });
}
