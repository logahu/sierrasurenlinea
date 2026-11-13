import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { ClienteSesionService } from './cliente-sesion';
import {
  ActividadCuenta, EventoCuenta, FiltroHistorial, HistorialPedidos, LineaCliente, PedidoHistorial, estadoParaCliente,
} from './cuenta.model';

/** Junta páginas de «Ver más» (la página 0 empieza de nuevo). */
export function juntar<T extends { id: number }>(antes: T[], nuevos: T[], pagina: number): T[] {
  if (pagina === 0) return nuevos;
  const vistos = new Set(antes.map((x) => x.id));
  return [...antes, ...nuevos.filter((x) => !vistos.has(x.id))];
}

/** Agrupa los eventos por día para la línea de tiempo («Hoy», «Ayer», «12 nov 2026»). */
export function porDia(eventos: EventoCuenta[], hoy = new Date()): { dia: string; eventos: EventoCuenta[] }[] {
  const clave = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const ayer = new Date(hoy);
  ayer.setDate(hoy.getDate() - 1);
  const grupos: { dia: string; eventos: EventoCuenta[] }[] = [];
  for (const e of eventos) {
    const d = new Date(e.cuando);
    const nombre =
      clave(d) === clave(hoy) ? 'Hoy'
        : clave(d) === clave(ayer) ? 'Ayer'
          : d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
    const ultimo = grupos[grupos.length - 1];
    if (ultimo?.dia === nombre) ultimo.eventos.push(e);
    else grupos.push({ dia: nombre, eventos: [e] });
  }
  return grupos;
}

/** Renglones agrupados por persona (pedidos de comida para varias personas). */
export function lineasPorPersona(lineas: LineaCliente[]): { persona: string | null; lineas: LineaCliente[] }[] {
  const r: { persona: string | null; lineas: LineaCliente[] }[] = [];
  for (const l of lineas) {
    const ultimo = r[r.length - 1];
    if (ultimo && ultimo.persona === (l.persona ?? null)) ultimo.lineas.push(l);
    else r.push({ persona: l.persona ?? null, lineas: [l] });
  }
  return r;
}

const ICONO: Record<EventoCuenta['tipo'], string> = { PEDIDO: '🛍️', ESTADO: '📦', CUENTA: '👤' };

