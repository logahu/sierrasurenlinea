import { Component, DestroyRef, computed, inject, linkedSignal, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { AdminApi } from './admin.api';
import { AgendaPanel, CitaAgenda, EstadoPedido, Profesional } from './admin.model';
import { mensajeDeError } from './autorizacion';
import { PedidosService } from './pedidos';
import { SesionService } from './sesion';
import { telefonoLegible } from './usuarios-filtros';

/** 2026-11-18 de una fecha local. */
export function fechaLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function sumarDias(fecha: string, dias: number): string {
  const [a, m, d] = fecha.split('-').map(Number);
  return fechaLocal(new Date(a, m - 1, d + dias));
}

/** «Lunes 18 de noviembre» (con «Hoy» y «Mañana»). */
export function nombreDelDia(fecha: string, hoy = fechaLocal(new Date())): string {
  if (fecha === hoy) return 'Hoy';
  if (fecha === sumarDias(hoy, 1)) return 'Mañana';
  const [a, m, d] = fecha.split('-').map(Number);
  const t = new Date(a, m - 1, d).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** «Martes 17 de noviembre», siempre con la fecha. */
export function fechaCompleta(fecha: string): string {
  const [a, m, d] = fecha.split('-').map(Number);
  const t = new Date(a, m - 1, d).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** «10:00» de «2026-11-18T10:00:00». */
export function hora(iso: string): string {
  return iso.slice(11, 16);
}

/** Minutos desde la medianoche: «10:30» → 630 (también acepta la fecha completa). */
export function minutos(h: string): number {
  const t = h.length > 5 ? hora(h) : h;
  const [hh, mm] = t.split(':').map(Number);
  return hh * 60 + mm;
}

/** Citas agrupadas por día (en orden), incluidos los días sin citas del rango. */
export function citasPorDia(citas: CitaAgenda[], desde: string, dias: number): { fecha: string; citas: CitaAgenda[] }[] {
  const r: { fecha: string; citas: CitaAgenda[] }[] = [];
  for (let i = 0; i < dias; i++) {
    const f = sumarDias(desde, i);
    r.push({ fecha: f, citas: citas.filter((c) => c.inicio.slice(0, 10) === f) });
  }
  return r;
}

/** 1 = lunes … 7 = domingo, como el horario de citas. */
export function diaDeLaSemana(fecha: string): number {
  const [a, m, d] = fecha.split('-').map(Number);
  return ((new Date(a, m - 1, d).getDay() + 6) % 7) + 1;
}

/**
 * Horas que abarca el tablero de un día: las del horario de citas, estiradas para que quepa
 * cualquier cita fuera de él. `abierto` dice si ese día hay horario.
 */
export function rangoDelDia(
  fecha: string,
  horario: AgendaPanel['horario'],
  citas: CitaAgenda[],
): { abre: number; cierra: number; abierto: boolean } {
  const turno = horario?.[String(diaDeLaSemana(fecha))] ?? null;
  let abre = turno ? minutos(turno[0]) : 10 * 60;
  let cierra = turno ? minutos(turno[1]) : 19 * 60;
  for (const c of citas) {
    abre = Math.min(abre, minutos(c.inicio));
    cierra = Math.max(cierra, minutos(c.fin));
  }
  // A horas cerradas, para que la rejilla empiece y termine en punto.
  return { abre: Math.floor(abre / 60) * 60, cierra: Math.ceil(cierra / 60) * 60, abierto: !!turno };
}

/**
 * Inicios de los huecos libres de una persona: cada bloque del horario que no choca con
 * ninguna de sus citas y que aún no pasa (si `ahora` no es null).
 */
export function huecosLibres(citas: CitaAgenda[], abre: number, cierra: number, paso: number, ahora: number | null): number[] {
  const ocupadas = citas.map((c) => [minutos(c.inicio), minutos(c.fin)] as const);
  const r: number[] = [];
  for (let t = abre; t + paso <= cierra; t += paso) {
    if (ahora !== null && t < ahora) continue;
    if (!ocupadas.some(([i, f]) => t < f && t + paso > i)) r.push(t);
  }
  return r;
}

/** «Ana María» → «AM». */
export function iniciales(nombre: string): string {
  const p = nombre.trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase() || '?';
}

/** Número de color (0…5) de una categoría según su lugar en el negocio; -1 si no se sabe. */
export function colorDeCategoria(categoria: string | null | undefined, categorias: string[] | undefined): number {
  if (!categoria) return -1;
  const i = (categorias ?? []).indexOf(categoria);
  return i < 0 ? -1 : i % COLORES_CATEGORIA;
}

/** Botón del siguiente paso de una cita. */
export function siguientePasoCita(estado: EstadoPedido): { estado: EstadoPedido; texto: string } | null {
  switch (estado) {
    case 'NUEVO': return { estado: 'ACEPTADO', texto: 'Confirmar cita' };
    case 'ACEPTADO': return { estado: 'EN_CAMINO', texto: 'Llegó el cliente' };
    case 'EN_CAMINO': return { estado: 'ENTREGADO', texto: 'Marcar realizada' };
    default: return null;
  }
}

const COLORES_CATEGORIA = 6;
const COLORES_PERSONA = 6;
/** Alto en píxeles de una hora en el tablero. */
const HORA_PX = 64;

const ESTADO: Record<EstadoPedido, string> = {
  NUEVO: 'Por confirmar', ACEPTADO: 'Confirmada', EN_CAMINO: 'En atención', ENTREGADO: 'Realizada', CANCELADO: 'Cancelada',
};

interface Columna {
  /** null = citas sin persona asignada. */
  id: number | null;
  nombre: string;
  especialidades: string | null;
  color: number;
  citas: CitaAgenda[];
  libres: number[];
}

/**
 * Agenda de citas. Vista Día: un tablero con una columna por persona (en el celular, una a la
 * vez). Vista Semana: la lista por día. El encargado ve las de todos; el empleado, solo las suyas.
 */
@Component({
  selector: 'app-agenda-page',
  imports: [RouterLink],
  template: `
    <header class="panel-titulo">
      <h1>{{ sesion.esEmpleado() ? 'Mi agenda' : 'Agenda' }}</h1>
      @if (datos(); as a) { <p class="ayuda">{{ a.negocioNombre }}</p> }
    </header>

    @if (sesion.esDueno()) {
      <label class="negocio">Negocio
        <select (change)="negocio.set($any($event.target).value)">
          @for (n of negociosConCitas(); track n.slug) {
            <option [value]="n.slug" [selected]="n.slug === negocio()">{{ n.nombre }}{{ n.agendaActiva ? '' : ' (agenda apagada)' }}</option>
          }
        </select>
      </label>
    }

    <div class="controles">
      <div class="navegacion">
        <button type="button" class="btn secundario" (click)="mover(-1)" aria-label="Antes">‹</button>
        <button type="button" class="btn secundario" (click)="desde.set(hoy())" [disabled]="desde() === hoy()">Hoy</button>
        <button type="button" class="btn secundario" (click)="mover(1)" aria-label="Después">›</button>
        <strong class="fecha">{{ dias() === 1 ? fechaCompleta(desde()) : 'Semana del ' + fechaCompleta(desde()) }}</strong>
      </div>
      <div class="vista" role="group" aria-label="Vista">
        <button type="button" [class.elegida]="dias() === 1" (click)="dias.set(1)">Día</button>
        <button type="button" [class.elegida]="dias() === 7" (click)="dias.set(7)">Semana</button>
      </div>
    </div>

    @if (error(); as e) { <p class="error" role="alert">{{ e }} <button type="button" class="btn secundario" (click)="agenda.reload()">Reintentar</button></p> }

    @if (datos(); as a) {
      @if (!a.soloMias && !a.profesionales.length) {
        <p class="aviso-agenda">
          Aún no hay quién atienda citas. Agrega empleados (o marca que el encargado atiende) en
          <a [routerLink]="['/admin/negocios', a.negocioSlug, 'equipo']">Equipo y agenda</a>.
        </p>
      }

      @if (dias() === 1) {
        @if (leyenda().length) {
          <ul class="leyenda" aria-label="Colores">
            @for (l of leyenda(); track l.nombre) { <li><i [class]="'c' + l.color"></i>{{ l.nombre }}</li> }
            <li class="sep"><i class="e-NUEVO"></i>Por confirmar</li>
            <li><i class="e-ACEPTADO"></i>Confirmada</li>
            <li><i class="e-ENTREGADO"></i>Realizada</li>
          </ul>
        }
        @if (!rango().abierto) { <p class="ayuda cerrado-hoy">Este día no hay horario de citas.</p> }

        <!-- En el celular: una persona a la vez. -->
        @if (columnas().length > 1) {
          <div class="personas" role="tablist" aria-label="Persona">
            @for (col of columnas(); track col.id) {
              <button type="button" role="tab" [attr.aria-selected]="col.id === enCelular()" [class.elegida]="col.id === enCelular()"
                      (click)="enCelular.set(col.id)">
                <span class="avatar" [class]="'avatar p' + col.color">{{ iniciales(col.nombre) }}</span>
                <span class="nombre">{{ col.nombre }}</span>
                <small>{{ col.citas.length }}</small>
              </button>
            }
          </div>
        }

        <div class="tablero" [style.--columnas]="columnas().length || 1">
          <div class="fila cabezas">
          <div class="esquina"></div>
          @for (col of columnas(); track col.id) {
            <div class="cabeza" [class.en-celular]="col.id === enCelular()">
              <span class="avatar" [class]="'avatar p' + col.color">{{ iniciales(col.nombre) }}</span>
              <strong>{{ col.nombre }}</strong>
              <small>{{ col.especialidades ? col.especialidades + ' · ' : '' }}{{ col.citas.length }} {{ col.citas.length === 1 ? 'cita' : 'citas' }}</small>
            </div>
          }
          </div>

          <div class="fila cuerpo">
          <div class="horas" [style.height.px]="altoTablero()">
            @for (h of horasDelDia(); track h) { <span [style.top.px]="(h - rango().abre) / 60 * HORA_PX">{{ hhmm(h) }}</span> }
          </div>
          @for (col of columnas(); track col.id) {
            <div class="columna" [class.en-celular]="col.id === enCelular()" [style.height.px]="altoTablero()">
              @for (t of col.libres; track t) {
                <span class="libre" [style.top.px]="y(t)" [style.height.px]="paso() / 60 * HORA_PX - 4">Libre · {{ hhmm(t) }}</span>
              }
              @for (c of col.citas; track c.pedidoId) {
                <button type="button" [class]="'cita c' + color(c) + ' e-' + c.estado" [class.abierta]="abierta()?.pedidoId === c.pedidoId"
                        [style.top.px]="y(minutos(c.inicio))" [style.height.px]="alto(c)" (click)="abrir(c)">
                  <strong>{{ c.clienteNombre }}</strong>
                  <span class="servicios">{{ c.servicios.join(' · ') }}</span>
                  <span class="horario">{{ hora(c.inicio) }} – {{ hora(c.fin) }}</span>
                  @if (c.estado === 'NUEVO') { <span class="marca">Nueva</span> }
                  @if (c.estado === 'ENTREGADO') { <span class="marca hecha" aria-label="Realizada">✓</span> }
                  @if (c.prueba) { <span class="marca prueba">🧪</span> }
                </button>
              }
            </div>
          }
          @if (lineaAhora() !== null) { <div class="ahora" [style.top.px]="lineaAhora()" aria-hidden="true"></div> }
          </div>
        </div>

        @if (!columnas().length) { <p class="ayuda">{{ agenda.isLoading() ? 'Cargando…' : 'Sin citas este día.' }}</p> }
      } @else {
        @if (!a.soloMias && a.profesionales.length > 1) {
          <div class="chips" role="group" aria-label="Filtrar por persona">
            <button type="button" class="chip" [class.elegido]="persona() === null" (click)="persona.set(null)">Todos <b>{{ a.citas.length }}</b></button>
            @for (p of a.profesionales; track p.id) {
              <button type="button" class="chip" [class.elegido]="persona() === p.id" (click)="persona.set(p.id)">
                {{ p.nombre }} <b>{{ cuantas(a, p.id) }}</b>
              </button>
            }
          </div>
        }
        @for (g of grupos(); track g.fecha) {
          <h2 class="dia">{{ nombreDia(g.fecha) }} <small>· {{ g.citas.length ? g.citas.length + (g.citas.length === 1 ? ' cita' : ' citas') : 'sin citas' }}</small></h2>
          <ul class="citas">
            @for (c of g.citas; track c.pedidoId) {
              <li>
                <button type="button" [class]="'renglon c' + color(c) + ' e-' + c.estado" (click)="abrir(c)">
                  <span class="hora"><strong>{{ hora(c.inicio) }}</strong><small>a {{ hora(c.fin) }}</small></span>
                  <span class="info">
                    <strong>{{ c.clienteNombre }}</strong>
                    <span>{{ c.servicios.join(' · ') }}</span>
                    @if (!a.soloMias && c.empleadoNombre) { <span class="con">con {{ c.empleadoNombre }}</span> }
                  </span>
                  <span class="estado">{{ estado(c.estado) }}</span>
                </button>
              </li>
            }
          </ul>
        }
      }
    } @else {
      <p class="ayuda">{{ agenda.isLoading() ? 'Cargando…' : '' }}</p>
    }

    @if (abierta(); as c) {
      <div class="fondo-ficha" (click)="abierta.set(null)" aria-hidden="true"></div>
      <aside class="ficha" role="dialog" aria-label="Detalle de la cita">
        <button type="button" class="cerrar" (click)="abierta.set(null)" aria-label="Cerrar">×</button>
        <span class="franja" [class]="'franja c' + color(c)"></span>
        <h2>{{ c.clienteNombre }} @if (c.prueba) { <span class="etiqueta-prueba">🧪 PRUEBA</span> }</h2>
        <p class="servicios">{{ c.servicios.join(' · ') }}</p>
        <p>{{ nombreDia(c.inicio.slice(0, 10)) }}, {{ hora(c.inicio) }} a {{ hora(c.fin) }}@if (c.empleadoNombre) { · con {{ c.empleadoNombre }} }</p>
        @if (c.notas) { <p class="notas">📝 {{ c.notas }}</p> }
        <p class="estado-ficha" [class]="'estado-ficha e-' + c.estado">● {{ estado(c.estado) }} · Pedido {{ c.folio }}</p>
        <div class="botones">
          <a class="btn wa" [href]="'https://wa.me/52' + c.clienteTelefono" target="_blank" rel="noopener">WhatsApp</a>
          <a class="btn secundario" [href]="'tel:' + c.clienteTelefono" [attr.aria-label]="'Llamar al ' + tel(c.clienteTelefono)">Llamar</a>
        </div>
        @if (!sesion.esEmpleado()) {
          @if (pasoDe(c); as paso) {
            <button type="button" class="btn primario siguiente" [disabled]="guardando()" (click)="avanzar(c, paso.estado)">{{ paso.texto }}</button>
          }
          @if (errorFicha(); as e) { <p class="error" role="alert">{{ e }}</p> }
          <a class="ver-pedido" routerLink="/admin/pedidos">Ver en Pedidos ›</a>
        }
      </aside>
    }
  `,
  styleUrl: './agenda-page.scss',
})
export class AgendaPage {
  private readonly api = inject(AdminApi);
  private readonly pedidos = inject(PedidosService);
  protected readonly sesion = inject(SesionService);
  protected readonly hora = hora;
  protected readonly minutos = minutos;
  protected readonly iniciales = iniciales;
  protected readonly fechaCompleta = fechaCompleta;
  protected readonly tel = telefonoLegible;
  protected readonly HORA_PX = HORA_PX;
  protected readonly nombreDia = (f: string) => nombreDelDia(f, this.hoy());

  protected readonly hoy = signal(fechaLocal(new Date()));
  /** Minutos desde la medianoche, para la línea de «ahora». */
  private readonly ahora = signal(minutosAhora());
  protected readonly desde = signal(this.hoy());
  protected readonly dias = signal(1);
  protected readonly persona = signal<number | null>(null);
  protected readonly abierta = signal<CitaAgenda | null>(null);
  protected readonly guardando = signal(false);
  protected readonly errorFicha = signal<string | null>(null);

  /** Negocios de citas (para el administrador). */
  private readonly negocios = rxResource({
    params: () => (this.sesion.esDueno() ? true : undefined),
    stream: () => this.api.negocios(),
  });
  protected readonly negociosConCitas = computed(() =>
    ((this.negocios.hasValue() ? this.negocios.value() : []) ?? []).filter((n) => n.modoPedido === 'CITA'),
  );
  protected readonly negocio = linkedSignal(() => {
    const l = this.negociosConCitas();
    return (l.find((n) => n.agendaActiva) ?? l[0])?.slug ?? '';
  });

  protected readonly agenda = rxResource({
    params: () =>
      this.sesion.esDueno() && !this.negocio()
        ? undefined
        : { desde: this.desde(), dias: this.dias(), negocio: this.sesion.esDueno() ? this.negocio() : undefined },
    stream: ({ params }) => this.api.agenda(params.desde, params.dias, params.negocio),
  });
  protected readonly datos = computed<AgendaPanel | undefined>(() => (this.agenda.hasValue() ? this.agenda.value() : undefined));
  protected readonly error = computed(() => (this.agenda.error() ? mensajeDeError(this.agenda.error()) : null));

  // ---- Vista Semana (lista)
  protected readonly grupos = computed(() => {
    const a = this.datos();
    if (!a) return [];
    const p = this.persona();
    const citas = p === null ? a.citas : a.citas.filter((c) => c.empleadoId === p);
    return citasPorDia(citas, this.desde(), this.dias());
  });

  // ---- Vista Día (tablero)
  protected readonly paso = computed(() => this.datos()?.minutosCita ?? 60);
  protected readonly rango = computed(() => rangoDelDia(this.desde(), this.datos()?.horario, this.datos()?.citas ?? []));
  protected readonly altoTablero = computed(() => ((this.rango().cierra - this.rango().abre) / 60) * HORA_PX);
  protected readonly horasDelDia = computed(() => {
    const r: number[] = [];
    for (let t = this.rango().abre; t <= this.rango().cierra; t += 60) r.push(t);
    return r;
  });
  protected readonly columnas = computed<Columna[]>(() => {
    const a = this.datos();
    if (!a) return [];
    const { abre, cierra, abierto } = this.rango();
    const esHoy = this.desde() === this.hoy();
    const yaPaso = this.desde() < this.hoy();
    const libres = (citas: CitaAgenda[]) =>
      !abierto || yaPaso ? [] : huecosLibres(citas, abre, cierra, this.paso(), esHoy ? this.ahora() : null);
    const cols: Columna[] = a.profesionales.map((p: Profesional) => {
      const citas = a.citas.filter((c) => c.empleadoId === p.id);
      return { id: p.id, nombre: p.nombre, especialidades: p.especialidades, color: p.id % COLORES_PERSONA, citas, libres: libres(citas) };
    });
    const ids = new Set(a.profesionales.map((p) => p.id));
    const sueltas = a.citas.filter((c) => c.empleadoId === null || !ids.has(c.empleadoId));
    if (sueltas.length) {
      cols.push({ id: null, nombre: 'Sin asignar', especialidades: null, color: 0, citas: sueltas, libres: [] });
    }
    return cols;
  });
  /** La persona que se ve en el celular (la primera, hasta que se elija otra). */
  protected readonly enCelular = linkedSignal<Columna[], number | null>({
    source: this.columnas,
    computation: (cols, previo) =>
      cols.some((c) => c.id === previo?.value) ? (previo?.value ?? null) : (cols[0]?.id ?? null),
  });
  protected readonly leyenda = computed(() => {
    const a = this.datos();
    const usadas = new Set((a?.citas ?? []).map((c) => c.categoria).filter(Boolean));
    return (a?.categorias ?? [])
      .filter((c) => usadas.has(c))
      .map((nombre) => ({ nombre, color: colorDeCategoria(nombre, a?.categorias) }));
  });
  protected readonly lineaAhora = computed(() => {
    if (this.desde() !== this.hoy()) return null;
    const t = this.ahora();
    const { abre, cierra } = this.rango();
    return t < abre || t > cierra ? null : this.y(t);
  });

  constructor() {
    // Se actualiza sola cada minuto (por si entra una cita nueva) y mueve la línea de «ahora».
    const t = setInterval(() => {
      this.hoy.set(fechaLocal(new Date()));
      this.ahora.set(minutosAhora());
      if (!this.agenda.isLoading()) this.agenda.reload();
    }, 60_000);
    inject(DestroyRef).onDestroy(() => clearInterval(t));
  }

  protected y(min: number): number {
    return ((min - this.rango().abre) / 60) * HORA_PX;
  }

  protected alto(c: CitaAgenda): number {
    return Math.max(28, ((minutos(c.fin) - minutos(c.inicio)) / 60) * HORA_PX - 4);
  }

  protected hhmm(min: number): string {
    return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
  }

  protected color(c: CitaAgenda): number {
    return colorDeCategoria(c.categoria, this.datos()?.categorias);
  }

  protected mover(paso: number): void {
    this.desde.set(sumarDias(this.desde(), paso * this.dias()));
  }

  protected cuantas(a: AgendaPanel, id: number): number {
    return a.citas.filter((c) => c.empleadoId === id).length;
  }

  protected estado(e: EstadoPedido): string {
    return ESTADO[e];
  }

  protected pasoDe(c: CitaAgenda): { estado: EstadoPedido; texto: string } | null {
    return siguientePasoCita(c.estado);
  }

  protected abrir(c: CitaAgenda): void {
    this.errorFicha.set(null);
    this.abierta.set(c);
  }

  protected avanzar(c: CitaAgenda, estado: EstadoPedido): void {
    this.guardando.set(true);
    this.errorFicha.set(null);
    this.pedidos.cambiarEstado(c.pedidoId, estado).subscribe({
      next: () => {
        this.guardando.set(false);
        this.abierta.set({ ...c, estado });
        this.agenda.reload();
      },
      error: (e) => {
        this.guardando.set(false);
        this.errorFicha.set(mensajeDeError(e));
      },
    });
  }
}

function minutosAhora(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}
