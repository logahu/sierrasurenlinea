import { Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { textoSobre } from '../catalogo/publicidad';
import { AdminApi } from './admin.api';
import { AnuncioAdmin, AnuncioEdicion } from './admin.model';
import { mensajeDeError } from './autorizacion';
import { FotoCampo } from './foto-campo';

export type EstadoAnuncio = 'VIGENTE' | 'PAUSADO' | 'PROGRAMADO' | 'TERMINADO';

/** Cómo está un anuncio hoy (fechas en formato 2026-11-17). */
export function estadoAnuncio(a: Pick<AnuncioAdmin, 'activo' | 'inicio' | 'fin'>, hoy: string): EstadoAnuncio {
  if (!a.activo) return 'PAUSADO';
  if (a.inicio && hoy < a.inicio) return 'PROGRAMADO';
  if (a.fin && hoy > a.fin) return 'TERMINADO';
  return 'VIGENTE';
}

/** «Del 1 al 15 de diciembre», «Desde el 1 de dic.», «Sin fechas». */
export function textoFechas(inicio: string | null, fin: string | null): string {
  const f = (d: string) => {
    const [a, m, dia] = d.split('-').map(Number);
    return new Date(a, m - 1, dia).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
  };
  if (inicio && fin) return `Del ${f(inicio)} al ${f(fin)}`;
  if (inicio) return `Desde el ${f(inicio)}`;
  if (fin) return `Hasta el ${f(fin)}`;
  return 'Sin fechas';
}

const ESTADOS: Record<EstadoAnuncio, string> = {
  VIGENTE: 'Se ve hoy', PAUSADO: 'Pausado', PROGRAMADO: 'Programado', TERMINADO: 'Terminó',
};
const POSICIONES = [
  { valor: 'PORTADA_ARRIBA', texto: 'Arriba de la portada', ayuda: 'Bajo el encabezado, antes de las calles.' },
  { valor: 'ENTRE_CALLES', texto: 'Entre calles', ayuda: 'Después de la segunda calle.' },
] as const;

interface ValoresAnuncio {
  titulo: string;
  texto: string;
  posicion: AnuncioAdmin['posicion'];
  negocioSlug: string;
  enlace: string;
  conColor: boolean;
  colorFondo: string;
  inicio: string;
  fin: string;
  orden: number;
  activo: boolean;
}

function hoyLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Publicidad: banners de la portada (solo el dueño). Cada anuncio tiene posición, fechas,
 * foto, enlace y color; se puede pausar sin borrarlo. Los visitantes pueden ocultarlos.
 */
@Component({
  selector: 'app-publicidad-page',
  imports: [ReactiveFormsModule, FotoCampo],
  template: `
    <header class="panel-titulo">
      <h1>Publicidad</h1>
      <p class="ayuda">Banners de la portada. Siempre dicen «Publicidad» y cada visitante puede ocultarlos por 7 días.</p>
    </header>

    @if (editando() === null) {
      <button type="button" class="btn primario" (click)="nuevo()">+ Nuevo anuncio</button>
    } @else {
      <form class="ficha formulario-anuncio" [formGroup]="form" (ngSubmit)="guardar()" novalidate>
        <fieldset>
          <legend>{{ editando() === 0 ? 'Nuevo anuncio' : 'Editar anuncio' }}</legend>
          <label>Título <input formControlName="titulo" maxlength="80" placeholder="2×1 en ramos este fin de semana" /></label>
          <label>
            <span>Texto <span class="opcional">(opcional)</span></span>
            <input formControlName="texto" maxlength="200" placeholder="Solo en TuRamoHoy, pide por WhatsApp." />
          </label>
          <div class="posiciones" role="radiogroup" aria-label="Dónde se muestra">
            @for (p of posiciones; track p.valor) {
              <label class="opcion" [class.elegida]="form.controls.posicion.value === p.valor">
                <input type="radio" formControlName="posicion" [value]="p.valor" />
                <span><strong>{{ p.texto }}</strong><small>{{ p.ayuda }}</small></span>
              </label>
            }
          </div>
          <label>
            <span>Negocio que se anuncia <span class="opcional">(opcional)</span></span>
            <select formControlName="negocioSlug" (change)="sugerirEnlace()">
              <option value="">Ninguno (anuncio general)</option>
              @for (n of negocios.value() ?? []; track n.slug) { <option [value]="n.slug">{{ n.nombre }}</option> }
            </select>
            <small>Si el negocio deja de estar visible, su anuncio tampoco se muestra.</small>
          </label>
          <label>
            <span>Enlace <span class="opcional">(opcional)</span></span>
            <input formControlName="enlace" maxlength="300" placeholder="/turamohoy o https://…" inputmode="url" />
            <small>Una página del sitio (empieza con /) o una dirección que empiece con https://.</small>
          </label>
          <div>
            <strong class="etiqueta-campo">Foto <span class="opcional">(opcional)</span></strong>
            <app-foto-campo [slug]="carpetaFoto()" [url]="imagen()" (urlChange)="cambiarImagen($event)" />
            @if (imagen()) { <button type="button" class="btn secundario quitar" (click)="cambiarImagen(null)">Quitar foto</button> }
          </div>
          <div class="color">
            <label class="en-linea"><input type="checkbox" formControlName="conColor" /> Color de fondo propio</label>
            @if (form.controls.conColor.value) {
              <label class="en-linea"><input type="color" formControlName="colorFondo" /> {{ form.controls.colorFondo.value }}</label>
            } @else {
              <small>Sin color propio usa el azul de la portada.</small>
            }
          </div>
          <div class="par">
            <label><span>Desde <span class="opcional">(opcional)</span></span><input type="date" formControlName="inicio" /></label>
            <label><span>Hasta <span class="opcional">(opcional)</span></span><input type="date" formControlName="fin" [min]="form.controls.inicio.value" /></label>
          </div>
          <div class="par">
            <label>
              Orden
              <input type="number" formControlName="orden" min="0" step="1" inputmode="numeric" />
              <small>Menor sale primero en el carrusel.</small>
            </label>
            <label class="en-linea activo"><input type="checkbox" formControlName="activo" /> Activo</label>
          </div>
        </fieldset>

        <div class="vista-previa" aria-label="Vista previa">
          <small>Vista previa</small>
          <div class="banner-previo" [style.--fondo]="fondoPrevio()" [style.--sobre]="textoPrevio()">
            <span class="etiqueta-pub">Publicidad</span>
            @if (imagen()) { <img [src]="imagen()" alt="" width="72" height="72" /> }
            <span><strong>{{ form.controls.titulo.value || 'Título del anuncio' }}</strong>
              @if (form.controls.texto.value) { <span>{{ form.controls.texto.value }}</span> }</span>
          </div>
        </div>

        @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
        <div class="acciones">
          <button class="btn primario" type="submit" [disabled]="guardando()">{{ guardando() ? 'Guardando…' : 'Guardar' }}</button>
          <button class="btn secundario" type="button" (click)="cancelar()">Cancelar</button>
        </div>
      </form>
    }

    @if (exito(); as e) { <p class="exito" role="status">{{ e }}</p> }
    @if (anuncios.error(); as e) { <p class="error" role="alert">{{ mensaje(e) }}</p> }

    @for (p of posiciones; track p.valor) {
      <h2 class="grupo">{{ p.texto }}</h2>
      <ul class="lista">
        @for (a of de(p.valor); track a.id) {
          @let est = estado(a);
          <li class="fila-anuncio" [class.apagado]="est !== 'VIGENTE'">
            <span class="muestra" [style.background]="a.colorFondo || '#1e2a5a'" [style.color]="texto(a.colorFondo)" aria-hidden="true">
              @if (a.imagenUrl) { <img [src]="a.imagenUrl" alt="" width="56" height="56" /> } @else { 📣 }
            </span>
            <div class="datos">
              <strong>{{ a.titulo }}</strong>
              <span class="detalle">{{ fechas(a.inicio, a.fin) }}@if (a.negocioNombre) { · {{ a.negocioNombre }} } · {{ a.clics }} {{ a.clics === 1 ? 'clic' : 'clics' }}</span>
              @if (a.enlace) { <span class="detalle enlace">{{ a.enlace }}</span> }
            </div>
            <span class="estado" [class]="'estado e-' + est">{{ nombreEstado(est) }}</span>
            <div class="acciones-fila">
              <button type="button" class="btn secundario" (click)="editar(a)">Editar</button>
              <button type="button" class="btn secundario" [disabled]="ocupado() === a.id" (click)="alternar(a)">
                {{ a.activo ? 'Pausar' : 'Activar' }}
              </button>
            </div>
          </li>
        } @empty {
          <li class="ayuda">{{ anuncios.isLoading() ? 'Cargando…' : 'Sin anuncios aquí.' }}</li>
        }
      </ul>
    }
  `,
  styles: `
    .grupo { font-size: 1.05rem; margin: 1.5rem 0 .6rem; }
    .formulario-anuncio { margin-bottom: 1rem; }
    .posiciones { display: grid; grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr)); gap: .5rem; }
    .opcion { display: flex !important; gap: .6rem; align-items: flex-start; padding: .65rem .75rem; border: 1px solid var(--linea); border-radius: .6rem; cursor: pointer; }
    .opcion.elegida { border-color: var(--follaje); background: color-mix(in srgb, var(--follaje) 8%, var(--superficie)); }
    .opcion input[type='radio'] { flex: none; width: 1.1rem; height: 1.1rem; margin: .15rem 0 0; padding: 0; accent-color: var(--follaje); }
    .opcion small { display: block; }
    .par { display: grid; grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr)); gap: .9rem; align-items: end; }
    .activo { padding-bottom: .7rem; }
    .color { display: grid; gap: .4rem; }
    .quitar { margin-top: .4rem; font-size: .85rem; }
    .etiqueta-campo { display: block; font-size: .92rem; margin-bottom: .35rem; }
    .vista-previa { display: grid; gap: .35rem; }
    .banner-previo { position: relative; display: flex; align-items: center; gap: .8rem; padding: 1.9rem 1rem 1rem; border-radius: .75rem; background: var(--fondo); color: var(--sobre); }
    .banner-previo img { width: 4.5rem; height: 4.5rem; object-fit: cover; border-radius: .45rem; }
    .banner-previo strong { display: block; font-size: 1.1rem; }
    .etiqueta-pub { position: absolute; top: .5rem; left: .6rem; padding: .1rem .45rem; border-radius: .25rem; background: var(--sobre); color: var(--fondo); font-size: .68rem; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
    .fila-anuncio { display: grid; grid-template-columns: auto 1fr auto; gap: .5rem .85rem; align-items: center; padding: .75rem .9rem; border: 1px solid var(--linea); border-radius: var(--panel-radio); background: var(--superficie); }
    .fila-anuncio.apagado .muestra { opacity: .55; }
    .muestra { display: grid; place-items: center; width: 3.5rem; height: 3.5rem; border-radius: .55rem; font-size: 1.4rem; overflow: hidden; }
    .muestra img { width: 100%; height: 100%; object-fit: cover; }
    .datos { display: grid; gap: .1rem; min-width: 0; }
    .detalle { color: var(--tinta-suave); font-size: .85rem; }
    .enlace { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .estado { justify-self: end; font-size: .75rem; font-weight: 700; padding: .15rem .55rem; border-radius: 999px; background: var(--fondo-alt); color: var(--tinta-suave); white-space: nowrap; }
    .e-VIGENTE { background: color-mix(in srgb, var(--follaje) 16%, var(--superficie)); color: var(--follaje); }
    .e-PROGRAMADO { background: color-mix(in srgb, var(--cempasuchil) 22%, var(--superficie)); color: var(--tinta); }
    .acciones-fila { grid-column: 1 / -1; }
    @media (min-width: 640px) { .acciones-fila { grid-column: auto; } .fila-anuncio { grid-template-columns: auto 1fr auto auto; } }
  `,
})
export class PublicidadPage {
  private readonly api = inject(AdminApi);
  protected readonly mensaje = mensajeDeError;
  protected readonly posiciones = POSICIONES;
  protected readonly fechas = textoFechas;
  protected readonly texto = textoSobre;
  protected readonly hoy = hoyLocal();

  protected readonly anuncios = rxResource({ stream: () => this.api.anuncios() });
  protected readonly negocios = rxResource({ stream: () => this.api.negocios() });

  /** null = sin formulario; 0 = nuevo; id = editando ese. */
  protected readonly editando = signal<number | null>(null);
  protected readonly imagen = signal<string | null>(null);
  protected readonly guardando = signal(false);
  protected readonly ocupado = signal<number | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly exito = signal<string | null>(null);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    titulo: ['', [Validators.required, Validators.maxLength(80)]],
    texto: [''],
    posicion: ['PORTADA_ARRIBA' as AnuncioAdmin['posicion']],
    negocioSlug: [''],
    enlace: [''],
    conColor: [false],
    colorFondo: ['#1e2a5a'],
    inicio: [''],
    fin: [''],
    orden: [0],
    activo: [true],
  });

  private readonly valores = signal(this.form.getRawValue());
  /** Las fotos se suben en la carpeta del negocio anunciado; sin negocio, en la del primero. */
  protected readonly carpetaFoto = computed(() => this.valores().negocioSlug || (this.negocios.value()?.[0]?.slug ?? 'turamohoy'));
  protected readonly fondoPrevio = computed(() => (this.valores().conColor ? this.valores().colorFondo : '#1e2a5a'));
  protected readonly textoPrevio = computed(() => textoSobre(this.fondoPrevio()));

  constructor() {
    this.form.valueChanges.subscribe(() => this.valores.set(this.form.getRawValue()));
  }

  protected de(posicion: string): AnuncioAdmin[] {
    return (this.anuncios.value() ?? []).filter((a) => a.posicion === posicion);
  }

  protected estado(a: AnuncioAdmin): EstadoAnuncio {
    return estadoAnuncio(a, this.hoy);
  }

  protected nombreEstado(e: EstadoAnuncio): string {
    return ESTADOS[e];
  }

  protected nuevo(): void {
    this.abrir(0, {
      titulo: '', texto: '', posicion: 'PORTADA_ARRIBA', negocioSlug: '', enlace: '', conColor: false, colorFondo: '#1e2a5a',
      inicio: '', fin: '', orden: 0, activo: true,
    }, null);
  }

  protected editar(a: AnuncioAdmin): void {
    this.abrir(a.id, {
      titulo: a.titulo, texto: a.texto ?? '', posicion: a.posicion, negocioSlug: a.negocioSlug ?? '', enlace: a.enlace ?? '',
      conColor: !!a.colorFondo, colorFondo: a.colorFondo ?? '#1e2a5a', inicio: a.inicio ?? '', fin: a.fin ?? '',
      orden: a.orden, activo: a.activo,
    }, a.imagenUrl);
  }

  protected cancelar(): void {
    this.editando.set(null);
    this.error.set(null);
  }

  protected cambiarImagen(url: string | null): void {
    this.imagen.set(url);
  }

  /** Al elegir un negocio sin enlace todavía, el enlace lleva a su página. */
  protected sugerirEnlace(): void {
    const { negocioSlug, enlace } = this.form.getRawValue();
    if (negocioSlug && !enlace.trim()) this.form.controls.enlace.setValue('/' + negocioSlug);
  }

  protected guardar(): void {
    const v = this.form.getRawValue();
    if (!v.titulo.trim()) return this.error.set('El título es obligatorio.');
    if (v.inicio && v.fin && v.fin < v.inicio) return this.error.set('La fecha final debe ser igual o posterior a la inicial.');
    const datos: AnuncioEdicion = {
      titulo: v.titulo.trim(),
      texto: v.texto.trim() || null,
      imagenUrl: this.imagen(),
      enlace: v.enlace.trim() || null,
      negocioSlug: v.negocioSlug || null,
      colorFondo: v.conColor ? v.colorFondo : null,
      posicion: v.posicion,
      inicio: v.inicio || null,
      fin: v.fin || null,
      activo: v.activo,
      orden: Number(v.orden) || 0,
    };
    const id = this.editando();
    this.error.set(null);
    this.guardando.set(true);
    (id ? this.api.guardarAnuncio(id, datos) : this.api.crearAnuncio(datos))
      .pipe(finalize(() => this.guardando.set(false)))
      .subscribe({
        next: (a) => {
          this.editando.set(null);
          this.exito.set(id ? `Se guardó «${a.titulo}».` : `Se creó «${a.titulo}».`);
          this.anuncios.reload();
        },
        error: (e) => this.error.set(mensajeDeError(e)),
      });
  }

  protected alternar(a: AnuncioAdmin): void {
    this.ocupado.set(a.id);
    this.api
      .activarAnuncio(a.id, !a.activo)
      .pipe(finalize(() => this.ocupado.set(null)))
      .subscribe({
        next: (n) => {
          this.exito.set(`${n.activo ? 'Se activó' : 'Se pausó'} «${n.titulo}».`);
          this.anuncios.reload();
        },
        error: (e) => this.error.set(mensajeDeError(e)),
      });
  }

  private abrir(id: number, valores: ValoresAnuncio, imagen: string | null): void {
    this.form.reset(valores);
    this.valores.set(this.form.getRawValue());
    this.imagen.set(imagen);
    this.error.set(null);
    this.exito.set(null);
    this.editando.set(id);
  }
}
