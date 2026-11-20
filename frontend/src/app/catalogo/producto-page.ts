import { Component, computed, effect, inject, input, numberAttribute, linkedSignal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';
import { BarraCarrito } from './barra-carrito';
import { CarritoService, modoDe, textosDe } from './carrito';
import { ModoPedido, Producto } from './catalogo.model';
import { CatalogoService } from './catalogo.service';
import { soloEnWeb } from '../modo-app';
import { ContactoNegocio } from './contacto-negocio';
import { enlaceTelefono, enlaceWhatsapp, mensajeProducto, precioConUnidad } from './contacto';
import { acentoLegible } from '../color';

/** Detalle de un producto: /turamohoy/producto/5 */
@Component({
  selector: 'app-producto-page',
  imports: [RouterLink, ContactoNegocio, BarraCarrito],
  templateUrl: './producto-page.html',
  styleUrl: './producto-page.scss',
  host: {
    '[style.--acento]': 'acento()',
    '[attr.data-tema]': 'negocio.value()?.slug',
  },
})
export class ProductoPage {
  /** Color del negocio, oscurecido si es muy claro para botones con texto blanco. */
  protected readonly acento = computed(() => acentoLegible(this.negocio.value()?.colorPrimario));

  private readonly api = inject(CatalogoService);
  private readonly title = inject(Title);

  /** Parámetros de ruta :negocio y :id. */
  readonly slug = input.required<string>({ alias: 'negocio' });
  readonly id = input.required({ transform: numberAttribute });

  readonly producto = rxResource({
    params: () => this.id(),
    stream: ({ params }) => this.api.producto(params),
  });

  /** El negocio sale del producto (no de la URL) para que el contacto siempre sea el correcto. */
  readonly negocio = rxResource({
    params: () => this.producto.value()?.negocioSlug ?? this.slug(),
    stream: ({ params }) => this.api.negocio(params),
  });

  /** Dentro de la app, los negocios "solo web" muestran un aviso en lugar del catálogo. */
  protected readonly soloWeb = computed(() => soloEnWeb(this.negocio.value()));

  readonly whatsapp = computed(() => {
    const p = this.producto.value();
    const n = this.negocio.value();
    return p && n && n.slug === p.negocioSlug ? enlaceWhatsapp(n.whatsapp, mensajeProducto(n, p)) : null;
  });

  readonly telefono = computed(() => {
    const tel = this.negocio.value()?.telefono;
    return tel ? enlaceTelefono(tel) : null;
  });

  protected readonly precio = precioConUnidad;

  // --- Carrito ---------------------------------------------------------------------
  private readonly carrito = inject(CarritoService);
  private readonly router = inject(Router);
  /** Cómo se pide en este negocio (null en servicios o si aún no carga). */
  protected readonly modo = computed(() => {
    const p = this.producto.value();
    const n = this.negocio.value();
    return p && n && n.slug === p.negocioSlug ? modoDe(n) : null;
  });
  protected readonly textos = computed(() => (this.modo() ? textosDe(this.negocio.value()) : null));
  protected readonly cantidad = linkedSignal({ source: this.id, computation: () => 1 });
  protected readonly agregado = linkedSignal({ source: this.id, computation: () => false });

  protected agregar(p: Producto, modo: ModoPedido): void {
    this.carrito.agregar(p.negocioSlug, p, Math.max(1, Math.min(99, this.cantidad())), modo);
    if (modo === 'CITA') {
      void this.router.navigate(['/', p.negocioSlug, 'pedido']);
      return;
    }
    this.agregado.set(true);
    this.cantidad.set(1);
  }

  /** Foto principal y galería; la elegida se muestra en grande. */
  protected readonly fotos = computed(() => {
    const p = this.producto.value();
    return p ? [p.imagenUrl, ...(p.galeria ?? [])] : [];
  });
  protected readonly foto = linkedSignal({ source: this.fotos, computation: () => 0 });

  constructor() {
    effect(() => {
      const p = this.producto.value();
      this.title.setTitle(p ? `${p.nombre} | ${p.negocioNombre}` : 'Sierra Sur en Línea');
    });
  }
}
