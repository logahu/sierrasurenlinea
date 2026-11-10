import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ModoPedido } from './catalogo.model';
import { CarritoService, TEXTOS_PEDIDO, piezasDe, textoPiezas, totalDe } from './carrito';
import { precioConUnidad } from './contacto';

/** Barra fija abajo con el resumen del carrito del negocio y el botón para verlo. */
@Component({
  selector: 'app-barra-carrito',
  imports: [RouterLink],
  template: `
    @if (piezas() > 0) {
      <div class="barra-carrito" role="region" aria-label="Resumen de tu pedido">
        <div class="resumen">
          <strong>{{ textos().titulo }}</strong>
          <span>{{ cuantos() }}@if (modo() !== 'CITA') { · {{ total() }} }</span>
        </div>
        <a class="ver" [routerLink]="['/', slug(), 'pedido']">{{ textos().ver }} →</a>
      </div>
    }
  `,
  styles: `
    :host { display: contents; }
    .barra-carrito {
      position: fixed;
      left: 50%;
      bottom: calc(1rem + env(safe-area-inset-bottom));
      transform: translateX(-50%);
      z-index: 20;
      width: min(34rem, calc(100% - 2rem));
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding: .7rem .7rem .7rem 1.1rem;
      border-radius: 1rem;
      background: #1f1a17;
      color: #fff;
      box-shadow: 0 10px 30px rgb(0 0 0 / .25);
      font-family: var(--font-body);
    }
    .resumen { display: grid; line-height: 1.25; font-size: .9rem; }
    .resumen strong { font-size: 1rem; }
    .resumen span { opacity: .8; }
    .ver {
      flex: none;
      padding: .65rem 1rem;
      border-radius: .75rem;
      background: var(--acento, #2f6b4f);
      color: #fff;
      font-weight: 700;
      text-decoration: none;
      font-size: .92rem;
    }
  `,
})
export class BarraCarrito {
  readonly slug = input.required<string>();
  readonly modo = input.required<ModoPedido>();

  private readonly carrito = inject(CarritoService);
  private readonly lineas = this.carrito.de(() => this.slug());
  protected readonly piezas = computed(() => piezasDe(this.lineas()));
  protected readonly textos = computed(() => TEXTOS_PEDIDO[this.modo()]);
  protected readonly cuantos = computed(() => textoPiezas(this.modo(), this.modo() === 'CITA' ? this.lineas().length : this.piezas()));
  protected readonly total = computed(() => precioConUnidad({ precio: totalDe(this.lineas()), unidadPrecio: null }));
}
