import { Component, computed, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { AdminApi } from './admin.api';
import { BloqueoAgenda, CitaAgenda, NuevoBloqueo } from './admin.model';
import { fechaCompleta, fechaLocal, hora, sumarDias } from './agenda-page';
import { mensajeDeError } from './autorizacion';

/** Un día festivo sugerido. */
export interface Festivo {
  fecha: string;
  nombre: string;
}

/** n-ésimo lunes (1 = primero) de un mes (0 = enero). */
function lunes(anio: number, mes: number, n: number): string {
  const d = new Date(anio, mes, 1);
  const primero = 1 + ((8 - d.getDay()) % 7);
  return fechaLocal(new Date(anio, mes, primero + (n - 1) * 7));
}

/** Festivos de México (los que se recorren a lunes, ya recorridos) de un año. */
export function festivosDe(anio: number): Festivo[] {
  const f = (m: number, d: number) => fechaLocal(new Date(anio, m, d));
  return [
    { fecha: f(0, 1), nombre: 'Año Nuevo' },
    { fecha: lunes(anio, 1, 1), nombre: 'Día de la Constitución' },
    { fecha: lunes(anio, 2, 3), nombre: 'Natalicio de Benito Juárez' },
    { fecha: f(4, 1), nombre: 'Día del Trabajo' },
    { fecha: f(8, 16), nombre: 'Día de la Independencia' },
    { fecha: f(10, 2), nombre: 'Día de Muertos' },
    { fecha: lunes(anio, 10, 3), nombre: 'Revolución Mexicana' },
    { fecha: f(11, 12), nombre: 'Día de la Virgen de Guadalupe' },
    { fecha: f(11, 25), nombre: 'Navidad' },
  ];
}

/** Los próximos festivos (desde hoy) que aún no están bloqueados para todo el negocio. */
export function proximosFestivos(hoy: string, bloqueos: BloqueoAgenda[], cuantos = 4): Festivo[] {
  const anio = Number(hoy.slice(0, 4));
  const ocupado = (fecha: string) =>
    bloqueos.some((b) => b.empleadoId === null && b.inicio <= `${fecha}T00:00:00` && b.fin >= `${sumarDias(fecha, 1)}T00:00:00`);
  return [...festivosDe(anio), ...festivosDe(anio + 1)]
    .filter((x) => x.fecha >= hoy && !ocupado(x.fecha))
    .slice(0, cuantos);
}

/** «Jueves 24 de diciembre, todo el día», «24 al 26 de diciembre», «Viernes 20 de noviembre, 15:00 a 19:00». */
export function textoRango(inicio: string, fin: string): string {
  const diasCompletos = inicio.slice(11, 16) === '00:00' && fin.slice(11, 16) === '00:00';
  const a = inicio.slice(0, 10);
  if (!diasCompletos) {
    const b = fin.slice(0, 10);
    return a === b
      ? `${fechaCompleta(a)}, ${hora(inicio)} a ${hora(fin)}`
      : `${fechaCompleta(a)} ${hora(inicio)} a ${fechaCompleta(b).toLowerCase()} ${hora(fin)}`;
  }
  const ultimo = sumarDias(fin.slice(0, 10), -1);
  if (a === ultimo) return `${fechaCompleta(a)}, todo el día`;
  const mesA = new Date(`${a}T12:00:00`).toLocaleDateString('es-MX', { month: 'long' });
  const mesB = new Date(`${ultimo}T12:00:00`).toLocaleDateString('es-MX', { month: 'long' });
  return `${Number(a.slice(8))}${mesA === mesB ? '' : ' de ' + mesA} al ${Number(ultimo.slice(8))} de ${mesB}`;
}

/** Días y horas sin servicio del negocio (solo el encargado o el administrador). */
@Component({
  selector: 'app-dias-sin-servicio',
  imports: [RouterLink],
  template: `
    <section class="ficha" id="sin-servicio">
      <h2>Días y horas sin servicio</h2>
      <p class="ayuda">
        Bloquea días festivos, cierres o las vacaciones de alguien. Esos horarios ya no se ofrecen a los clientes.
        Si ya había citas ahí, te las mostramos para que les avises y las cambies de horario.
      </p>

      <div class="atajos">
        <button type="button" class="chip" (click)="cerrarHoy()" [disabled]="ocupado()">⛔ Cerrar hoy desde ahora</button>
        @for (f of festivos(); track f.fecha) {
          <button type="button" class="chip" (click)="festivo(f)" [disabled]="ocupado()">＋ {{ corta(f.fecha) }} · {{ f.nombre }}</button>
        }
      </div>

      <form class="nuevo" (submit)="$event.preventDefault(); enviar(false)">
        <div class="tipo" role="radiogroup" aria-label="Qué bloquear">
          <label><input type="radio" name="tipo" [checked]="!conHoras()" (change)="conHoras.set(false)" /> Días completos</label>
          <label><input type="radio" name="tipo" [checked]="conHoras()" (change)="conHoras.set(true)" /> Unas horas</label>
        </div>
        <div class="campos">
          <label>{{ conHoras() ? 'Día' : 'Desde' }}
            <input type="date" [min]="hoy" [value]="fecha()" (change)="fecha.set($any($event.target).value)" required />
          </label>
          @if (conHoras()) {
            <label>De <input type="time" step="900" [value]="horaInicio()" (change)="horaInicio.set($any($event.target).value)" /></label>
            <label>A <input type="time" step="900" [value]="horaFin()" (change)="horaFin.set($any($event.target).value)" /></label>
          } @else {
            <label>Hasta <small>(opcional)</small>
              <input type="date" [min]="fecha() || hoy" [value]="fechaFin()" (change)="fechaFin.set($any($event.target).value)" />
            </label>
          }
          <label>Para
            <select (change)="persona.set(+$any($event.target).value || null)">
              <option value="" [selected]="persona() === null">Todo el negocio</option>
              @for (p of personas(); track p.id) { <option [value]="p.id" [selected]="p.id === persona()">Solo {{ p.nombre }}</option> }
            </select>
          </label>
          <label class="motivo">Motivo <small>(opcional; si cierras todo el día, lo ve el cliente)</small>
            <input maxlength="80" [value]="motivo()" (input)="motivo.set($any($event.target).value)" placeholder="Día de Muertos, vacaciones, capacitación…" />
          </label>
        </div>
        <button class="btn primario" type="submit" [disabled]="ocupado()">Bloquear</button>
      </form>

      @if (afectadas().length) {
        <div class="afectadas" role="alert">
          @if (pendiente()) {
            <p><strong>{{ afectadas().length === 1 ? 'Hay una cita' : 'Hay ' + afectadas().length + ' citas' }} en ese horario.</strong>
              Si bloqueas, no se cancelan: quedan marcadas para que avises al cliente y les cambies el horario.</p>
          } @else {
            <p><strong>Bloqueado.</strong> Avisa a estos clientes y cámbiales el horario en la
              <a routerLink="/admin/agenda">Agenda</a> (abre la cita → «Cambiar horario»).</p>
          }
          <ul>
            @for (c of afectadas(); track c.pedidoId) {
              <li>
                <span><strong>{{ c.clienteNombre }}</strong> · {{ fechaCompleta(c.inicio.slice(0, 10)) }}, {{ hora(c.inicio) }}
                  @if (c.empleadoNombre) { · con {{ c.empleadoNombre }} }<br /><small>{{ c.servicios.join(' · ') }}</small></span>
                <a class="btn wa" [href]="aviso(c)" target="_blank" rel="noopener">Avisar por WhatsApp</a>
              </li>
            }
          </ul>
          @if (pendiente()) {
            <div class="botones">
              <button type="button" class="btn primario" (click)="enviar(true)" [disabled]="ocupado()">Bloquear de todos modos</button>
              <button type="button" class="btn secundario" (click)="cancelar()">No bloquear</button>
            </div>
          } @else {
            <button type="button" class="btn secundario" (click)="afectadas.set([])">Listo</button>
          }
        </div>
      }
      @if (exito(); as e) { <p class="exito" role="status">{{ e }}</p> }
      @if (error(); as e) { <p class="error" role="alert">{{ e }}</p> }

      <h3>Próximos bloqueos</h3>
      <ul class="lista">
        @for (b of bloqueos(); track b.id) {
          <li>
            <span>
              <strong>{{ texto(b) }}</strong>
              <small>{{ b.empleadoNombre ? 'Solo ' + b.empleadoNombre : 'Todo el negocio' }}@if (b.motivo) { · {{ b.motivo }} }</small>
              @if (b.citasAfectadas) {
                <a class="reprogramar" routerLink="/admin/agenda">⚠ {{ b.citasAfectadas === 1 ? '1 cita' : b.citasAfectadas + ' citas' }} por reprogramar</a>
              }
            </span>
            <button type="button" class="btn secundario" (click)="quitar(b)" [disabled]="ocupado()" [attr.aria-label]="'Quitar bloqueo ' + texto(b)">Quitar</button>
          </li>
        } @empty {
          <li class="ayuda vacio">{{ lista.isLoading() ? 'Cargando…' : 'No hay días ni horas bloqueados.' }}</li>
        }
      </ul>
    </section>
  `,
  styles: `
    .ficha h2 { margin: 0 0 .25rem; font-size: 1.15rem; }
    h3 { font-size: 1rem; margin: 1.2rem 0 .4rem; }
    .atajos { display: flex; flex-wrap: wrap; gap: .4rem; margin: .7rem 0; }
    .chip { border: 1px solid var(--linea); background: var(--superficie); border-radius: 999px; padding: .3rem .75rem; font-size: .84rem; cursor: pointer; }
    .chip:hover:not(:disabled) { border-color: var(--follaje); }
    .nuevo { display: grid; gap: .6rem; padding: .8rem; border: 1px solid var(--linea); border-radius: .75rem; }
    .tipo { display: flex; gap: 1.2rem; font-weight: 600; }
    .tipo label { display: flex; gap: .35rem; align-items: center; }
    .campos { display: grid; gap: .5rem; grid-template-columns: repeat(auto-fit, minmax(9.5rem, 1fr)); align-items: end; }
    .campos label { display: grid; gap: .25rem; font-size: .85rem; font-weight: 600; }
    .campos small { font-weight: 400; color: var(--tinta-suave); }
    .campos .motivo { grid-column: 1 / -1; }
    .nuevo > .btn { justify-self: start; }
    .afectadas { margin-top: .8rem; background: #fff7ed; border: 1px solid #fdba74; border-radius: .7rem; padding: .7rem .9rem; color: #2a1f1a; }
    .afectadas p { margin: 0 0 .5rem; }
    .afectadas ul { list-style: none; margin: 0 0 .6rem; padding: 0; display: grid; gap: .4rem; }
    .afectadas li { display: flex; justify-content: space-between; align-items: center; gap: .8rem; flex-wrap: wrap;
      background: var(--superficie); border-radius: .5rem; padding: .45rem .6rem; font-size: .88rem; }
    .afectadas small { color: var(--tinta-suave); }
    .btn.wa { background: #1fa855; color: #fff; border-color: #1fa855; font-size: .82rem; padding: .35rem .7rem; }
    .botones { display: flex; gap: .5rem; flex-wrap: wrap; }
    .lista { list-style: none; margin: 0; padding: 0; border: 1px solid var(--linea); border-radius: .75rem; overflow: hidden; }
    .lista li { display: flex; justify-content: space-between; gap: 1rem; align-items: center; padding: .6rem .8rem; border-bottom: 1px solid var(--linea); }
    .lista li:last-child { border-bottom: 0; }
    .lista small { display: block; color: var(--tinta-suave); font-size: .82rem; }
    .reprogramar { display: inline-block; margin-top: .15rem; font-size: .82rem; color: #c2410c; font-weight: 600; }
    .vacio { justify-content: center !important; }
  `,
})
export class DiasSinServicio {
  readonly slug = input.required<string>();
  readonly negocioNombre = input('');
  /** Quienes atienden citas (para bloquear solo a una persona). */
  readonly personas = input<{ id: number; nombre: string }[]>([]);

  private readonly api = inject(AdminApi);
  protected readonly hora = hora;
  protected readonly fechaCompleta = fechaCompleta;
  protected readonly hoy = fechaLocal(new Date());

  protected readonly lista = rxResource({ params: () => this.slug(), stream: ({ params }) => this.api.bloqueosAgenda(params) });
  protected readonly bloqueos = computed(() => (this.lista.hasValue() ? this.lista.value() : []) ?? []);
  protected readonly festivos = computed(() => proximosFestivos(this.hoy, this.bloqueos()));

  protected readonly conHoras = signal(false);
  protected readonly fecha = signal(this.hoy);
  protected readonly fechaFin = signal('');
  protected readonly horaInicio = signal('15:00');
  protected readonly horaFin = signal('19:00');
  protected readonly persona = signal<number | null>(null);
  protected readonly motivo = signal('');

  protected readonly ocupado = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly exito = signal<string | null>(null);
  /** Citas en el horario elegido (antes de confirmar) o ya bloqueadas (para avisar). */
  protected readonly afectadas = signal<CitaAgenda[]>([]);
  /** Falta confirmar el bloqueo que se mandó. */
  protected readonly pendiente = signal<NuevoBloqueo | null>(null);

  protected texto(b: BloqueoAgenda): string {
    return textoRango(b.inicio, b.fin);
  }

  protected corta(fecha: string): string {
    return new Date(`${fecha}T12:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }).replace('.', '');
  }

  protected aviso(c: CitaAgenda): string {
    const t =
      `Hola ${c.clienteNombre}, te escribimos de ${this.negocioNombre() || 'el negocio'}. ` +
      `Tu cita del ${fechaCompleta(c.inicio.slice(0, 10)).toLowerCase()} a las ${hora(c.inicio)} no podrá atenderse en ese horario. ` +
      '¿Te parece si la cambiamos a otro día u hora?';
    return `https://wa.me/52${c.clienteTelefono}?text=${encodeURIComponent(t)}`;
  }

  protected cerrarHoy(): void {
    this.mandar({ fecha: this.hoy, empleadoId: null, motivo: this.motivo().trim() || 'Cerrado hoy' });
  }

  protected festivo(f: Festivo): void {
    this.mandar({ fecha: f.fecha, empleadoId: null, motivo: f.nombre });
  }

  protected enviar(confirmar: boolean): void {
    if (confirmar && this.pendiente()) {
      this.mandar({ ...this.pendiente()!, confirmar: true });
      return;
    }
    if (!this.fecha()) {
      this.error.set('Elige el día.');
      return;
    }
    this.mandar({
      fecha: this.fecha(),
      fechaFin: this.conHoras() ? null : this.fechaFin() || null,
      horaInicio: this.conHoras() ? this.horaInicio() : null,
      horaFin: this.conHoras() ? this.horaFin() : null,
      empleadoId: this.persona(),
      motivo: this.motivo().trim() || null,
    });
  }

  protected cancelar(): void {
    this.pendiente.set(null);
    this.afectadas.set([]);
  }

  private mandar(b: NuevoBloqueo): void {
    this.ocupado.set(true);
    this.error.set(null);
    this.exito.set(null);
    this.api.bloquearAgenda(this.slug(), b).subscribe({
      next: (r) => {
        this.ocupado.set(false);
        this.afectadas.set(r.afectadas);
        if (!r.bloqueo) {
          this.pendiente.set(b);
          return;
        }
        this.pendiente.set(null);
        if (!r.afectadas.length) this.exito.set(`Listo: ${textoRango(r.bloqueo.inicio, r.bloqueo.fin)} sin servicio.`);
        this.motivo.set('');
        this.fechaFin.set('');
        this.lista.reload();
      },
      error: (e) => {
        this.ocupado.set(false);
        this.error.set(mensajeDeError(e));
      },
    });
  }

  protected quitar(b: BloqueoAgenda): void {
    this.ocupado.set(true);
    this.error.set(null);
    this.exito.set(null);
    this.api.quitarBloqueoAgenda(this.slug(), b.id).subscribe({
      next: () => {
        this.ocupado.set(false);
        this.exito.set(`Se quitó el bloqueo: ${textoRango(b.inicio, b.fin)}.`);
        this.lista.reload();
      },
      error: (e) => {
        this.ocupado.set(false);
        this.error.set(mensajeDeError(e));
      },
    });
  }
}
