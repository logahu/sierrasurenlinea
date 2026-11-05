import { Component, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Observable, finalize } from 'rxjs';
import { CategoriaAdmin } from './admin.model';
import { AdminApi } from './admin.api';
import { mensajeDeError } from './autorizacion';
import { NegocioTabs } from './negocio-tabs';

/** Categorías del negocio: renombrar, describir, ordenar y agregar. */
@Component({
  selector: 'app-categorias-page',
  imports: [NegocioTabs],
  template: `
    <app-negocio-tabs [slug]="slug()" [negocio]="negocio.value()" seccion="categorias" />

    <p class="ayuda">Aparecen como filtros en la página del negocio, de menor a mayor número de orden.</p>
    @if (aviso(); as a) { <p class="exito" role="status">{{ a }}</p> }
    @if (error(); as e) { <p class="error" role="alert">{{ e }}</p> }
    @if (categorias.error(); as e) { <p class="error" role="alert">{{ mensaje(e) }}</p> }

    <ul class="lista">
      @for (c of categorias.value() ?? []; track c.id) {
        <li class="fila-categoria">
          <form (submit)="$event.preventDefault(); guardar(c, nombre.value, descripcion.value, orden.value)">
            <div class="dos-columnas angosta">
              <label>
                Nombre
                <input #nombre [value]="c.nombre" maxlength="80" />
              </label>
              <label>
                Orden
                <input #orden type="number" min="0" max="999" [value]="c.orden" />
              </label>
            </div>
            <label>
              <span>Descripción <span class="opcional">(opcional)</span></span>
              <input #descripcion [value]="c.descripcion ?? ''" maxlength="255" />
            </label>
            <div class="acciones">
              <button class="btn secundario" type="submit" [disabled]="ocupado()">Guardar</button>
              <span class="ayuda">{{ c.productos }} {{ c.productos === 1 ? 'producto' : 'productos' }} · /{{ slug() }}?categoria={{ c.slug }}</span>
            </div>
          </form>
        </li>
      }
    </ul>

    <form class="ficha" (submit)="$event.preventDefault(); crear(nuevaNombre, nuevaDescripcion)">
      <fieldset>
        <legend>Agregar categoría</legend>
        <label>
          Nombre
          <input #nuevaNombre maxlength="80" />
        </label>
        <label>
          <span>Descripción <span class="opcional">(opcional)</span></span>
          <input #nuevaDescripcion maxlength="255" />
        </label>
        <button class="btn primario grande" type="submit" [disabled]="ocupado()">Agregar categoría</button>
      </fieldset>
    </form>
  `,
})
export class CategoriasPage {
  readonly slug = input.required<string>();
  private readonly api = inject(AdminApi);
  protected readonly mensaje = mensajeDeError;

  protected readonly negocio = rxResource({ params: () => this.slug(), stream: ({ params }) => this.api.negocio(params) });
  protected readonly categorias = rxResource({ params: () => this.slug(), stream: ({ params }) => this.api.categorias(params) });
  protected readonly ocupado = signal(false);
  protected readonly aviso = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  protected guardar(c: CategoriaAdmin, nombre: string, descripcion: string, orden: string): void {
    if (!nombre.trim()) return this.falla('El nombre es obligatorio.');
    const n = orden === '' ? null : Number(orden);
    this.ejecutar(this.api.editarCategoria(this.slug(), c.id, { nombre, descripcion, orden: n }), (r) => `Guardada: ${r.nombre}.`);
  }

  protected crear(nombre: HTMLInputElement, descripcion: HTMLInputElement): void {
    if (!nombre.value.trim()) return this.falla('Escribe el nombre de la categoría.');
    const datos = { nombre: nombre.value, descripcion: descripcion.value };
    this.ejecutar(this.api.crearCategoria(this.slug(), datos), (r) => {
      nombre.value = '';
      descripcion.value = '';
      return `Agregada: ${r.nombre}.`;
    });
  }

  private ejecutar(op: Observable<CategoriaAdmin>, exito: (r: CategoriaAdmin) => string): void {
    this.aviso.set(null);
    this.error.set(null);
    this.ocupado.set(true);
    op.pipe(finalize(() => this.ocupado.set(false))).subscribe({
      next: (r) => {
        this.aviso.set(exito(r));
        this.categorias.reload();
      },
      error: (e) => this.error.set(mensajeDeError(e)),
    });
  }

  private falla(texto: string): void {
    this.aviso.set(null);
    this.error.set(texto);
  }
}
