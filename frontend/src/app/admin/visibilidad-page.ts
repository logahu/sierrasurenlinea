import { Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';
import { NegocioAdmin } from './admin.model';
import { AdminApi } from './admin.api';
import { mensajeDeError } from './autorizacion';

/** Qué negocios se ven en el sitio: un interruptor por negocio. Solo el dueño. */
@Component({
  selector: 'app-visibilidad-page',
  template: `
    <header class="panel-titulo">
      <h1>Negocios en el sitio</h1>
      <p class="ayuda">
        <strong>Web:</strong> un negocio oculto no aparece en la portada ni en el menú, y su página no abre.
        <strong>App:</strong> solo lo quita dentro de la app de Google Play (por ejemplo, la vinatería, para que
        la app sea para todo público). No se borra nada.
      </p>
    </header>

    @if (error(); as e) { <p class="error" role="alert">{{ e }}</p> }
    @if (negocios.error(); as e) {
      <p class="error" role="alert">{{ mensaje(e) }}</p>
    } @else if (negocios.isLoading() && !negocios.hasValue()) {
      <p class="ayuda" role="status">Cargando negocios…</p>
    } @else {
      <p class="ayuda">{{ visibles() }} de {{ (negocios.value() ?? []).length }} negocios a la vista.</p>
    }

    <ul class="lista">
      @for (n of negocios.value() ?? []; track n.id) {
        <li class="fila-visible" [class.inactivo]="!n.visible" [style.--acento]="n.colorPrimario">
          <span class="punto" aria-hidden="true"></span>
          <div>
            <strong>{{ n.nombre }}</strong>
            <span class="ayuda">
              <a [href]="'/' + n.slug" target="_blank" rel="noopener">/{{ n.slug }}</a>
              · {{ n.productosActivos }} {{ n.productosActivos === 1 ? 'producto' : 'productos' }} a la vista
            </span>
          </div>
          <div class="interruptores">
            <label class="interruptor">
              <input type="checkbox" role="switch" [checked]="n.visible" [disabled]="cambiando() === n.slug"
                     (change)="alternar(n, $any($event.target).checked)"
                     [attr.aria-label]="'Mostrar ' + n.nombre + ' en la web'" />
              <span>Web</span>
            </label>
            <label class="interruptor">
              <input type="checkbox" role="switch" [checked]="n.visibleApp && n.visible"
                     [disabled]="cambiando() === n.slug || !n.visible"
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
  protected readonly visibles = computed(() => (this.negocios.value() ?? []).filter((n) => n.visible).length);
  protected readonly cambiando = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  protected alternar(n: NegocioAdmin, visible: boolean): void {
    this.guardar(n, this.api.cambiarVisible(n.slug, visible));
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
