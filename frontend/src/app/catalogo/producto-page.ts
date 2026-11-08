import { Component, computed, effect, inject, input, numberAttribute, linkedSignal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { CatalogoService } from './catalogo.service';
import { ContactoNegocio } from './contacto-negocio';
import { enlaceTelefono, enlaceWhatsapp, mensajeProducto, precioConUnidad } from './contacto';

/** Detalle de un producto: /turamohoy/producto/5 */
@Component({
  selector: 'app-producto-page',
  imports: [RouterLink, ContactoNegocio],
  templateUrl: './producto-page.html',
  styleUrl: './producto-page.scss',
  host: {
    '[style.--acento]': 'negocio.value()?.colorPrimario',
    '[attr.data-tema]': 'negocio.value()?.slug',
  },
})
export class ProductoPage {
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
