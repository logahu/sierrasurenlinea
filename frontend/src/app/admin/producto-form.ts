import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize, of } from 'rxjs';
import { precioConUnidad } from '../catalogo/contacto';
import { ProductoAdmin, ProductoEdicion } from './admin.model';
import { AdminApi } from './admin.api';
import { mensajeDeError } from './autorizacion';
import { FotoCampo } from './foto-campo';
import { NegocioTabs } from './negocio-tabs';
import { renglones, textosCatalogo } from './textos';

/** Alta (id = "nuevo") y edición de un producto o tarifa. */
@Component({
  selector: 'app-producto-form',
  imports: [ReactiveFormsModule, RouterLink, NegocioTabs, FotoCampo],
  template: `
    <app-negocio-tabs [slug]="slug()" [negocio]="negocio.value()" />

    <p class="migas"><a [routerLink]="['/admin/negocios', slug()]">← {{ textos().plural }}</a></p>
    <h2 class="subtitulo">{{ esNuevo() ? 'Agregar ' + textos().singular : 'Editar ' + textos().singular }}</h2>

    @if (producto.error(); as e) {
      <p class="error" role="alert">{{ mensaje(e) }}</p>
    } @else {
      <form class="ficha" [formGroup]="form" (ngSubmit)="guardar()" novalidate>
        <fieldset>
          <legend>Foto</legend>
          <app-foto-campo [slug]="slug()" [respaldo]="imagen()" [url]="foto()" (urlChange)="cambiarFoto($event)" />
        </fieldset>

        <fieldset>
          <legend>Lo que ve el cliente</legend>
          <label>
            Nombre
            <input formControlName="nombre" maxlength="120" />
          </label>
          <label>
            Categoría
            <select formControlName="categoriaId">
              <option [ngValue]="null" disabled>Elige…</option>
              @for (c of categorias.value() ?? []; track c.id) {
                <option [ngValue]="c.id">{{ c.nombre }}</option>
              }
            </select>
            <small><a [routerLink]="['/admin/negocios', slug(), 'categorias']">Agregar o renombrar categorías</a></small>
          </label>
          <div class="dos-columnas">
            <label>
              Precio (MXN)
              <input type="number" formControlName="precio" min="0" step="0.01" inputmode="decimal" />
            </label>
            <label>
              <span>Unidad <span class="opcional">(opcional)</span></span>
              <input formControlName="unidadPrecio" maxlength="30" list="unidades" />
              <datalist id="unidades">
                @for (u of textos().unidades; track u) { <option [value]="u"></option> }
              </datalist>
            </label>
          </div>
          <small>{{ textos().ayudaUnidad }}</small>
          <label>
            <span>Descripción <span class="opcional">(opcional)</span></span>
            <textarea formControlName="descripcion" rows="3" maxlength="1000"></textarea>
          </label>
          <label>
            <span>Características <span class="opcional">(opcional, una por renglón)</span></span>
            <textarea formControlName="caracteristicas" rows="3" placeholder="Medidas: 4 × 4 m&#10;Capacidad: 8 niños"></textarea>
          </label>
        </fieldset>

        <fieldset>
          <legend>Dónde aparece</legend>
          <label class="en-linea">
            <input type="checkbox" formControlName="disponible" />
            A la vista en el sitio
          </label>
          <label class="en-linea">
            <input type="checkbox" formControlName="destacado" />
            Destacado (sale primero y en "Lo más pedido" de la portada)
          </label>
        </fieldset>

        <div class="vista-previa" aria-label="Vista previa">
          <img [src]="imagen()" alt="" width="64" height="64" />
          <div>
            <strong>{{ form.controls.nombre.value || 'Nombre' }}</strong>
            <span>{{ precioVista() }}</span>
          </div>
        </div>
        @if (esNuevo() && !foto()) {
          <small>Si no subes foto, usa la imagen del negocio.</small>
        }

        @if (error()) {
          <p class="error" role="alert">{{ error() }}</p>
        }
        @if (guardado()) {
          <p class="exito" role="status">Guardado. El sitio ya muestra los cambios.</p>
        }
        <div class="acciones">
          <button class="btn primario grande" type="submit" [disabled]="guardando() || (!esNuevo() && form.pristine)">
            {{ guardando() ? 'Guardando…' : esNuevo() ? 'Agregar' : 'Guardar cambios' }}
          </button>
        </div>
      </form>
    }
  `,
})
export class ProductoForm {
  readonly slug = input.required<string>();
  /** "nuevo" o el id del producto. */
  readonly id = input.required<string>();

