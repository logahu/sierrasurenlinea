import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Observable, finalize } from 'rxjs';
import { AdminApi } from './admin.api';
import { ConfiguracionAgenda, Usuario } from './admin.model';
import { mensajeDeError } from './autorizacion';
import { NegocioTabs } from './negocio-tabs';
import { MINIMO_CONTRASENA as MINIMO } from '../cuenta/cuenta.model';
import { telefonoLegible } from './usuarios-filtros';
import { VerContrasena } from '../compartido/ver-contrasena';
import { DiasSinServicio } from './dias-sin-servicio';

export const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

/** Un día del formulario de horario. */
export interface DiaHorario {
  dia: number;
  abierto: boolean;
  abre: string;
  cierra: string;
}

export function diasDesde(c: ConfiguracionAgenda): DiaHorario[] {
  return DIAS_SEMANA.map((_, i) => {
    const t = c.horario[String(i + 1)];
    return { dia: i + 1, abierto: !!t, abre: t?.[0] ?? '10:00', cierra: t?.[1] ?? '19:00' };
  });
}

export function horarioDesde(dias: DiaHorario[]): ConfiguracionAgenda['horario'] {
  const r: ConfiguracionAgenda['horario'] = {};
  for (const d of dias) r[String(d.dia)] = d.abierto ? [d.abre, d.cierra] : null;
  return r;
}

