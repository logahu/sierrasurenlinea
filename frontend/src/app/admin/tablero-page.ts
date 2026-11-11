import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { AdminApi } from './admin.api';
import { mensajeDeError } from './autorizacion';
import { SesionService } from './sesion';

/** Cambio contra el periodo anterior: "+25 %", "−10 %", "nuevo" o "" si no hay base. */
export function variacion(actual: number, previo: number): { texto: string; sube: boolean | null } {
  if (previo === 0) return actual > 0 ? { texto: 'nuevo', sube: true } : { texto: '', sube: null };
  const p = Math.round(((actual - previo) / previo) * 100);
  if (p === 0) return { texto: 'igual', sube: null };
  return { texto: `${p > 0 ? '+' : '−'}${Math.abs(p)} %`, sube: p > 0 };
}

/** Altura "bonita" para el eje: 1, 2, 5, 10, 20, 50… por encima del máximo. */
export function topeEje(max: number): number {
  if (max <= 4) return 4;
  const base = 10 ** Math.floor(Math.log10(max));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * base >= max) return m * base;
  return 10 * base;
}

interface Barra {
  x: number;
  y: number;
  alto: number;
  ancho: number;
  dia: string;
  valor: number;
}

/** En celular la gráfica es más angosta para que los textos del eje se lean. */
const ANCHO = typeof window !== 'undefined' && window.innerWidth < 600 ? 360 : 640;
const ALTO = 180;
const MARGEN_IZQ = 32;
const MARGEN_ABAJO = 22;

/**
 * Tablero del panel: visitas y pedidos del periodo, por día y por negocio, y lo más
 * visto. El administrador ve todo; el encargado, su negocio.
 */
@Component({
  selector: 'app-tablero-page',
  imports: [DecimalPipe, CurrencyPipe, DatePipe, RouterLink],
  templateUrl: './tablero-page.html',
  styleUrl: './tablero-page.scss',
})
export class TableroPage {
  private readonly api = inject(AdminApi);
  protected readonly sesion = inject(SesionService);
  protected readonly mensaje = mensajeDeError;
  protected readonly variacion = variacion;

  protected readonly dias = signal(30);
  protected readonly negocio = signal('');
  protected readonly negocios = rxResource({ stream: () => this.api.negocios() });
  protected readonly datos = rxResource({
    params: () => ({ dias: this.dias(), negocio: this.negocio() }),
    stream: ({ params }) => this.api.tablero(params.dias, params.negocio),
  });

  /** Día bajo el cursor en cada gráfica. */
  protected readonly enfocado = signal<{ grafica: 'visitas' | 'pedidos'; i: number } | null>(null);

  protected readonly graficaVisitas = computed(() => this.barras('visitas'));
  protected readonly graficaPedidos = computed(() => this.barras('pedidos'));
  protected readonly maxNegocio = computed(() => Math.max(1, ...(this.datos.value()?.negocios ?? []).map((n) => n.visitas)));
  protected readonly maxProducto = computed(() => Math.max(1, ...(this.datos.value()?.productos ?? []).map((p) => p.visitas)));
  protected readonly conversion = computed(() => {
    const d = this.datos.value();
    return d && d.visitas > 0 ? (d.pedidos / d.visitas) * 100 : null;
  });

  protected readonly ancho = ANCHO;
  protected readonly alto = ALTO;
  protected readonly margenIzq = MARGEN_IZQ;
  protected readonly margenAbajo = MARGEN_ABAJO;

  protected valor(e: Event): string {
    return (e.target as HTMLSelectElement).value;
  }

  private barras(campo: 'visitas' | 'pedidos') {
    const serie = this.datos.value()?.serie ?? [];
    const tope = topeEje(Math.max(0, ...serie.map((d) => d[campo])));
    const area = ANCHO - MARGEN_IZQ;
    const paso = serie.length ? area / serie.length : area;
    const hueco = Math.min(2, paso * 0.15);
    const altoUtil = ALTO - MARGEN_ABAJO - 8;
    const barras: Barra[] = serie.map((d, i) => {
      const alto = tope ? (d[campo] / tope) * altoUtil : 0;
      return { x: MARGEN_IZQ + i * paso + hueco / 2, y: 8 + altoUtil - alto, alto, ancho: Math.max(1, paso - hueco), dia: d.dia, valor: d[campo] };
    });
    const marcas = [0, tope / 2, tope].map((v) => ({ v, y: 8 + altoUtil - (v / tope) * altoUtil }));
    // Etiquetas del eje x: primera, mitad y última fecha.
    const etiquetas = serie.length
      ? [0, Math.floor((serie.length - 1) / 2), serie.length - 1].map((i) => ({ x: barras[i].x + barras[i].ancho / 2, dia: serie[i].dia }))
      : [];
    return { barras, marcas, etiquetas, paso };
  }
}
