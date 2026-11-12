import { Component, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';
import { NegocioAdmin } from './admin.model';
import { AdminApi } from './admin.api';
import { mensajeDeError } from './autorizacion';

/** Qué negocios se ven en el sitio: público, en pruebas (solo probadores) u oculto. Solo el administrador. */
@Component({
  selector: 'app-visibilidad-page',
  template: `
    <header class="panel-titulo">
      <h1>Negocios en el sitio</h1>
      <p class="ayuda">
        <strong>Público:</strong> lo ven todos los clientes. <strong>En pruebas:</strong> solo lo ven los clientes
        marcados como probadores (Usuarios → Clientes), para revisarlo antes de abrirlo; sus pedidos llegan como
        🧪 PRUEBA y no cuentan en el tablero. <strong>Oculto:</strong> no lo ve nadie en el sitio.
        <strong>App:</strong> solo lo quita dentro de la app de Google Play. No se borra nada.
      </p>
    </header>

    @if (error(); as e) { <p class="error" role="alert">{{ e }}</p> }
    @if (negocios.error(); as e) {
      <p class="error" role="alert">{{ mensaje(e) }}</p>
    } @else if (negocios.isLoading() && !negocios.hasValue()) {
      <p class="ayuda" role="status">Cargando negocios…</p>
    } @else {
      <p class="ayuda">
        {{ cuenta('PUBLICO') }} públicos · {{ cuenta('PRUEBAS') }} en pruebas · {{ cuenta('OCULTO') }} ocultos.
      </p>
    }

    <ul class="lista">
      @for (n of negocios.value() ?? []; track n.id) {
        <li class="fila-visible" [class.inactivo]="n.estado === 'OCULTO'" [style.--acento]="n.colorPrimario">
          <span class="punto" aria-hidden="true"></span>
          <div>
            <strong>{{ n.nombre }}</strong>
            <span class="ayuda">
              <a [href]="'/' + n.slug" target="_blank" rel="noopener">/{{ n.slug }}</a>
              · {{ n.productosActivos }} {{ n.productosActivos === 1 ? 'producto' : 'productos' }} a la vista
            </span>
          </div>
          <div class="interruptores">
            <div class="estados" role="radiogroup" [attr.aria-label]="'Visibilidad de ' + n.nombre">
              @for (e of estados; track e.valor) {
                <button type="button" role="radio" [attr.aria-checked]="n.estado === e.valor"
                        [class.elegido]="n.estado === e.valor" [attr.data-estado]="e.valor"
                        [disabled]="cambiando() === n.slug" (click)="cambiar(n, e.valor)">{{ e.texto }}</button>
              }
            </div>
            <label class="interruptor">
              <input type="checkbox" role="switch" [checked]="n.visibleApp && n.estado !== 'OCULTO'"
                     [disabled]="cambiando() === n.slug || n.estado === 'OCULTO'"
                     (change)="alternarApp(n, $any($event.target).checked)"
                     [attr.aria-label]="'Mostrar ' + n.nombre + ' en la app'" />
              <span>App</span>
            </label>
          </div>
        </li>
      }
    </ul>
  `,
})
export class VisibilidadPage {
  private readonly api = inject(AdminApi);
  protected readonly mensaje = mensajeDeError;
  protected readonly negocios = rxResource({ stream: () => this.api.negocios() });
  protected readonly estados = [
    { valor: 'PUBLICO' as const, texto: 'Público' },
    { valor: 'PRUEBAS' as const, texto: '🧪 En pruebas' },
    { valor: 'OCULTO' as const, texto: 'Oculto' },
  ];

  protected cuenta(estado: NegocioAdmin['estado']): number {
    return (this.negocios.value() ?? []).filter((n) => n.estado === estado).length;
  }
  protected readonly cambiando = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  protected cambiar(n: NegocioAdmin, estado: NegocioAdmin['estado']): void {
    if (n.estado !== estado) this.guardar(n, this.api.cambiarEstado(n.slug, estado));
  }

  protected alternarApp(n: NegocioAdmin, visible: boolean): void {
    this.guardar(n, this.api.cambiarVisibleApp(n.slug, visible));
  }

  private guardar(n: NegocioAdmin, op: Observable<NegocioAdmin>): void {
    this.error.set(null);
    this.cambiando.set(n.slug);
    op.subscribe({
      next: (nuevo) => {
        this.negocios.update((lista) => lista?.map((x) => (x.slug === nuevo.slug ? nuevo : x)));
        this.cambiando.set(null);
      },
      error: (e) => {
        this.error.set(mensajeDeError(e));
        this.cambiando.set(null);
        this.negocios.reload();
      },
    });
  }
}
