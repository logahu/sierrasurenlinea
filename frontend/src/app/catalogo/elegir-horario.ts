import { HttpClient } from '@angular/common/http';
import { Component, computed, effect, inject, input, linkedSignal, model, signal, untracked } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { environment } from '../../environments/environment';

export interface ProfesionalPublico {
  id: number;
  nombre: string;
  especialidades: string | null;
}

export interface HorarioLibre {
  hora: string;
  libres: number[];
}

export interface DiaAgenda {
  fecha: string;
  nombre: string;
  abierto: boolean;
  horarios: HorarioLibre[];
}

export interface DisponibilidadAgenda {
  minutosCita: number;
  duracionMinutos: number;
  profesionales: ProfesionalPublico[];
  dias: DiaAgenda[];
}

/** Lo que eligió el cliente. */
export interface CitaElegida {
  fecha: string;
  hora: string;
  /** null = quien esté disponible. */
  empleadoId: number | null;
  /** «Martes 17 de noviembre, 11:00 a 13:00 con Ana». */
  texto: string;
}

/** «11:00» + 120 min → «13:00». */
export function sumarMinutos(hora: string, minutos: number): string {
  const [h, m] = hora.split(':').map(Number);
  const t = h * 60 + m + minutos;
  return `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

/** «Martes 17 de noviembre». */
export function fechaLarga(fecha: string): string {
  const [a, m, d] = fecha.split('-').map(Number);
  const t = new Date(a, m - 1, d).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function textoCita(fecha: string, hora: string, minutos: number, persona: string | null): string {
  return `${fechaLarga(fecha)}, ${hora} a ${sumarMinutos(hora, minutos)}${persona ? ' con ' + persona : ''}`;
}

/** «1 hora», «2 horas», «90 minutos». */
export function duracion(minutos: number): string {
  if (minutos % 60 === 0) return minutos === 60 ? '1 hora' : `${minutos / 60} horas`;
  return `${minutos} minutos`;
}

/**
 * Elegir con quién, día y hora de la cita entre los horarios libres del negocio.
 * Cada servicio ocupa un bloque y varios van seguidos con la misma persona.
 */
@Component({
  selector: 'app-elegir-horario',
  template: `
    @if (datos(); as d) {
      @if (!d.profesionales.length) {
        <p class="aviso">Por ahora no hay horarios en línea. Escríbenos por WhatsApp para apartar tu cita.</p>
      } @else {
        <fieldset class="con-quien">
          <legend>¿Con quién?</legend>
          <div class="personas">
            <button type="button" [class.elegida]="persona() === null" (click)="elegirPersona(null)" [attr.aria-pressed]="persona() === null">
              Quien esté disponible
            </button>
            @for (p of d.profesionales; track p.id) {
              <button type="button" [class.elegida]="persona() === p.id" (click)="elegirPersona(p.id)" [attr.aria-pressed]="persona() === p.id">
                {{ p.nombre }}@if (p.especialidades) { <small>{{ p.especialidades }}</small> }
              </button>
            }
          </div>
        </fieldset>

        <fieldset class="dias">
          <legend>Día <small>· tu cita dura {{ duracionTexto() }}</small></legend>
          <div class="tira" role="group" aria-label="Días">
            @for (dia of d.dias; track dia.fecha) {
              <button type="button" [class.elegida]="dia.fecha === fecha()" [disabled]="!dia.abierto || !dia.horarios.length"
                      (click)="fecha.set(dia.fecha)" [attr.aria-pressed]="dia.fecha === fecha()">
                <strong>{{ dia.nombre }}</strong>
                <small>{{ !dia.abierto ? 'Cerrado' : dia.horarios.length ? dia.horarios.length + (dia.horarios.length === 1 ? ' lugar' : ' lugares') : 'Lleno' }}</small>
              </button>
            }
            <button type="button" class="mas" (click)="desde.set(siguiente())" [disabled]="cargando()">Más días ›</button>
          </div>
          @if (desde() !== null) { <button type="button" class="volver" (click)="desde.set(null)">‹ Volver a esta semana</button> }
        </fieldset>

        @if (diaElegido(); as dia) {
          <fieldset class="horas">
            <legend>Hora · {{ largo(dia.fecha) }}</legend>
            <div class="rejilla">
              @for (h of dia.horarios; track h.hora) {
                <button type="button" [class.elegida]="seleccion()?.fecha === dia.fecha && seleccion()?.hora === h.hora"
                        (click)="elegirHora(dia, h)">{{ h.hora }}</button>
              }
            </div>
          </fieldset>
        }
        @if (seleccion(); as s) {
          <p class="resumen" role="status">✓ Tu cita: <strong>{{ s.texto }}</strong></p>
        }
      }
    } @else if (cargando()) {
      <p class="aviso">Buscando horarios libres…</p>
    } @else if (error()) {
      <p class="aviso">No pudimos cargar los horarios. <button type="button" (click)="disponibilidad.reload()">Reintentar</button></p>
    }
  `,
  styles: `
    :host { display: grid; gap: .9rem; }
    fieldset { border: 0; padding: 0; margin: 0; display: grid; gap: .45rem; }
    legend { font-weight: 600; padding: 0; margin-bottom: .45rem; }
    legend small { font-weight: 400; color: var(--t-tinta-suave, var(--tinta-suave)); }
    button { font: inherit; cursor: pointer; }
    .personas, .rejilla { display: flex; flex-wrap: wrap; gap: .45rem; }
    .personas button, .rejilla button, .tira button {
      border: 1px solid var(--t-linea, var(--linea)); background: var(--t-superficie, #fff); color: var(--t-tinta, var(--tinta));
      border-radius: var(--t-radio-chip, 999px); padding: .5rem .85rem; text-align: left;
    }
    .personas small { display: block; font-size: .78rem; color: var(--t-tinta-suave, var(--tinta-suave)); }
    .rejilla button { min-width: 4.6rem; text-align: center; font-variant-numeric: tabular-nums; }
    .tira { display: flex; gap: .45rem; overflow-x: auto; padding-bottom: .3rem; scroll-snap-type: x proximity; }
    .tira button { flex: 0 0 auto; display: grid; text-align: center; min-width: 5.2rem; scroll-snap-align: start; }
    .tira small { font-size: .75rem; color: var(--t-tinta-suave, var(--tinta-suave)); }
    .tira button:disabled { opacity: .45; cursor: default; }
    .tira .mas { border-style: dashed; }
    .elegida, .tira button.elegida, .personas button.elegida, .rejilla button.elegida {
      background: var(--acento, var(--t-tinta, #222)); color: var(--t-sobre-acento, #fff); border-color: transparent;
    }
    .elegida small { color: inherit !important; opacity: .85; }
    .volver { justify-self: start; border: 0; background: none; padding: 0; text-decoration: underline; color: var(--t-acento-texto, inherit); }
    .resumen { margin: 0; padding: .6rem .8rem; border-radius: .5rem; background: color-mix(in srgb, #2f9e5b 10%, transparent); }
    .aviso { margin: 0; color: var(--t-tinta-suave, var(--tinta-suave)); }
  `,
})
export class ElegirHorario {
  readonly slug = input.required<string>();
  /** Cuántos servicios lleva la cita (cada uno ocupa un bloque). */
  readonly servicios = input(1);
  readonly seleccion = model<CitaElegida | null>(null);

  private readonly http = inject(HttpClient);
  protected readonly persona = signal<number | null>(null);
  /** null = desde hoy. */
  protected readonly desde = signal<string | null>(null);

  protected readonly disponibilidad = rxResource({
    params: () => ({ slug: this.slug(), servicios: Math.max(1, this.servicios()), empleado: this.persona(), desde: this.desde() }),
    stream: ({ params }) => {
      const q: Record<string, string> = { dias: '14', servicios: String(params.servicios) };
      if (params.empleado !== null) q['empleado'] = String(params.empleado);
      if (params.desde) q['desde'] = params.desde;
      return this.http.get<DisponibilidadAgenda>(`${environment.apiUrl}/negocios/${params.slug}/agenda`, { params: q });
    },
  });
  protected readonly datos = computed(() => (this.disponibilidad.hasValue() ? this.disponibilidad.value() : undefined));
  protected readonly cargando = computed(() => this.disponibilidad.isLoading());
  protected readonly error = computed(() => !!this.disponibilidad.error());
  protected readonly duracionTexto = computed(() => duracion(this.datos()?.duracionMinutos ?? 60));

  /** Día elegido: el primero con lugar, salvo que el cliente elija otro. */
  protected readonly fecha = linkedSignal<DisponibilidadAgenda | undefined, string | null>({
    source: this.datos,
    computation: (d, previo) => {
      const dias = d?.dias.filter((x) => x.abierto && x.horarios.length) ?? [];
      return dias.find((x) => x.fecha === previo?.value)?.fecha ?? dias[0]?.fecha ?? null;
    },
  });
  protected readonly diaElegido = computed(() => this.datos()?.dias.find((d) => d.fecha === this.fecha()) ?? null);

  constructor() {
    // Si cambian los servicios o la persona y la hora elegida ya no cabe, se quita.
    effect(() => {
      const d = this.datos();
      const s = untracked(this.seleccion);
      if (!d || !s) return;
      const sigue = d.dias.find((x) => x.fecha === s.fecha)?.horarios.find((h) => h.hora === s.hora);
      const conQuien = s.empleadoId === null || sigue?.libres.includes(s.empleadoId);
      if (!sigue || !conQuien) {
        this.seleccion.set(null);
      } else {
        this.seleccion.set({ ...s, texto: this.texto(s.fecha, s.hora, s.empleadoId) });
      }
    });
  }

  /** Después de un «ya se ocupó»: vuelve a pedir los horarios y quita la elección. */
  recargar(): void {
    this.seleccion.set(null);
    this.disponibilidad.reload();
  }

  protected largo(fecha: string): string {
    return fechaLarga(fecha);
  }

  protected elegirPersona(id: number | null): void {
    this.persona.set(id);
  }

  protected elegirHora(dia: DiaAgenda, h: HorarioLibre): void {
    const empleadoId = this.persona();
    this.seleccion.set({ fecha: dia.fecha, hora: h.hora, empleadoId, texto: this.texto(dia.fecha, h.hora, empleadoId) });
  }

  protected siguiente(): string {
    const dias = this.datos()?.dias ?? [];
    const ultimo = dias[dias.length - 1]?.fecha;
    if (!ultimo) return new Date().toISOString().slice(0, 10);
    const [a, m, d] = ultimo.split('-').map(Number);
    const f = new Date(a, m - 1, d + 1);
    return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
  }

  private texto(fecha: string, hora: string, empleadoId: number | null): string {
    const d = this.datos();
    const nombre = empleadoId === null ? null : (d?.profesionales.find((p) => p.id === empleadoId)?.nombre ?? null);
    return textoCita(fecha, hora, d?.duracionMinutos ?? 60, nombre);
  }
}