/** «Mi equipo» del negocio: empleados que da de alta el encargado y, en negocios de citas, el horario de la agenda. */
@Component({
  selector: 'app-equipo-page',
  imports: [NegocioTabs, VerContrasena, DiasSinServicio],
  template: `
    <app-negocio-tabs [slug]="slug()" [negocio]="negocio()" seccion="equipo" />

    <section class="ficha">
      <h2>Empleados</h2>
      <p class="ayuda">
        Entran al panel en <strong>sierrasurenlinea.com.mx/admin</strong> con su teléfono y su contraseña.
        @if (esCitas()) { Solo ven su propia agenda; las citas de todos las ves tú en <strong>Agenda</strong>. }
        @else { Solo ven su agenda. }
      </p>

      @if (equipo.value()?.encargado; as e) {
        @if (esCitas()) {
          <label class="en-linea atiende">
            <input type="checkbox" [checked]="e.atiendeCitas" (change)="alternarEncargado($any($event.target).checked)" [disabled]="ocupado()" />
            {{ e.nombre }} (encargado) también atiende citas
          </label>
        }
      }

      <ul class="lista-equipo">
        @for (u of empleados(); track u.id) {
          <li [class.inactivo]="!u.activo">
            <button type="button" class="renglon" (click)="abrir(u.id)" [attr.aria-expanded]="abierto() === u.id">
              <span>
                <strong>{{ u.nombre }}</strong>
                <small>{{ tel(u.telefono) }}@if (u.especialidades) { · {{ u.especialidades }} }</small>
              </span>
              <span class="estado" [class.activo]="u.activo">{{ u.activo ? 'Activo' : 'Sin acceso' }}</span>
            </button>
            @if (abierto() === u.id) {
              <div class="detalle">
                <form class="datos" (submit)="$event.preventDefault(); guardar(u, en.value, et.value, ee.value)">
                  <label>Nombre <input #en maxlength="80" [value]="u.nombre" /></label>
                  <label>Teléfono <input #et type="tel" inputmode="tel" [value]="u.telefono ?? ''" /></label>
                  <label>Especialidades <input #ee maxlength="200" [value]="u.especialidades ?? ''" placeholder="Cortes, barba" /></label>
                  <button class="btn primario" type="submit" [disabled]="ocupado()">Guardar</button>
                </form>
                <form class="en-linea" (submit)="$event.preventDefault(); contrasena(u, nc.value); nc.value = ''">
                  <input #nc type="password" autocomplete="new-password" verContrasena [placeholder]="'Contraseña nueva (mínimo ' + minimo + ')'" />
                  <button class="btn secundario" type="submit" [disabled]="ocupado()">🔑 Poner contraseña</button>
                </form>
                <button type="button" class="btn secundario" (click)="alternarAcceso(u)" [disabled]="ocupado()">
                  {{ u.activo ? '⛔ Quitar acceso' : '✅ Devolver acceso' }}
                </button>
                @if (fila() === u.id) {
                  @if (aviso(); as a) { <p class="exito" role="status">{{ a }}</p> }
                  @if (error(); as e) { <p class="error" role="alert">{{ e }}</p> }
                }
              </div>
            }
          </li>
        } @empty {
          <li class="ayuda vacio">{{ equipo.isLoading() ? 'Cargando…' : 'Aún no hay empleados.' }}</li>
        }
      </ul>

      <details class="agregar" [open]="!empleados().length">
        <summary>＋ Agregar empleado</summary>
        <form (submit)="$event.preventDefault(); crear(an.value, at.value, ac.value, ae.value)">
          <label>Nombre <input #an maxlength="80" autocomplete="off" placeholder="Ana López" /></label>
          <label>Teléfono celular <input #at type="tel" inputmode="tel" autocomplete="off" placeholder="951 123 4567" /></label>
          <label>Contraseña <input #ac type="password" autocomplete="new-password" verContrasena [placeholder]="'Mínimo ' + minimo + ' caracteres'" /></label>
          <label>Especialidades <small>(opcional; la ven los clientes)</small> <input #ae maxlength="200" placeholder="Cortes, barba, uñas" /></label>
          <button class="btn primario" type="submit" [disabled]="ocupado()">Agregar empleado</button>
          @if (fila() === 0) {
            @if (aviso(); as a) { <p class="exito" role="status">{{ a }}</p> }
            @if (error(); as e) { <p class="error" role="alert">{{ e }}</p> }
          }
        </form>
      </details>
    </section>

    @if (esCitas()) {
      <section class="ficha">
        <h2>Agenda de citas</h2>
        <p class="ayuda">
          Con la agenda activa, el cliente elige con quién y ve solo los horarios libres; cada servicio ocupa
          {{ minutos() }} minutos y varios servicios van seguidos con la misma persona.
        </p>
        @if (config.value()) {
          <label class="en-linea"><input type="checkbox" [checked]="activa()" (change)="activa.set($any($event.target).checked)" /> Agenda activa</label>
          <label class="minutos">Cada servicio dura
            <select (change)="minutos.set(+$any($event.target).value)">
              @for (m of [30, 45, 60, 90, 120]; track m) { <option [value]="m" [selected]="m === minutos()">{{ m }} minutos</option> }
            </select>
          </label>
          <div class="horario">
            @for (d of dias(); track d.dia) {
              <div class="dia" [class.cerrado]="!d.abierto">
                <label class="en-linea"><input type="checkbox" [checked]="d.abierto" (change)="cambiarDia(d.dia, { abierto: $any($event.target).checked })" /> {{ nombreDia(d.dia) }}</label>
                @if (d.abierto) {
                  <input type="time" step="900" [value]="d.abre" (change)="cambiarDia(d.dia, { abre: $any($event.target).value })" [attr.aria-label]="'Abre el ' + nombreDia(d.dia)" />
                  <span>a</span>
                  <input type="time" step="900" [value]="d.cierra" (change)="cambiarDia(d.dia, { cierra: $any($event.target).value })" [attr.aria-label]="'Cierra el ' + nombreDia(d.dia)" />
                } @else {
                  <span class="ayuda">Cerrado</span>
                }
              </div>
            }
          </div>
          <button type="button" class="btn primario" (click)="guardarAgenda()" [disabled]="ocupado()">Guardar horario</button>
          @if (fila() === -1) {
            @if (aviso(); as a) { <p class="exito" role="status">{{ a }}</p> }
            @if (error(); as e) { <p class="error" role="alert">{{ e }}</p> }
          }
        } @else if (config.isLoading()) {
          <p class="ayuda">Cargando…</p>
        }
      </section>

      <app-dias-sin-servicio [slug]="slug()" [negocioNombre]="negocio()?.nombre ?? ''" [personas]="personas()" />
    }
  `,
  styles: `
    .ficha h2 { margin: 0 0 .25rem; font-size: 1.15rem; }
    .atiende { margin: .5rem 0; font-weight: 600; }
    .lista-equipo { list-style: none; margin: .75rem 0; padding: 0; border: 1px solid var(--linea); border-radius: .75rem; overflow: hidden; }
    .lista-equipo li { border-bottom: 1px solid var(--linea); }
    .lista-equipo li:last-child { border-bottom: 0; }
    .lista-equipo li.inactivo strong { color: var(--tinta-suave); }
    .renglon { all: unset; box-sizing: border-box; width: 100%; display: flex; justify-content: space-between; gap: 1rem; align-items: center; padding: .65rem .8rem; cursor: pointer; }
    .renglon:focus-visible { outline: 2px solid var(--follaje); outline-offset: -2px; }
    .renglon small { display: block; color: var(--tinta-suave); font-size: .82rem; }
    .estado { font-size: .8rem; color: var(--tinta-suave); white-space: nowrap; }
    .estado::before { content: '● '; color: #a8a29e; }
    .estado.activo { color: var(--tinta); }
    .estado.activo::before { color: #2f9e5b; }
    .detalle { display: grid; gap: .6rem; padding: .2rem .8rem .9rem; background: color-mix(in srgb, var(--follaje) 5%, var(--superficie)); }
    .datos { display: grid; gap: .5rem; grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr)); align-items: end; }
    .datos label, .agregar label { display: grid; gap: .25rem; font-size: .85rem; font-weight: 600; }
    .detalle > .btn { justify-self: start; }
    .vacio { padding: 1rem; text-align: center; }
    .agregar { margin-bottom: 2rem; }
    .agregar summary { cursor: pointer; font-weight: 600; color: var(--follaje); padding: .3rem 0; list-style: none; }
    .agregar summary::-webkit-details-marker { display: none; }
    .agregar form { display: grid; gap: .6rem; max-width: 28rem; margin-top: .5rem; }
    .minutos { display: flex; gap: .5rem; align-items: center; margin: .6rem 0; font-weight: 600; }
    .minutos select { width: auto; }
    .horario { display: grid; gap: .35rem; margin: .5rem 0 1rem; }
    .dia { display: grid; grid-template-columns: 8.5rem auto auto auto; gap: .5rem; align-items: center; }
    .dia input[type='time'] { width: auto; }
    .dia.cerrado label { color: var(--tinta-suave); }
    @media (max-width: 480px) { .dia { grid-template-columns: 1fr auto auto auto; } }
  `,
})
export class EquipoPage {
  readonly slug = input.required<string>();
  private readonly api = inject(AdminApi);
  protected readonly minimo = MINIMO;
  protected readonly tel = telefonoLegible;

