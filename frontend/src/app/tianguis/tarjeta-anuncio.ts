import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AnuncioResumen } from './tianguis.model';
import { haceCuanto, precioMxn, textoCondicion } from './tianguis';

/** Tarjeta de un artículo: foto, título, precio, condición, localidad y «hace X días». */
@Component({
  selector: 'app-tarjeta-anuncio',
  imports: [RouterLink],
  template: `
    @let a = anuncio();
    <a class="tarjeta" [routerLink]="['/tianguis', a.idSlug]" [class.vendida]="a.estado === 'VENDIDO'">
      <span class="foto">
        @if (a.portada) {
          <img [src]="a.portada" alt="" width="320" height="240" loading="lazy" />
        } @else {
          <span class="sin-foto" aria-hidden="true">📦</span>
        }
        @if (a.estado === 'VENDIDO') { <span class="sello">Vendido</span> }
      </span>
      <span class="cuerpo">
        <strong class="precio">{{ precio() }}@if (a.negociable) { <small> · negociable</small> }</strong>
        <span class="titulo">{{ a.titulo }}</span>
        <span class="meta">{{ condicion() }} · {{ a.ubicacion }}</span>
        <span class="meta">{{ hace() }}</span>
      </span>
    </a>
  `,
  styles: `
    :host { display: block; }
    .tarjeta {
      height: 100%; display: flex; flex-direction: column; background: var(--superficie); border: 1px solid var(--linea);
      border-radius: 1rem; overflow: hidden; color: var(--tinta); text-decoration: none; transition: transform .15s, box-shadow .15s;
      &:hover { transform: translateY(-2px); box-shadow: 0 .5rem 1.5rem rgb(42 31 26 / .12); }
      &:hover .titulo { text-decoration: underline; text-underline-offset: .15em; }
      &:focus-visible { outline: 3px solid var(--follaje); outline-offset: 3px; }
    }
    .foto { position: relative; aspect-ratio: 4 / 3; background: var(--fondo-alt); display: grid; place-items: center; }
    .foto img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
    .sin-foto { font-size: 2.2rem; }
    .vendida .foto img { filter: grayscale(.7) brightness(.85); }
    .sello { position: absolute; top: .55rem; left: .55rem; font-size: .75rem; font-weight: 800; letter-spacing: .04em;
      text-transform: uppercase; padding: .25rem .6rem; border-radius: 999px; background: #2a1f1a; color: #fff; }
    .cuerpo { display: flex; flex-direction: column; gap: .15rem; padding: .7rem .85rem .85rem; }
    .precio { font-size: 1.1rem; font-weight: 800; small { font-size: .78rem; font-weight: 600; color: var(--tinta-suave); } }
    .titulo { font-size: .95rem; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .meta { font-size: .8rem; color: var(--tinta-suave); }
    @media (prefers-reduced-motion: reduce) { .tarjeta { transition: none; &:hover { transform: none; } } }
  `,
})
export class TarjetaAnuncio {
  readonly anuncio = input.required<AnuncioResumen>();
  readonly hoy = input<Date>(new Date());

  protected readonly precio = computed(() => precioMxn(this.anuncio().precio));
  protected readonly condicion = computed(() => textoCondicion(this.anuncio().condicion));
  protected readonly hace = computed(() => {
    const a = this.anuncio();
    return a.estado === 'VENDIDO' ? `Vendido ${haceCuanto(a.fechaVendido, this.hoy())}` : `Publicado ${haceCuanto(a.fechaPublicacion, this.hoy())}`;
  });
}
