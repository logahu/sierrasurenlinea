import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { DatosEstructurados } from './datos-estructurados';
import { RouterLink } from '@angular/router';
import { CatalogoService } from './catalogo.service';
import { soloEnWeb } from '../modo-app';
import { ContactoNegocio } from './contacto-negocio';
import { EncargoForm } from './encargo-form';
import { BarraCarrito } from './barra-carrito';
import { CarritoService, modoDe, textosDe } from './carrito';
import { Producto } from './catalogo.model';
import { precioConUnidad } from './contacto';
import { direccionCorta, horarioCorto } from './ubicacion-negocio';

/** Catálogo de un negocio: /turamohoy, /inflables?categoria=brincolines, etc. */
@Component({
  selector: 'app-catalogo-page',
  providers: [DatosEstructurados],
  imports: [RouterLink, ContactoNegocio, EncargoForm, BarraCarrito],
  templateUrl: './catalogo-page.html',
  styleUrl: './catalogo-page.scss',
  host: {
    '[style.--acento]': 'negocio.value()?.colorPrimario',
    // Cada negocio tiene su propio tema visual (src/temas/).
    '[attr.data-tema]': 'negocio.value()?.slug',
  },
})
export class CatalogoPage {
  protected readonly direccionCorta = direccionCorta;
  protected readonly horarioCorto = horarioCorto;

  /** «Ver ubicación ↓»: baja a «Datos del negocio» sin cambiar la dirección de la página. */
  protected irADatos(e: Event): void {
    e.preventDefault();
    document.getElementById('datos-negocio')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  private readonly api = inject(CatalogoService);
  private readonly title = inject(Title);
  private readonly datosEstructurados = inject(DatosEstructurados);

  /** Parámetro de ruta :negocio (withComponentInputBinding). */
  readonly slug = input.required<string>({ alias: 'negocio' });
  /** Query param ?categoria=... */
  readonly categoria = input<string | undefined>();

  readonly negocio = rxResource({
    params: () => this.slug(),
    stream: ({ params }) => this.api.negocio(params),
  });

  /** Dentro de la app, los negocios "solo web" muestran un aviso en lugar del catálogo. */
  protected readonly soloWeb = computed(() => soloEnWeb(this.negocio.value()));

  readonly productos = rxResource({
    params: () => ({ negocio: this.slug(), categoria: this.categoria() ?? null }),
    stream: ({ params }) => this.api.productos(params.negocio, params.categoria),
  });

  readonly noExiste = computed(() => {
    const err = this.negocio.error();
    return err instanceof HttpErrorResponse && err.status === 404;
  });

  readonly titulo = computed(() => {
    const slug = this.categoria();
    if (!slug) return 'Todo el catálogo';
    return this.negocio.value()?.categorias.find((c) => c.slug === slug)?.nombre ?? 'Catálogo';
  });

  protected readonly precio = precioConUnidad;

  // --- Carrito ---------------------------------------------------------------------
  private readonly carrito = inject(CarritoService);
  protected readonly modo = computed(() => modoDe(this.negocio.value()));
  protected readonly textos = computed(() => (this.modo() ? textosDe(this.negocio.value()) : null));
  /** Último producto agregado desde la tarjeta (muestra la palomita un momento). */
  protected readonly recien = signal<number | null>(null);
  private temporizador?: ReturnType<typeof setTimeout>;

  protected agregar(p: Producto): void {
    const m = this.modo();
    if (!m) return;
    this.carrito.agregar(p.negocioSlug, p, 1, m);
    this.recien.set(p.id);
    clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => this.recien.set(null), 1500);
  }

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.temporizador));
    effect(() => {
      const n = this.negocio.value();
      this.title.setTitle(n ? `${n.nombre} | Sierra Sur en Línea` : 'Sierra Sur en Línea');
    });
    effect(() => this.datosEstructurados.poner(this.negocio.hasValue() ? this.negocio.value() : null));
  }

  reintentar(): void {
    this.negocio.reload();
    this.productos.reload();
  }
}