  private readonly negocios = rxResource({ stream: () => this.api.negocios() });
  protected readonly negocio = computed(() =>
    (this.negocios.hasValue() ? this.negocios.value() : [])?.find((n) => n.slug === this.slug()),
  );
  protected readonly esCitas = computed(() => this.negocio()?.modoPedido === 'CITA');

  protected readonly equipo = rxResource({ params: () => this.slug(), stream: ({ params }) => this.api.equipo(params) });
  protected readonly empleados = computed(() => (this.equipo.hasValue() ? this.equipo.value()?.empleados : []) ?? []);
  /** Quienes atienden citas: empleados activos y el encargado si también atiende. */
  protected readonly personas = computed(() => {
    const e = this.equipo.hasValue() ? this.equipo.value()?.encargado : null;
    const l = this.empleados().filter((u) => u.activo && u.atiendeCitas !== false).map((u) => ({ id: u.id, nombre: u.nombre }));
    return e?.atiendeCitas ? [...l, { id: e.id, nombre: e.nombre }] : l;
  });

  protected readonly config = rxResource({
    params: () => (this.esCitas() ? this.slug() : undefined),
    stream: ({ params }) => this.api.configuracionAgenda(params),
  });
  protected readonly activa = signal(false);
  protected readonly minutos = signal(60);
  protected readonly dias = signal<DiaHorario[]>([]);
  private readonly cargarConfig = effect(() => {
    const c = this.config.hasValue() ? this.config.value() : undefined;
    if (!c) return;
    untracked(() => {
      this.activa.set(c.activa);
      this.minutos.set(c.minutosCita);
      this.dias.set(diasDesde(c));
    });
  });

