import { Component, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { AdminApi } from './admin.api';
import { mensajeDeError } from './autorizacion';
import { NegociosTabla } from './negocios-tabla';

/** Mis negocios (administrador): todos, con su visibilidad y lo que les falta. */
@Component({
  selector: 'app-negocios-page',
  imports: [NegociosTabla],
  template: `
    <header class="panel-titulo">
      <h1>Mis negocios</h1>
      <p class="ayuda">Entra a un negocio para cambiar su visibilidad, su catálogo y sus datos.</p>
      <p class="ayuda">
        <strong>Público:</strong> lo ven todos. <strong>En pruebas:</strong> solo los clientes probadores (sus pedidos
        llegan como 🧪 PRUEBA y no cuentan en el tablero). <strong>Oculto:</strong> no lo ve nadie. <strong>App:</strong>
        si sale dentro de la app de Google Play.
      </p>
    </header>
    @if (negocios.error(); as e) {
      <p class="error" role="alert">{{ mensaje(e) }}</p>
      <button class="btn secundario" type="button" (click)="negocios.reload()">Reintentar</button>
    } @else if (negocios.hasValue()) {
      <app-negocios-tabla [negocios]="negocios.value() ?? []" />
    } @else {
      <p class="ayuda" role="status">Cargando negocios…</p>
    }
  `,
})
export class NegociosPage {
  private readonly api = inject(AdminApi);
  protected readonly negocios = rxResource({ stream: () => this.api.negocios() });
  protected readonly mensaje = mensajeDeError;
}