/** Mi historial: todos los pedidos del cliente (con filtros y detalle) y la actividad de su cuenta. */
@Component({
  selector: 'app-historial-page',
  imports: [RouterLink, DatePipe, CurrencyPipe],
  styleUrl: './cuenta.scss',
  styles: `
    .volver { font-size: .9rem; }
    .pestanas { display: flex; gap: 1.25rem; border-bottom: 1px solid var(--linea); margin: 1rem 0; }
    .pestanas a { padding: .4rem 0 .6rem; color: var(--tinta-suave); text-decoration: none; font-weight: 600; border-bottom: 3px solid transparent; }
    .pestanas a.elegida { color: var(--tinta); border-bottom-color: var(--follaje); }
    .resumen { display: grid; grid-template-columns: repeat(3, 1fr); gap: .5rem; margin-bottom: 1rem; }
    .dato { background: var(--fondo-alt); border-radius: .85rem; padding: .6rem .75rem; }
    .dato strong { display: block; font-size: 1.25rem; }
    .dato small { color: var(--tinta-suave); }
    .chips { display: flex; flex-wrap: wrap; gap: .4rem; margin-bottom: .8rem; }
    .chip { border: 1px solid var(--linea); background: var(--superficie); color: var(--tinta); border-radius: 999px; padding: .3rem .75rem; font-size: .85rem; cursor: pointer; font: inherit; font-size: .85rem; }
    .chip b { color: var(--tinta-suave); margin-left: .15rem; }
    .chip.elegido { border-color: var(--follaje); color: var(--follaje); font-weight: 600; background: color-mix(in srgb, var(--follaje) 10%, var(--superficie)); }
    .chip.elegido b { color: var(--follaje); }
    .pedidos { list-style: none; margin: 0; padding: 0; display: grid; gap: .6rem; }
    .pedido { border: 1px solid var(--linea); border-radius: .85rem; overflow: hidden; }
    .pedido > button { all: unset; box-sizing: border-box; width: 100%; cursor: pointer; display: grid; grid-template-columns: 1fr auto; gap: .15rem 1rem; padding: .8rem 1rem; }
    .pedido > button:focus-visible { outline: 2px solid var(--follaje); outline-offset: -2px; }
    .pedido small { color: var(--tinta-suave); }
    .estado { font-size: .8rem; font-weight: 700; padding: .15rem .6rem; border-radius: 999px; background: var(--fondo-alt); align-self: start; white-space: nowrap; }
    .estado.ENTREGADO { color: var(--follaje); }
    .estado.CANCELADO { color: #c92a2a; }
    .detalle { padding: .2rem 1rem .9rem; border-top: 1px dashed var(--linea); display: grid; gap: .4rem; font-size: .92rem; }
    .detalle ul { list-style: none; margin: 0; padding: 0; display: grid; gap: .3rem; }
    .detalle li { display: flex; justify-content: space-between; gap: 1rem; }
    .detalle li small { display: block; }
    .persona { font-weight: 700; color: var(--follaje); margin-top: .3rem; }
    .acciones { display: flex; gap: .5rem; flex-wrap: wrap; margin-top: .3rem; }
    .mas { text-align: center; margin-top: 1rem; }
    .dia { font-size: .8rem; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--tinta-suave); margin: 1.1rem 0 .4rem; }
    .linea-tiempo { list-style: none; margin: 0; padding: 0 0 0 .4rem; border-left: 2px solid var(--linea); display: grid; gap: .55rem; }
    .evento { display: grid; grid-template-columns: 1.6rem 1fr auto; gap: .5rem; align-items: start; margin-left: -.95rem; }
    .evento .icono { width: 1.6rem; height: 1.6rem; border-radius: 999px; background: var(--superficie); border: 1px solid var(--linea); display: grid; place-items: center; font-size: .8rem; }
    .evento .quien { font-size: .75rem; color: var(--tinta-suave); }
    .evento time { font-size: .8rem; color: var(--tinta-suave); white-space: nowrap; }
    .registro { margin-top: 1rem; color: var(--tinta-suave); font-size: .9rem; }
    @media (max-width: 480px) { .resumen { grid-template-columns: 1fr 1fr; } .resumen .dato:last-child { grid-column: 1 / -1; } }
  `,
  template: `
    <section class="tarjeta-cuenta ancha">
      <a class="volver" routerLink="/cuenta">← Mi cuenta</a>
      <h1>Mi historial</h1>
      <p class="intro">Todos tus pedidos y lo que ha pasado en tu cuenta.</p>

      <nav class="pestanas" aria-label="Secciones del historial">
        <a routerLink="/cuenta/historial" [class.elegida]="!enActividad()">Pedidos</a>
        <a routerLink="/cuenta/historial" [queryParams]="{ ver: 'actividad' }" [class.elegida]="enActividad()">Actividad</a>
      </nav>

      @if (!enActividad()) {
        @if (datos(); as h) {
          <div class="resumen">
            <div class="dato"><strong>{{ h.conteos.todos }}</strong><small>{{ h.conteos.todos === 1 ? 'pedido' : 'pedidos' }} en total</small></div>
            <div class="dato"><strong>{{ h.conteos.entregados }}</strong><small>{{ h.conteos.entregados === 1 ? 'entregado' : 'entregados' }}</small></div>
            <div class="dato"><strong>{{ h.totalEntregado | currency: 'MXN' : 'symbol-narrow' : '1.0-0' }}</strong><small>en pedidos entregados (aprox.)</small></div>
          </div>
          <div class="chips" role="group" aria-label="Filtrar pedidos">
            @for (f of filtros; track f.valor) {
              <button type="button" class="chip" [class.elegido]="filtro() === f.valor" [attr.aria-pressed]="filtro() === f.valor"
                      (click)="elegirFiltro(f.valor)">
                {{ f.texto }} <b>{{ conteo(h, f.valor) }}</b>
              </button>
            }
          </div>
        }
        @if (historial.error() && !lista().length) {
          <p class="error" role="alert">No pudimos cargar tus pedidos. <button type="button" class="btn secundario" (click)="historial.reload()">Reintentar</button></p>
        }
        <ul class="pedidos" aria-live="polite">
          @for (p of lista(); track p.id) {
            <li class="pedido">
              <button type="button" (click)="abrir(p.id)" [attr.aria-expanded]="abierto() === p.id">
                <strong>{{ p.negocioNombre }} · {{ p.tipo }}</strong>
                <span class="estado" [class]="p.estado">{{ estado(p) }}</span>
                <small>
                  Folio {{ p.folio }} · {{ p.creado | date: 'd MMM y, h:mm a' }}
                  @if (p.totalEstimado) { · {{ p.totalEstimado | currency: 'MXN' : 'symbol-narrow' }} aprox. }
                </small>
                <small aria-hidden="true">{{ abierto() === p.id ? '▴' : '▾' }}</small>
              </button>
              @if (abierto() === p.id) {
                <div class="detalle">
                  @if (p.lineas.length) {
                    @for (g of porPersona(p.lineas); track $index) {
                      @if (g.persona && porPersona(p.lineas).length > 1) { <div class="persona">Para {{ g.persona }}</div> }
                      <ul>
                        @for (l of g.lineas; track $index) {
                          <li>
                            <span>
                              {{ l.cantidad }} × {{ l.nombre }}
                              @if (l.detalle) { <small>{{ l.detalle }}</small> }
                              @if (l.nota) { <small>📝 {{ l.nota }}</small> }
                            </span>
                            <span>{{ l.subtotal | currency: 'MXN' : 'symbol-narrow' }}</span>
                          </li>
                        }
                      </ul>
                    }
                  }
                  <small>
                    @if (p.entrega === 'RECOGER') { Pasas a recogerlo }
                    @else if (p.entregar) { Entrega en {{ p.entregar }}{{ p.colonia ? ', ' + p.colonia : '' }} }
                    @if (p.cuando && p.cuando !== 'Lo antes posible') { · para {{ p.cuando }} }
                  </small>
                  @if (p.actualizado && p.estado !== 'NUEVO') {
                    <small>Última actualización: {{ p.actualizado | date: 'd MMM y, h:mm a' }}</small>
                  }
                  <div class="acciones">
                    <a class="btn secundario" [routerLink]="['/', p.negocioSlug]">Volver a pedir en {{ p.negocioNombre }}</a>
                  </div>
                </div>
              }
            </li>
          } @empty {
            <li class="nota">
              @if (historial.isLoading()) { Cargando tus pedidos… }
              @else if (filtro() !== 'todos') { No tienes pedidos en «{{ textoFiltro() }}». }
              @else { Aún no tienes pedidos. <a routerLink="/">Explora los negocios</a> y haz el primero. }
            </li>
          }
        </ul>
        @if (lista().length < (datos()?.total ?? 0)) {
          <p class="mas">
            <button type="button" class="btn secundario" (click)="pagina.set(pagina() + 1)" [disabled]="historial.isLoading()">
              {{ historial.isLoading() ? 'Cargando…' : 'Ver más (' + ((datos()?.total ?? 0) - lista().length) + ')' }}
            </button>
          </p>
        }
      } @else {
        @if (actividad.error() && !eventos().length) {
          <p class="error" role="alert">No pudimos cargar tu actividad. <button type="button" class="btn secundario" (click)="actividad.reload()">Reintentar</button></p>
        }
        @for (g of dias(); track g.dia) {
          <h2 class="dia">{{ g.dia }}</h2>
          <ol class="linea-tiempo">
            @for (e of g.eventos; track $index) {
              <li class="evento">
                <span class="icono" aria-hidden="true">{{ icono(e) }}</span>
                <span>
                  {{ e.texto }}
                  <span class="quien">· {{ e.quien === 'TU' ? 'Tú' : 'Sierra Sur en Línea' }}</span>
                </span>
                <time [attr.datetime]="e.cuando">{{ e.cuando | date: 'h:mm a' }}</time>
              </li>
            }
          </ol>
        } @empty {
          <p class="nota">{{ actividad.isLoading() ? 'Cargando tu actividad…' : 'Aún no hay actividad registrada.' }}</p>
        }
        @if (actividadValor()?.hayMas) {
          <p class="mas">
            <button type="button" class="btn secundario" (click)="paginaActividad.set(paginaActividad() + 1)" [disabled]="actividad.isLoading()">
              {{ actividad.isLoading() ? 'Cargando…' : 'Ver más' }}
            </button>
          </p>
        }
        @if (actividadValor(); as a) {
          @if (!a.hayMas && !eventos().some(esRegistro)) { <p class="registro">👋 Creaste tu cuenta el {{ a.registro | date: "d 'de' MMMM 'de' y" }}.</p> }
        }
      }
    </section>
  `,
})
export class HistorialPage {
  /** ?ver=actividad */
  readonly ver = input<string>();
  private readonly sesion = inject(ClienteSesionService);
  protected readonly estado = estadoParaCliente;
  protected readonly porPersona = lineasPorPersona;
  protected readonly enActividad = computed(() => this.ver() === 'actividad');

