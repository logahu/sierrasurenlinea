import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Negocio } from './catalogo.model';

/**
 * Una fachada de la calle: muro pintado con el color del negocio, rótulo, toldo a rayas,
 * ventana con su portada y los avisos («Se rentan», «Solo mayores de 18», «en pruebas»).
 * `variante` (0…4) cambia la silueta del pretil para que la cuadra no se vea repetida.
 */
@Component({
  selector: 'app-fachada',
  imports: [RouterLink],
  host: { '[class]': "'v' + (variante() % 5)", '[style.--pintura]': 'negocio().colorPrimario' },
  template: `
    @let n = negocio();
    <a class="muro" [routerLink]="['/', n.slug]">
      <span class="rotulo">{{ n.nombre }}@if (n.estado === 'PRUEBAS') { <small class="en-pruebas">🧪 en pruebas</small> }</span>
      <span class="toldo" aria-hidden="true"></span>
      <span class="ventana"><img [src]="n.portadaUrl" alt="" width="400" height="400" loading="lazy" /></span>
      @if (n.eslogan) { <span class="letrero">{{ n.eslogan }}</span> }
      @if (n.tipo === 'RENTA') { <span class="aviso">Se rentan</span> }
      @if (n.soloMayoresEdad) { <span class="aviso">Solo mayores de 18</span> }
      @if (n.tipo === 'SERVICIO') { <span class="aviso">En moto</span> }
    </a>
  `,
  styleUrl: './fachada.scss',
})
export class Fachada {
  readonly negocio = input.required<Negocio>();
  readonly variante = input(0);
}
