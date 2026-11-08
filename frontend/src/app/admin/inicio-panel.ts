import { Component, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { AdminApi } from './admin.api';
import { mensajeDeError } from './autorizacion';
import { SesionService } from './sesion';

@Component({
  selector: 'app-inicio-panel',
  imports: [RouterLink],
  template: `
    <header class="panel-titulo">
      <h1>Hola, {{ sesion.usuario()?.nombre }}</h1>
      <p class="ayuda">
        @if (sesion.esDueno()) {
          Elige un negocio para editar su catálogo y sus datos. En <a routerLink="/admin/visibilidad">En el sitio</a>
          muestras u ocultas negocios.
        } @else {
          Aquí editas el catálogo y los datos de tu negocio.
        }
      </p>
    </header>

    @if (negocios.error(); as e) {
      <p class="error" role="alert">{{ mensaje(e) }}</p>
      <button class="btn secundario" type="button" (click)="negocios.reload()">Reintentar</button>
    } @else if (negocios.isLoading() && !negocios.hasValue()) {
      <p class="ayuda" role="status">Cargando negocios…</p>
    }

    <ul class="tarjetas">
      @for (n of negocios.value() ?? []; track n.id) {
        <li class="tarjeta" [style.--acento]="n.colorPrimario">
          <a [routerLink]="['/admin/negocios', n.slug]" [attr.aria-label]="'Abrir ' + n.nombre">
            <span class="tarjeta-nombre">{{ n.nombre }}</span>
            @if (!n.visible) {
              <span class="etiqueta">Oculto</span>
            }
            <span class="tarjeta-dato">{{ n.productosActivos }} {{ n.productosActivos === 1 ? 'producto' : 'productos' }} a la vista</span>
            <span class="tarjeta-dato">
              @if (n.encargado) {
                Encargado: {{ n.encargado }}
              } @else {
                Sin encargado
              }
            </span>
            <span class="tarjeta-accion">{{ n.tipo === 'SERVICIO' ? 'Tarifas' : 'Productos' }} y datos →</span>
          </a>
        </li>
      }
    </ul>
  `,
})
export class InicioPanel {
  protected readonly sesion = inject(SesionService);
  private readonly api = inject(AdminApi);
  protected readonly negocios = rxResource({ stream: () => this.api.negocios() });
  protected readonly mensaje = mensajeDeError;
}
