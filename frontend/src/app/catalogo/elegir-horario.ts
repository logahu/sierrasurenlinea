import { HttpClient } from '@angular/common/http';
import { Component, computed, effect, inject, input, linkedSignal, model, signal, untracked } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Avatar } from '../compartido/avatar';
import { environment } from '../../environments/environment';

export interface ProfesionalPublico {
  id: number;
  nombre: string;
  especialidades: string | null;
  avatar?: string | null;
}

export interface HorarioLibre {
  hora: string;
  libres: number[];
}

export interface DiaAgenda {
  fecha: string;
  nombre: string;
  abierto: boolean;
  /** Por qué cerró ese día el negocio (p. ej. «Día de Muertos»). */
  aviso?: string | null;
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

/** «Ana María» → «AM». */
export function iniciales(nombre: string): string {
  const p = nombre.trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase() || '?';
}

/** Horas agrupadas en Mañana (antes de las 12), Tarde (antes de las 19) y Noche. */
export function porFranja(horarios: HorarioLibre[]): { nombre: string; horarios: HorarioLibre[] }[] {
  const franjas = [
    { nombre: 'Mañana', horarios: horarios.filter((h) => h.hora < '12:00') },
    { nombre: 'Tarde', horarios: horarios.filter((h) => h.hora >= '12:00' && h.hora < '19:00') },
    { nombre: 'Noche', horarios: horarios.filter((h) => h.hora >= '19:00') },
  ];
  return franjas.filter((f) => f.horarios.length);
}

/** Lo que va en la tarjeta de un día: «Mar» (u «Hoy») y el número. */
export function tarjetaDia(fecha: string, nombre: string): { arriba: string; numero: number } {
  const [a, m, d] = fecha.split('-').map(Number);
  if (nombre === 'Hoy' || nombre === 'Mañana') return { arriba: nombre, numero: d };
  const t = new Date(a, m - 1, d).toLocaleDateString('es-MX', { weekday: 'short' }).replace('.', '');
  return { arriba: t.charAt(0).toUpperCase() + t.slice(1), numero: d };
}

/**
 * Elegir con quién, día y hora de la cita entre los horarios libres del negocio.
 * Cada servicio ocupa un bloque y varios van seguidos con la misma persona.
 */
@Component({
  selector: 'app-elegir-horario',
  imports: [Avatar],
  template: `
    @if (datos(); as d) {
      @if (!d.profesionales.length) {
        <p class="aviso">Por ahora no hay horarios en línea. Escríbenos por WhatsApp para apartar tu cita.</p>
      } @else {
        <fieldset class="con-quien">
          <legend>¿Con quién quieres tu cita?</legend>
          <div class="personas">
            <button type="button" [class.elegida]="persona() === null" (click)="elegirPersona(null)" [attr.aria-pressed]="persona() === null">
              <span class="avatar cualquiera" aria-hidden="true">✦</span>
              <span class="nombre">Cualquiera</span><small>más horarios</small>
            </button>
            @for (p of d.profesionales; track p.id) {
              <button type="button" [class.elegida]="persona() === p.id" (click)="elegirPersona(p.id)" [attr.aria-pressed]="persona() === p.id">
                <app-avatar class="avatar" [avatar]="p.avatar" [nombre]="p.nombre" aria-hidden="true" />
                <span class="nombre">{{ p.nombre }}</span>
                @if (p.especialidades) { <small>{{ p.especialidades }}</small> }
              </button>
            }
          </div>
        </fieldset>

        <fieldset class="dias">
          <legend>Día <small>· tu cita dura {{ duracionTexto() }}</small></legend>
          <div class="tira" role="group" aria-label="Días">
            @for (dia of d.dias; track dia.fecha) {
              @let t = tarjeta(dia);
              <button type="button" [class.elegida]="dia.fecha === fecha()" [disabled]="!dia.abierto || !dia.horarios.length" [attr.title]="dia.aviso ?? null"
                      (click)="fecha.set(dia.fecha)" [attr.aria-pressed]="dia.fecha === fecha()" [attr.aria-label]="largo(dia.fecha)">
                <small class="arriba">{{ t.arriba }}</small>
                <strong>{{ t.numero }}</strong>
                <small [class.motivo]="!!dia.aviso">{{ dia.aviso ? 'Cerrado · ' + dia.aviso : !dia.abierto ? 'Cerrado' : dia.horarios.length ? dia.horarios.length + (dia.horarios.length === 1 ? ' libre' : ' libres') : 'Lleno' }}</small>
              </button>
            }
            <button type="button" class="mas" (click)="desde.set(siguiente())" [disabled]="cargando()">Más<br />días ›</button>
          </div>
          @if (desde() !== null) { <button type="button" class="volver" (click)="desde.set(null)">‹ Volver a esta semana</button> }
        </fieldset>

        @if (diaElegido(); as dia) {
          <fieldset class="horas">
            <legend>Hora · {{ largo(dia.fecha) }}</legend>
            @for (f of franjas(); track f.nombre) {
              <p class="franja">{{ f.nombre }}</p>
              <div class="rejilla">
                @for (h of f.horarios; track h.hora) {
                  <button type="button" [class.elegida]="seleccion()?.fecha === dia.fecha && seleccion()?.hora === h.hora"
                          (click)="elegirHora(dia, h)">{{ h.hora }}</button>
                }
              </div>
            }
          </fieldset>
        }
        @if (seleccion(); as s) {
          <p class="resumen" role="status"><span aria-hidden="true">✓</span> <span>Tu cita<strong>{{ s.texto }}</strong></span></p>
        }
      }
    } @else if (cargando()) {
      <p class="aviso">Buscando horarios libres…</p>
    } @else if (error()) {
      <p class="aviso">No pudimos cargar los horarios. <button type="button" (click)="disponibilidad.reload()">Reintentar</button></p>
    }
  `,
  styles: `
    :host {
      display: grid; gap: 1.1rem;
      --per-0: #7d8b74; --per-1: #b07d62; --per-2: #5f7a99; --per-3: #9b6b8e; --per-4: #6f8f5a; --per-5: #a3864a;
      --sel: var(--acento, var(--t-tinta, #222));
      --sobre-sel: var(--t-sobre-acento, #fff);
      --borde: var(--t-linea, var(--linea));
      --suave: var(--t-tinta-suave, var(--tinta-suave));
      --caja: var(--t-superficie, #fff);
      --radio: var(--t-radio-chip, .6rem);
    }
    fieldset { border: 0; padding: 0; margin: 0; display: grid; gap: .45rem; min-width: 0; }
    legend { font-weight: 600; padding: 0; margin-bottom: .55rem; font-size: 1.02rem; }
    legend small { font-weight: 400; color: var(--suave); }
    button { font: inherit; cursor: pointer; color: var(--t-tinta, var(--tinta)); }

    .personas { display: flex; gap: .4rem; overflow-x: auto; padding: .25rem .1rem .35rem; scroll-snap-type: x proximity; }
    .personas button {
      flex: 0 0 auto; width: 5.4rem; display: grid; justify-items: center; align-content: start; gap: .15rem;
      border: 0; background: none; padding: .15rem; text-align: center; scroll-snap-align: start;
    }
    .personas .nombre { font-size: .85rem; line-height: 1.2; }
    .personas small { font-size: .72rem; line-height: 1.2; color: var(--suave); }
    .avatar {
      display: grid; place-items: center; width: 3.4rem; height: 3.4rem; border-radius: 50%; margin-bottom: .2rem;
      background: var(--per); color: #fff; font-weight: 700; font-size: 1.1rem; letter-spacing: .02em;
      outline: 2px solid transparent; outline-offset: 3px; transition: outline-color .15s;
    }
    .p0 { --per: var(--per-0); } .p1 { --per: var(--per-1); } .p2 { --per: var(--per-2); }
    .p3 { --per: var(--per-3); } .p4 { --per: var(--per-4); } .p5 { --per: var(--per-5); }
    .avatar.cualquiera { background: var(--caja); color: var(--suave); border: 1.5px dashed var(--borde); font-size: 1.2rem; }
    .personas .elegida .avatar { outline-color: var(--sel); }
    .personas .elegida .nombre { font-weight: 700; }

    .tira { display: flex; gap: .45rem; overflow-x: auto; padding: .1rem .1rem .35rem; scroll-snap-type: x proximity; }
    .tira button {
      flex: 0 0 auto; display: grid; justify-items: center; gap: .05rem; min-width: 4.3rem; padding: .5rem .4rem;
      border: 1px solid var(--borde); background: var(--caja); border-radius: var(--radio); scroll-snap-align: start;
    }
    .tira strong { font-size: 1.35rem; font-weight: 500; line-height: 1.1; font-variant-numeric: tabular-nums; }
    .tira small { font-size: .72rem; color: var(--suave); }
    .tira .arriba { font-size: .78rem; color: var(--t-tinta, var(--tinta)); }
    .tira button:disabled { opacity: .4; cursor: default; }
    .tira .mas { border-style: dashed; font-size: .8rem; color: var(--suave); line-height: 1.2; align-content: center; }

    .franja { margin: .15rem 0 0; font-size: .78rem; text-transform: uppercase; letter-spacing: .08em; color: var(--suave); }
    .rejilla { display: grid; grid-template-columns: repeat(auto-fill, minmax(4.6rem, 1fr)); gap: .45rem; }
    .rejilla button {
      border: 1px solid var(--borde); background: var(--caja); border-radius: var(--radio);
      padding: .55rem .3rem; text-align: center; font-variant-numeric: tabular-nums;
    }

    .personas button:focus-visible .avatar { outline-color: var(--suave); }
    .tira button.elegida, .rejilla button.elegida { background: var(--sel); color: var(--sobre-sel); border-color: var(--sel); }
    .tira button.elegida small { color: inherit; opacity: .85; }

    .volver { justify-self: start; border: 0; background: none; padding: 0; text-decoration: underline; color: var(--t-acento-texto, inherit); }
    .resumen {
      margin: 0; display: flex; gap: .7rem; align-items: center; padding: .8rem 1rem; border-radius: var(--radio);
      background: var(--sel); color: var(--sobre-sel); font-size: .9rem;
    }
    .resumen > span:first-child { display: grid; place-items: center; flex: none; width: 1.6rem; height: 1.6rem; border-radius: 50%; background: color-mix(in srgb, var(--sobre-sel) 22%, transparent); font-size: .8rem; }
    .resumen strong { display: block; font-size: 1rem; font-weight: 600; }
    .aviso { margin: 0; color: var(--suave); }
    small.motivo { display: block; max-width: 7.5rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  `,
})
export class ElegirHorario {
  readonly slug = input.required<string>();
  /** Cuántos bloques de la agenda ocupa la cita (la suma de los de cada servicio). */
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
  protected readonly franjas = computed(() => porFranja(this.diaElegido()?.horarios ?? []));
  protected readonly iniciales = iniciales;

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

  protected tarjeta(dia: DiaAgenda): { arriba: string; numero: number } {
    return tarjetaDia(dia.fecha, dia.nombre);
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