  protected readonly abierto = signal<number | null>(null);
  protected readonly ocupado = signal(false);
  /** Dónde va el aviso: id del empleado, 0 = agregar, -1 = agenda. */
  protected readonly fila = signal<number | null>(null);
  protected readonly aviso = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  protected nombreDia(d: number): string {
    return DIAS_SEMANA[d - 1];
  }

  protected abrir(id: number): void {
    this.abierto.set(this.abierto() === id ? null : id);
  }

  protected cambiarDia(dia: number, cambio: Partial<DiaHorario>): void {
    this.dias.update((ds) => ds.map((d) => (d.dia === dia ? { ...d, ...cambio } : d)));
  }

  protected crear(nombre: string, telefono: string, contrasena: string, especialidades: string): void {
    if (!nombre.trim() || !telefono.trim() || !contrasena) {
      this.fila.set(0);
      this.aviso.set(null);
      this.error.set('Escribe nombre, teléfono y contraseña.');
      return;
    }
    this.ejecutar(0, this.api.crearEmpleado(this.slug(), { nombre, telefono, contrasena, especialidades }), (u) =>
      `Listo: ${u.nombre} ya puede entrar con su teléfono ${telefonoLegible(u.telefono)}.`,
    );
  }

  protected guardar(u: Usuario, nombre: string, telefono: string, especialidades: string): void {
    this.ejecutar(u.id, this.api.editarEmpleado(this.slug(), u.id, { nombre, telefono, especialidades }), (r) => `Se guardaron los datos de ${r.nombre}.`);
  }

  protected contrasena(u: Usuario, nueva: string): void {
    this.ejecutar(u.id, this.api.contrasenaEmpleado(this.slug(), u.id, nueva), () => `Listo: dale a ${u.nombre} su contraseña nueva.`);
  }

  protected alternarAcceso(u: Usuario): void {
    this.ejecutar(u.id, this.api.editarEmpleado(this.slug(), u.id, { nombre: u.nombre, especialidades: u.especialidades ?? null, activo: !u.activo }), (r) =>
      r.activo ? `${r.nombre} puede volver a entrar.` : `${r.nombre} ya no puede entrar ni aparece en la agenda.`,
    );
  }

  protected alternarEncargado(atiende: boolean): void {
    this.ejecutar(0, this.api.encargadoAtiende(this.slug(), atiende), (r) =>
      atiende ? `${r.nombre} aparece en la agenda.` : `${r.nombre} ya no aparece en la agenda.`,
    );
  }

  protected guardarAgenda(): void {
    const datos: ConfiguracionAgenda = { activa: this.activa(), minutosCita: this.minutos(), horario: horarioDesde(this.dias()) };
    this.ejecutar(-1, this.api.guardarConfiguracionAgenda(this.slug(), datos), (c) =>
      c.activa ? 'Horario guardado. Los clientes ya ven los horarios libres.' : 'Horario guardado (la agenda está apagada).',
    );
  }

  private ejecutar<T>(fila: number, accion: Observable<T>, exito: (r: T) => string): void {
    this.fila.set(fila);
    this.aviso.set(null);
    this.error.set(null);
    this.ocupado.set(true);
    accion.pipe(finalize(() => this.ocupado.set(false))).subscribe({
      next: (r) => {
        this.aviso.set(exito(r));
        this.equipo.reload();
        if (fila === -1) this.config.reload();
      },
      error: (e) => this.error.set(mensajeDeError(e)),
    });
  }
}
