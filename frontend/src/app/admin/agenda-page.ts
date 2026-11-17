import { Component, DestroyRef, computed, inject, linkedSignal, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { AdminApi } from './admin.api';
import { AgendaPanel, CitaAgenda, EstadoPedido } from './admin.model';
import { mensajeDeError } from './autorizacion';
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

/** «10:00» de «2026-11-18T10:00:00». */
export function hora(iso: string): string {
  return iso.slice(11, 16);
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

const ESTADO: Record<EstadoPedido, string> = {
  NUEVO: 'Por confirmar', ACEPTADO: 'Confirmada', EN_CAMINO: 'En atención', ENTREGADO: 'Realizada', CANCELADO: 'Cancelada',
};

/** Agenda de citas: el encargado ve las de todos (con filtro por persona); el empleado, solo las suyas. */
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
      </div>
      <div class="vista" role="group" aria-label="Vista">
        <button type="button" [class.elegida]="dias() === 1" (click)="dias.set(1)">Día</button>
        <button type="button" [class.elegida]="dias() === 7" (click)="dias.set(7)">Semana</button>
      </div>
    </div>

    @if (datos(); as a) {
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
      @if (!a.soloMias && !a.profesionales.length) {
        <p class="aviso-agenda">
          Aún no hay quién atienda citas. Agrega empleados (o marca que el encargado atiende) en
          <a [routerLink]="['/admin/negocios', a.negocioSlug, 'equipo']">Equipo y agenda</a>.
        </p>
      }
    }
    @if (error(); as e) { <p class="error" role="alert">{{ e }} <button type="button" class="btn secundario" (click)="agenda.reload()">Reintentar</button></p> }

    @for (g of grupos(); track g.fecha) {
      <h2 class="dia">{{ nombreDia(g.fecha) }} <small>· {{ g.citas.length ? g.citas.length + (g.citas.length === 1 ? ' cita' : ' citas') : 'sin citas' }}</small></h2>
      <ul class="citas">
        @for (c of g.citas; track c.pedidoId) {
          <li class="cita" [class]="'cita estado-' + c.estado">
            <div class="hora"><strong>{{ hora(c.inicio) }}</strong><small>a {{ hora(c.fin) }}</small></div>
            <div class="info">
              <strong>{{ c.clienteNombre }}</strong>
              @if (c.prueba) { <span class="etiqueta-prueba">🧪 PRUEBA</span> }
              <span class="servicios">{{ c.servicios.join(' · ') }}</span>
              @if (!datos()?.soloMias && c.empleadoNombre) { <span class="con">con {{ c.empleadoNombre }}</span> }
              @if (c.notas) { <span class="notas">📝 {{ c.notas }}</span> }
              <span class="acciones">
                <a [href]="'https://wa.me/52' + c.clienteTelefono" target="_blank" rel="noopener">WhatsApp</a>
                <a [href]="'tel:' + c.clienteTelefono">Llamar {{ tel(c.clienteTelefono) }}</a>
                @if (!sesion.esEmpleado()) { <a routerLink="/admin/pedidos">Pedido {{ c.folio }}</a> }
              </span>
            </div>
            <span class="estado">{{ estado(c.estado) }}</span>
          </li>
        }
      </ul>
    } @empty {
      <p class="ayuda">{{ agenda.isLoading() ? 'Cargando…' : '' }}</p>
    }
  `,
  styles: `
    .negocio { display: flex; gap: .5rem; align-items: center; font-weight: 600; margin-bottom: .75rem; }
    .negocio select { width: auto; }
    .controles { display: flex; justify-content: space-between; gap: .75rem; flex-wrap: wrap; align-items: center; margin-bottom: .75rem; }
    .navegacion { display: flex; gap: .35rem; }
    .vista { display: flex; border: 1px solid var(--linea); border-radius: 999px; overflow: hidden; }
    .vista button { border: 0; background: var(--superficie); color: var(--tinta); font: inherit; font-weight: 600; padding: .4rem .9rem; cursor: pointer; }
    .vista button.elegida { background: var(--follaje); color: #fff; }
    .chips { display: flex; flex-wrap: wrap; gap: .4rem; margin-bottom: .5rem; }
    .chip { border: 1px solid var(--linea); background: var(--superficie); color: var(--tinta); border-radius: 999px; padding: .3rem .75rem; font: inherit; font-size: .85rem; cursor: pointer; }
    .chip b { color: var(--tinta-suave); margin-left: .15rem; }
    .chip.elegido { border-color: var(--follaje); color: var(--follaje); font-weight: 600; }
    .aviso-agenda { background: #fff7ed; border: 1px solid #fdba74; border-radius: .6rem; padding: .6rem .8rem; }
    .dia { font-size: 1rem; margin: 1.1rem 0 .4rem; }
    .dia small { font-weight: 400; color: var(--tinta-suave); }
    .citas { list-style: none; margin: 0; padding: 0; display: grid; gap: .5rem; }
    .cita { display: grid; grid-template-columns: 4rem 1fr auto; gap: .75rem; align-items: start; padding: .7rem .8rem; border: 1px solid var(--linea); border-left: 4px solid var(--follaje); border-radius: .6rem; background: var(--superficie); }
    .cita.estado-NUEVO { border-left-color: #f59f00; }
    .cita.estado-ENTREGADO { border-left-color: #94a3b8; opacity: .8; }
    .hora strong { display: block; font-size: 1.1rem; }
    .hora small { color: var(--tinta-suave); }
    .info { display: grid; gap: .15rem; min-width: 0; }
    .servicios, .con, .notas { font-size: .9rem; }
    .con { color: var(--follaje); font-weight: 600; }
    .notas { color: var(--tinta-suave); }
    .acciones { display: flex; flex-wrap: wrap; gap: .3rem .9rem; font-size: .85rem; margin-top: .2rem; }
    .estado { font-size: .78rem; font-weight: 700; padding: .15rem .55rem; border-radius: 999px; background: var(--fondo-alt); white-space: nowrap; }
    .estado-NUEVO .estado { background: #fff4e0; color: #9a5b00; }
    @media (max-width: 480px) { .cita { grid-template-columns: 3.4rem 1fr; } .cita .estado { grid-column: 2; justify-self: start; } }
  `,
})
export class AgendaPage {
  private readonly api = inject(AdminApi);
  protected readonly sesion = inject(SesionService);
  protected readonly hora = hora;
  protected readonly tel = telefonoLegible;
  protected readonly nombreDia = (f: string) => nombreDelDia(f, this.hoy());

  protected readonly hoy = signal(fechaLocal(new Date()));
  protected readonly desde = signal(this.hoy());
  protected readonly dias = signal(1);
  protected readonly persona = signal<number | null>(null);

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
  protected readonly grupos = computed(() => {
    const a = this.datos();
    if (!a) return [];
    const p = this.persona();
    const citas = p === null ? a.citas : a.citas.filter((c) => c.empleadoId === p);
    return citasPorDia(citas, this.desde(), this.dias());
  });

  constructor() {
    // Se actualiza sola cada minuto (por si entra una cita nueva).
    const t = setInterval(() => {
      this.hoy.set(fechaLocal(new Date()));
      if (!this.agenda.isLoading()) this.agenda.reload();
    }, 60_000);
    inject(DestroyRef).onDestroy(() => clearInterval(t));
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
}
