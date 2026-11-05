import { Component, computed, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { precioConUnidad } from '../catalogo/contacto';
import { ProductoAdmin } from './admin.model';
import { AdminApi } from './admin.api';
import { mensajeDeError } from './autorizacion';
import { NegocioTabs } from './negocio-tabs';
import { textosCatalogo } from './textos';

/** Normaliza para buscar sin importar acentos ni mayúsculas. */
export function paraBuscar(texto: string): string {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
}

@Component({
  selector: 'app-productos-page',
  imports: [RouterLink, NegocioTabs],
  template: `
    <app-negocio-tabs [slug]="slug()" [negocio]="negocio.value()" />

    <div class="barra-lista">
      <input type="search" [placeholder]="'Buscar ' + textos().singular" [value]="busqueda()"
             (input)="busqueda.set($any($event.target).value)" aria-label="Buscar" />
      <a class="btn primario" [routerLink]="['/admin/negocios', slug(), 'productos', 'nuevo']">+ Agregar {{ textos().singular }}</a>
    </div>

    @if (categorias().length > 1) {
      <div class="chips" role="group" aria-label="Filtrar por categoría">
        <button type="button" [class.activo]="categoria() === null" (click)="categoria.set(null)">Todas</button>
        @for (c of categorias(); track c.id) {
          <button type="button" [class.activo]="categoria() === c.id" (click)="categoria.set(c.id)">{{ c.nombre }}</button>
        }
      </div>
    }

    @if (error(); as e) {
      <p class="error" role="alert">{{ e }}</p>
    }
    @if (productos.error(); as e) {
      <p class="error" role="alert">{{ mensaje(e) }}</p>
    } @else if (productos.isLoading() && !productos.hasValue()) {
      <p class="ayuda" role="status">Cargando…</p>
    } @else {
      <p class="ayuda">{{ visibles() }} de {{ (productos.value() ?? []).length }} a la vista en el sitio.</p>
    }

    <ul class="lista">
      @for (p of filtrados(); track p.id) {
        <li class="fila-producto" [class.inactivo]="!p.disponible">
          <img [src]="p.imagenUrl" alt="" width="56" height="56" loading="lazy" />
          <a class="fila-producto-datos" [routerLink]="['/admin/negocios', slug(), 'productos', p.id]">
            <strong>
              {{ p.nombre }}
              @if (p.destacado) { <span class="estrella" title="Destacado en la portada">★</span> }
            </strong>
            <span>{{ precio(p) }}</span>
            <span class="ayuda">{{ p.categoriaNombre }}</span>
          </a>
          <label class="interruptor" [title]="p.disponible ? 'Se ve en el sitio' : 'Oculto'">
            <input type="checkbox" role="switch" [checked]="p.disponible" [disabled]="cambiando() === p.id"
                   (change)="alternar(p, $any($event.target).checked)" />
            <span>{{ p.disponible ? 'A la vista' : 'Oculto' }}</span>
          </label>
        </li>
      } @empty {
        @if (productos.hasValue()) {
          <li class="ayuda">No hay {{ textos().plural.toLowerCase() }} que coincidan.</li>
        }
      }
    </ul>
  `,
})
export class ProductosPage {
  readonly slug = input.required<string>();
  private readonly api = inject(AdminApi);
  protected readonly mensaje = mensajeDeError;
  protected readonly precio = precioConUnidad;

  protected readonly negocio = rxResource({ params: () => this.slug(), stream: ({ params }) => this.api.negocio(params) });
  protected readonly productos = rxResource({ params: () => this.slug(), stream: ({ params }) => this.api.productos(params) });
  protected readonly textos = computed(() => textosCatalogo(this.negocio.value()?.tipo));

  protected readonly busqueda = signal('');
  protected readonly categoria = signal<number | null>(null);
  protected readonly cambiando = signal<number | null>(null);
  protected readonly error = signal<string | null>(null);

  /** Categorías que tienen productos, en el orden en que llegan. */
  protected readonly categorias = computed(() => {
    const vistas = new Map<number, { id: number; nombre: string }>();
    for (const p of this.productos.value() ?? []) vistas.set(p.categoriaId, { id: p.categoriaId, nombre: p.categoriaNombre });
    return [...vistas.values()];
  });
  protected readonly filtrados = computed(() => {
    const q = paraBuscar(this.busqueda());
    const cat = this.categoria();
    return (this.productos.value() ?? []).filter(
      (p) => (cat === null || p.categoriaId === cat) && (!q || paraBuscar(p.nombre).includes(q)),
    );
  });
  protected readonly visibles = computed(() => (this.productos.value() ?? []).filter((p) => p.disponible).length);

  protected alternar(p: ProductoAdmin, disponible: boolean): void {
    this.error.set(null);
    this.cambiando.set(p.id);
    this.api.cambiarDisponible(this.slug(), p.id, disponible).subscribe({
      next: (nuevo) => {
        this.productos.update((lista) => lista?.map((x) => (x.id === nuevo.id ? nuevo : x)));
        this.cambiando.set(null);
      },
      error: (e) => {
        this.error.set(mensajeDeError(e));
        this.cambiando.set(null);
        this.productos.reload();
      },
    });
  }
}