  private readonly api = inject(AdminApi);
  private readonly router = inject(Router);
  protected readonly mensaje = mensajeDeError;

  protected readonly esNuevo = computed(() => this.id() === 'nuevo');
  protected readonly negocio = rxResource({ params: () => this.slug(), stream: ({ params }) => this.api.negocio(params) });
  protected readonly categorias = rxResource({ params: () => this.slug(), stream: ({ params }) => this.api.categorias(params) });
  protected readonly producto = rxResource({
    params: () => ({ slug: this.slug(), id: this.id() }),
    stream: ({ params }) =>
      params.id === 'nuevo' ? of(undefined) : this.api.producto(params.slug, Number(params.id)),
  });
  protected readonly textos = computed(() => textosCatalogo(this.negocio.value()?.tipo));

  protected readonly form = inject(FormBuilder).group({
    nombre: ['', [Validators.required, Validators.maxLength(120)]],
    categoriaId: [null as number | null, Validators.required],
    precio: [null as number | null, [Validators.required, Validators.min(0)]],
    unidadPrecio: [''],
    descripcion: [''],
    caracteristicas: [''],
    disponible: [true],
    destacado: [false],
  });
  protected readonly guardando = signal(false);
  protected readonly guardado = signal(false);
  protected readonly error = signal<string | null>(null);
  private readonly valores = signal(this.form.getRawValue());

  /** Foto nueva subida en esta pantalla (todavía sin guardar). */
  protected readonly foto = signal<string | null>(null);
  protected readonly imagen = computed(
    () => this.foto() ?? this.producto.value()?.imagenUrl ?? this.negocio.value()?.portadaUrl ?? '',
  );
  protected readonly precioVista = computed(() => {
    const v = this.valores();
    return v.precio === null || v.precio === undefined || `${v.precio}` === ''
      ? '$—'
      : precioConUnidad({ precio: Number(v.precio), unidadPrecio: v.unidadPrecio?.trim() || null });
  });

  constructor() {
    this.form.valueChanges.subscribe(() => this.valores.set(this.form.getRawValue()));
    effect(() => {
      const p = this.producto.value();
      if (p) this.cargar(p);
    });
    // Producto nuevo: preselecciona la primera categoría.
    effect(() => {
      const cats = this.categorias.value();
      if (this.esNuevo() && cats?.length && this.form.controls.categoriaId.value === null) {
        this.form.controls.categoriaId.setValue(cats[0].id);
      }
    });
  }

  protected cambiarFoto(url: string | null): void {
    this.foto.set(url);
    this.form.markAsDirty();
    this.guardado.set(false);
  }

  private cargar(p: ProductoAdmin): void {
    this.foto.set(null);
    this.form.reset({
      nombre: p.nombre,
      categoriaId: p.categoriaId,
      precio: p.precio,
      unidadPrecio: p.unidadPrecio ?? '',
      descripcion: p.descripcion ?? '',
      caracteristicas: p.caracteristicas.join('\n'),
      disponible: p.disponible,
      destacado: p.destacado,
    });
  }

  protected guardar(): void {
    this.guardado.set(false);
    const v = this.form.getRawValue();
    if (!v.nombre?.trim()) return this.error.set('El nombre es obligatorio.');
    if (v.categoriaId === null) return this.error.set('Elige la categoría.');
    const precio = Number(v.precio);
    if (v.precio === null || `${v.precio}` === '' || !Number.isFinite(precio) || precio < 0) {
      return this.error.set('Escribe un precio válido (0 o más).');
    }
    this.error.set(null);
    const datos: ProductoEdicion = {
      nombre: v.nombre.trim(),
      categoriaId: v.categoriaId,
      precio: Math.round(precio * 100) / 100,
      unidadPrecio: v.unidadPrecio ?? '',
      descripcion: v.descripcion ?? '',
      caracteristicas: renglones(v.caracteristicas ?? ''),
      disponible: !!v.disponible,
      destacado: !!v.destacado,
      imagenUrl: this.foto(),
    };
    this.guardando.set(true);
    const op = this.esNuevo()
      ? this.api.crearProducto(this.slug(), datos)
      : this.api.editarProducto(this.slug(), Number(this.id()), datos);
    op.pipe(finalize(() => this.guardando.set(false))).subscribe({
      next: (p) => {
        if (this.esNuevo()) {
          void this.router.navigate(['/admin/negocios', this.slug()]);
        } else {
          this.producto.set(p);
          this.guardado.set(true);
        }
      },
      error: (e) => this.error.set(mensajeDeError(e)),
    });
  }
}
