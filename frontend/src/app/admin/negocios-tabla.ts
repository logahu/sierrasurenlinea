import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NegocioAdmin } from './admin.model';
import { avanceDe } from './configuracion';

/** Tabla de negocios: visibilidad, app, cuánto les falta y «Administrar». */
@Component({
  selector: 'app-negocios-tabla',
  imports: [RouterLink],
  template: `
    <div class="tabla-negocios" role="table" aria-label="Negocios">
      <div class="fila-negocio encabezado" role="row">
        <span role="columnheader">Negocio</span>
        <span role="columnheader">En el sitio</span>
        <span role="columnheader">App</span>
        <span role="columnheader">Configuración</span>
        <span role="columnheader"><span class="sr-only">Acción</span></span>
      </div>
      @for (n of negocios(); track n.id) {
        @let a = avance(n);
        <div class="fila-negocio" role="row">
          <span role="cell" class="tn-nombre">
            <span class="tn-punto" aria-hidden="true" [style.background]="n.colorPrimario"></span>
            <a [routerLink]="['/admin/negocios', n.slug]">{{ n.nombre }}</a>
          </span>
          <span role="cell"><span class="negocio-chip" [attr.data-estado]="n.estado">{{ estado(n.estado) }}</span></span>
          <span role="cell" class="tn-app">{{ n.estado === 'OCULTO' ? '—' : n.visibleApp ? 'Sí' : 'Solo web' }}</span>
          <span role="cell" class="tn-avance">
            <span class="tn-barra" aria-hidden="true"><span [style.width.%]="(a.listos / a.total) * 100" [class.completa]="a.listos === a.total"></span></span>
            {{ a.listos === a.total ? 'Completo' : a.total - a.listos === 1 ? 'Falta 1' : 'Faltan ' + (a.total - a.listos) }}
          </span>
          <span role="cell" class="tn-accion"><a [routerLink]="['/admin/negocios', n.slug]" [attr.aria-label]="'Administrar ' + n.nombre">Administrar →</a></span>
        </div>
      }
    </div>
  `,
})
export class NegociosTabla {
  readonly negocios = input.required<NegocioAdmin[]>();
  protected readonly avance = avanceDe;

  protected estado(e: NegocioAdmin['estado']): string {
    return e === 'PUBLICO' ? 'Público' : e === 'PRUEBAS' ? 'En pruebas' : 'Oculto';
  }
}