  protected readonly filtros: { valor: FiltroHistorial; texto: string }[] = [
    { valor: 'todos', texto: 'Todos' },
    { valor: 'en-curso', texto: 'En curso' },
    { valor: 'entregados', texto: 'Entregados' },
    { valor: 'cancelados', texto: 'Cancelados' },
  ];
  protected readonly filtro = signal<FiltroHistorial>('todos');
  protected readonly pagina = linkedSignal({ source: this.filtro, computation: () => 0 });
  protected readonly abierto = signal<number | null>(null);

  protected readonly historial = rxResource({
    params: () => (this.enActividad() ? undefined : { filtro: this.filtro(), pagina: this.pagina() }),
    stream: ({ params }) => this.sesion.historial(params.filtro, params.pagina),
  });
  /** value() lanza si la carga falló: se lee solo con datos. */
  protected readonly datos = computed<HistorialPedidos | undefined>(() =>
    this.historial.hasValue() ? this.historial.value() : undefined,
  );
  protected readonly lista = linkedSignal<HistorialPedidos | undefined, PedidoHistorial[]>({
    source: this.datos,
    computation: (h, previo) => (h ? juntar(previo?.value ?? [], h.pedidos, h.pagina) : (previo?.value ?? [])),
  });

  protected readonly paginaActividad = signal(0);
  protected readonly actividad = rxResource({
    params: () => (this.enActividad() ? { pagina: this.paginaActividad() } : undefined),
    stream: ({ params }) => this.sesion.actividad(params.pagina),
  });
  protected readonly actividadValor = computed<ActividadCuenta | undefined>(() =>
    this.actividad.hasValue() ? this.actividad.value() : undefined,
  );
  protected readonly eventos = linkedSignal<ActividadCuenta | undefined, EventoCuenta[]>({
    source: this.actividadValor,
    computation: (a, previo) => (!a ? (previo?.value ?? []) : a.pagina === 0 ? a.eventos : [...(previo?.value ?? []), ...a.eventos]),
  });
  protected readonly dias = computed(() => porDia(this.eventos()));

  protected conteo(h: HistorialPedidos, f: FiltroHistorial): number {
    return { todos: h.conteos.todos, 'en-curso': h.conteos.enCurso, entregados: h.conteos.entregados, cancelados: h.conteos.cancelados }[f];
  }

  protected textoFiltro(): string {
    return this.filtros.find((f) => f.valor === this.filtro())?.texto ?? '';
  }

  protected elegirFiltro(f: FiltroHistorial): void {
    this.abierto.set(null);
    this.filtro.set(f);
  }

  protected abrir(id: number): void {
    this.abierto.set(this.abierto() === id ? null : id);
  }

  protected readonly esRegistro = (e: EventoCuenta) => e.texto === 'Creaste tu cuenta';

  protected icono(e: EventoCuenta): string {
    if (e.tipo === 'ESTADO' && e.texto.includes('cancel')) return '✖️';
    if (e.tipo === 'ESTADO' && /entregado|realizada/.test(e.texto)) return '✅';
    return ICONO[e.tipo];
  }
}
