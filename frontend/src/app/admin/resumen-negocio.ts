import { Component, computed, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { AdminApi } from './admin.api';
import { mensajeDeError } from './autorizacion';
import { PasoConfiguracion, pasosDe } from './configuracion';
import { NegocioTabs } from './negocio-tabs';
import { SesionService } from './sesion';
import { textosCatalogo } from './textos';

/** Resumen de un negocio: qué le falta para quedar completo (cada paso lleva a donde se resuelve) y atajos. */
@Component({
  selector: 'app-resumen-negocio',
  imports: [RouterLink, NegocioTabs],
  template: `
    <app-negocio-tabs [slug]="slug()" [negocio]="negocio.value()" seccion="resumen" />

    @if (negocio.error(); as e) {
      <p class="error" role="alert">{{ mensaje(e) }}</p>
    } @else if (negocio.value(); as n) {
      <section class="ficha resumen-pasos" aria-labelledby="titulo-pasos">
        <div class="resumen-cabeza">
          <h2 id="titulo-pasos" class="subtitulo">{{ listos() === pasos().length ? 'El negocio está completo' : 'Para que el negocio esté completo' }}</h2>
          <span class="ayuda">{{ listos() }} de {{ pasos().length }} listos</span>
        </div>
        <span class="tn-barra resumen-barra" aria-hidden="true"><span [style.width.%]="(listos() / pasos().length) * 100" [class.completa]="listos() === pasos().length"></span></span>
        <ul class="pasos">
          @for (p of pasos(); track p.clave) {
            <li [class.listo]="p.listo">
              <span class="paso-marca" aria-hidden="true">{{ p.listo ? '✓' : '' }}</span>
              <span class="paso-texto">@if (!p.listo) { <strong>Falta:</strong> } {{ p.texto }}<span class="sr-only">{{ p.listo ? ' (listo)' : '' }}</span></span>
              @if (puede(p)) {
                @if (p.clave === 'encargado') {
                  <a routerLink="/admin/usuarios" [queryParams]="{ negocio: n.slug }" [class.fuerte]="!p.listo">{{ p.accion }}</a>
                } @else {
                  <a [routerLink]="['/admin/negocios', n.slug].concat(p.seccion.split('/'))" [class.fuerte]="!p.listo">{{ p.accion }}{{ p.listo ? '' : ' →' }}</a>
                }
              } @else if (!p.listo) {
                <span class="ayuda">Lo hace el administrador</span>
              }
            </li>
          }
        </ul>
      </section>

      <section aria-label="Atajos" class="atajos">
        <a class="pendiente" [routerLink]="['/admin/negocios', n.slug, 'productos', 'nuevo']"><span>＋ Agregar {{ textos().singular }}</span></a>
        @if (n.modoPedido === 'CITA') {
          <a class="pendiente" routerLink="/admin/agenda"><span>Ver la agenda</span></a>
          <a class="pendiente" [routerLink]="['/admin/negocios', n.slug, 'equipo']" fragment="sin-servicio"><span>Días y horas sin servicio</span></a>
        } @else {
          <a class="pendiente" routerLink="/admin/pedidos"><span>Ver los pedidos</span></a>
          <a class="pendiente" [routerLink]="['/admin/negocios', n.slug, 'fotos']"><span>Subir fotos</span></a>
        }
      </section>
    } @else {
      <p class="ayuda" role="status">Cargando…</p>
    }
  `,
  styles: `
    .resumen-pasos { display: grid; gap: .75rem; }
    .resumen-cabeza { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: .5rem; }
    .resumen-cabeza .subtitulo { margin: 0; }
    .resumen-barra { display: block; height: .5rem; }
    .pasos { list-style: none; margin: 0; padding: 0; }
    .pasos li { display: flex; align-items: center; gap: .75rem; padding: .7rem 0; border-top: 1px solid var(--linea); }
    .pasos li:first-child { border-top: 0; }
    .paso-marca {
      flex: none; display: grid; place-items: center; width: 1.4rem; height: 1.4rem; border-radius: 50%;
      border: 2px solid #c27a00; box-sizing: border-box; font-size: .75rem; font-weight: 800;
    }
    .listo .paso-marca { background: var(--follaje); border-color: var(--follaje); color: #fff; }
    .paso-texto { flex: 1; min-width: 0; }
    .pasos a { color: var(--acento-texto); font-size: .92rem; white-space: nowrap; }
    .pasos a.fuerte { font-weight: 700; }
    .atajos { display: grid; grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr)); gap: .75rem; margin-top: 1rem; }
  `,
})
export class ResumenNegocio {
  readonly slug = input.required<string>();
  private readonly api = inject(AdminApi);
  protected readonly sesion = inject(SesionService);
  protected readonly mensaje = mensajeDeError;
  protected readonly negocio = rxResource({ params: () => this.slug(), stream: ({ params }) => this.api.negocio(params) });
  protected readonly pasos = computed(() => {
    const n = this.negocio.hasValue() ? this.negocio.value() : undefined;
    return n ? pasosDe(n) : [];
  });
  protected readonly listos = computed(() => this.pasos().filter((p) => p.listo).length);
  protected readonly textos = computed(() => textosCatalogo(this.negocio.value()?.tipo));

  protected puede(p: PasoConfiguracion): boolean {
    return !p.soloDueno || this.sesion.esDueno();
  }
}
