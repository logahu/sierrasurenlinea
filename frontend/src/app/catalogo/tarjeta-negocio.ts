import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Negocio } from './catalogo.model';
import { esNuevo, iniciales, tipoDe } from './directorio';
import { textoSobre } from './publicidad';

/**
 * Tarjeta de un negocio en el directorio de la portada. Toda la tarjeta es un enlace a su
 * página. Etiquetas: Patrocinado, Nuevo, +18 y «en pruebas».
 */
@Component({
  selector: 'app-tarjeta-negocio',
  imports: [RouterLink],
  template: `
    @let n = negocio();
    <a class="tarjeta" [routerLink]="['/', n.slug]" [style.--c]="n.colorPrimario">
      <span class="portada">
        @if (n.portadaUrl) {
          <img [src]="n.portadaUrl" alt="" width="320" height="200" loading="lazy" />
        } @else {
          <span class="iniciales" [style.color]="sobre()" aria-hidden="true">{{ ini() }}</span>
        }
        @if (etiquetas().length) {
          <span class="etiquetas">
            @for (e of etiquetas(); track e.texto) { <span [class]="e.clase">{{ e.texto }}</span> }
          </span>
        }
      </span>
      <span class="cuerpo">
        <strong class="nombre">{{ n.nombre }}</strong>
        <span class="sub">{{ n.giro?.nombre ? n.giro!.nombre + ' · ' : '' }}{{ tipo() }}</span>
        @if (n.eslogan) { <span class="eslogan">{{ n.eslogan }}</span> }
        @if (n.horario) { <span class="horario"><span aria-hidden="true">🕑︎</span> {{ n.horario }}</span> }
      </span>
    </a>
  `,
  styleUrl: './tarjeta-negocio.scss',
})
export class TarjetaNegocio {
  readonly negocio = input.required<Negocio>();
  /** Para las pruebas: «hoy». */
  readonly hoy = input<Date>(new Date());

  protected readonly tipo = computed(() => tipoDe(this.negocio()));
  protected readonly ini = computed(() => iniciales(this.negocio().nombre));
  protected readonly sobre = computed(() => textoSobre(this.negocio().colorPrimario));
  protected readonly etiquetas = computed(() => {
    const n = this.negocio();
    const r: { texto: string; clase: string }[] = [];
    if (n.patrocinado) r.push({ texto: 'Patrocinado', clase: 'patrocinado' });
    if (esNuevo(n, this.hoy())) r.push({ texto: 'Nuevo', clase: 'nuevo' });
    if (n.soloMayoresEdad) r.push({ texto: '+18', clase: 'mayores' });
    if (n.estado === 'PRUEBAS') r.push({ texto: 'en pruebas', clase: 'pruebas' });
    return r;
  });
}
