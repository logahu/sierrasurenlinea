import { Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
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
        Un negocio oculto no aparece en la portada ni en el menú, y su página no abre.
        No se borra nada: al volver a mostrarlo queda igual que antes.
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
          <label class="interruptor">
            <input type="checkbox" role="switch" [checked]="n.visible" [disabled]="cambiando() === n.slug"
                   (change)="alternar(n, $any($event.target).checked)"
                   [attr.aria-label]="'Mostrar ' + n.nombre + ' en el sitio'" />
            <span>{{ cambiando() === n.slug ? 'Guardando…' : n.visible ? 'Visible' : 'Oculto' }}</span>
          </label>
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
    this.error.set(null);
    this.cambiando.set(n.slug);
    this.api.cambiarVisible(n.slug, visible).subscribe({
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
