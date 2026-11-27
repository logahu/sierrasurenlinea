import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FotoCampo } from './foto-campo';
import { NegocioTabs } from './negocio-tabs';
import { finalize } from 'rxjs';
import { NegocioAdmin, NegocioEdicion } from './admin.model';
import { AdminApi } from './admin.api';
import { mensajeDeError } from './autorizacion';
import { SesionService } from './sesion';
import { MapaUbicacion } from '../mapa/mapa-ubicacion';
import { Punto, puntoDe } from '../mapa/ubicacion';
import { CatalogoService } from '../catalogo/catalogo.service';
import { ColoniasService, agrupar } from '../colonias/colonias';
import { COLORES_SUGERIDOS, colorSeVe } from '../color';

/** Muestra el número como se ve en México: 55 4048 5363 (sin el 52). */
export function whatsappLegible(numero: string): string {
  const d = numero.replace(/\D/g, '');
  const local =
    d.length === 10 ? d : d.length === 12 && d.startsWith('52') ? d.slice(2) : d.length === 13 && d.startsWith('521') ? d.slice(3) : null;
  if (!local) return d;
  return local.startsWith('55') || local.startsWith('33') || local.startsWith('81')
    ? `${local.slice(0, 2)} ${local.slice(2, 6)} ${local.slice(6)}`
    : `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
}

/** Validación rápida en pantalla; el backend vuelve a validar y normaliza. */
export function whatsappValido(texto: string): boolean {
  const d = texto.replace(/\D/g, '');
  return d.length === 10 || (d.length >= 11 && d.length <= 15);
}

@Component({
  selector: 'app-editar-negocio',
  imports: [ReactiveFormsModule, NegocioTabs, FotoCampo, MapaUbicacion],
  styles: `
    .atencion { display: flex; border: 1px solid var(--linea); border-radius: 999px; overflow: hidden; margin-bottom: .4rem; }
    .atencion button { flex: 1; border: 0; background: var(--superficie); color: var(--tinta); font: inherit; font-weight: 600; padding: .55rem .5rem; cursor: pointer; }
    .atencion button.elegida { background: var(--follaje); color: #fff; }
    .campo-mapa { display: grid; gap: .3rem; font-weight: 600; font-size: .9rem; }
    .campo-mapa small { font-weight: 400; color: var(--tinta-suave); }
    .nota-atencion { margin: .2rem 0 0; color: var(--tinta-suave); font-size: .92rem; }
    .campo-color { border: 0; padding: 0; margin: 0; display: grid; gap: .5rem; min-width: 0; }
    .campo-color legend { font-weight: 600; font-size: .92rem; padding: 0; margin-bottom: .4rem; }
    .colores { display: flex; flex-wrap: wrap; gap: .45rem; align-items: center; }
    .color { width: 2.4rem; height: 2.4rem; border-radius: 50%; border: 3px solid var(--superficie); box-shadow: 0 0 0 1px var(--linea); cursor: pointer; padding: 0; }
    .color[aria-pressed='true'] { box-shadow: 0 0 0 3px var(--tinta); }
    .color:focus-visible { outline: 3px solid var(--follaje); outline-offset: 2px; }
    .color-otro { display: inline-flex !important; align-items: center; gap: .35rem; padding: .2rem .7rem .2rem .3rem; border: 1px dashed var(--linea); border-radius: 999px; font-size: .85rem; font-weight: 600; }
    .color-otro input { width: 1.8rem; height: 1.8rem; padding: 0; border: 0; background: none; }
    .color-aviso { margin: 0 !important; }
    .vista-color { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .5rem; }
    .vista { display: flex; padding: .7rem; border-radius: .75rem; }
    .vista.claro { background: #fbfbf8; border: 1px solid #e8ddd0; }
    .vista.oscuro { background: #141a33; }
    .fachada { flex: 1; padding: .8rem .5rem 1rem; color: #fff; text-align: center; font-family: var(--font-display); font-weight: 700; font-size: .95rem; overflow-wrap: anywhere; }
    .barra-guardar { position: sticky; bottom: 0; z-index: 2; padding: .75rem 0; background: var(--fondo); border-top: 1px solid var(--linea); }
    @media (max-width: 61.99rem) { .barra-guardar { bottom: calc(4.25rem + env(safe-area-inset-bottom)); } }
  `,
  template: `
    <app-negocio-tabs [slug]="slug()" [negocio]="negocio.value()" [seccion]="parte()" />

    @if (negocio.error(); as e) {
      <p class="error" role="alert">{{ mensaje(e) }}</p>
    } @else if (negocio.value(); as n) {

      <form class="ficha" [formGroup]="form" (ngSubmit)="guardar(n)" novalidate>
        @switch (parte()) {
          @case ('contacto') {
        <fieldset>
          <legend>Contacto</legend>
          <label>
            WhatsApp
            <input formControlName="whatsapp" inputmode="tel" autocomplete="off" placeholder="55 1234 5678" />
            <small>10 dígitos. Ahí llegan los pedidos de este negocio.</small>
          </label>
          <label>
            <span>Teléfono para llamadas <span class="opcional">(opcional)</span></span>
            <input formControlName="telefono" inputmode="tel" autocomplete="off" />
          </label>
          <label>
            <span>Horario <span class="opcional">(opcional)</span></span>
            <input formControlName="horario" maxlength="120" placeholder="Lun a sáb, 9:00 a 19:00" />
          </label>
        </fieldset>
        <fieldset>
          <legend>Ubicación y atención</legend>
          <div class="atencion" role="radiogroup" aria-label="¿Cómo atiende?">
            <button type="button" role="radio" [attr.aria-checked]="form.controls.atencionEnLocal.value"
                    [class.elegida]="form.controls.atencionEnLocal.value" (click)="elegirAtencion(true)">🏪 Tiene local</button>
            <button type="button" role="radio" [attr.aria-checked]="!form.controls.atencionEnLocal.value"
                    [class.elegida]="!form.controls.atencionEnLocal.value" (click)="elegirAtencion(false)">💻 Solo en línea</button>
          </div>
          @if (form.controls.atencionEnLocal.value) {
            <label>
              <span>Dirección <span class="opcional">(opcional)</span></span>
              <input formControlName="direccion" maxlength="200" placeholder="Av. Juárez 25, interior 3" />
            </label>
            <label>
              <span>Colonia o barrio <span class="opcional">(opcional)</span></span>
              <select formControlName="colonia">
                <option value="">Sin colonia</option>
                @for (g of grupos(); track g.tipo) {
                  <optgroup [label]="g.titulo">
                    @for (c of g.colonias; track c.id) { <option [value]="c.nombre">{{ c.nombre }}</option> }
                  </optgroup>
                }
                @if (coloniaFuera(); as c) { <option [value]="c">{{ c }}</option> }
              </select>
            </label>
            <label>
              <span>Referencias <span class="opcional">(opcional)</span></span>
              <input formControlName="referencias" maxlength="200" placeholder="Frente al parque, junto a la farmacia" />
            </label>
            <div class="campo-mapa">
              <span>Ubicación en el mapa <span class="opcional">(opcional)</span></span>
              <app-mapa-ubicacion [punto]="punto()" (puntoChange)="cambiarPunto($event)" para="negocio" />
              <small>Con el pin, los clientes ven el mapa y el botón «Cómo llegar» lleva justo ahí.</small>
            </div>
          } @else {
            <p class="nota-atencion">
              En la página del negocio se verá <strong>«Atención solo en línea»</strong>: los clientes piden por el sitio o por
              WhatsApp. La dirección y el mapa no se muestran (si ya los tenías, se guardan por si cambias de opción).
            </p>
          }
        </fieldset>
        @if (n.tipo === 'SERVICIO') {
          <fieldset>
            <legend>Mandados</legend>
            <label>
              Tope que adelanta el repartidor (MXN)
              <input type="number" formControlName="topeAdelanto" min="0" step="50" inputmode="numeric" />
              <small>En compras y pagos, el repartidor pone hasta esta cantidad de su bolsa. El cliente lo ve en el formulario.</small>
            </label>
          </fieldset>
        }
          }
          @case ('google') {
        <fieldset>
          <legend>Google</legend>
          <label>
            <span>Enlace de Google Maps <span class="opcional">(opcional)</span></span>
            <input formControlName="googleMapsUrl" type="url" inputmode="url" maxlength="300" placeholder="https://maps.app.goo.gl/…" />
            <small>En Google Maps abre el perfil del negocio → «Compartir» → «Copiar vínculo». Muestra el botón «Ver en Google Maps».</small>
          </label>
          <label>
            <span>Enlace para reseñas <span class="opcional">(opcional)</span></span>
            <input formControlName="googleResenasUrl" type="url" inputmode="url" maxlength="300" placeholder="https://g.page/r/…/review" />
            <small>En tu Perfil de Negocio de Google → «Pedir reseñas» → copia el enlace. Muestra «Déjanos tu reseña».</small>
          </label>
        </fieldset>
          }
          @default {
        <fieldset>
          <legend>Identidad y apariencia</legend>
          <div>
            <strong class="etiqueta-campo">Foto de portada</strong>
            <app-foto-campo [slug]="n.slug" [url]="portada() ?? n.portadaUrl" (urlChange)="cambiarPortada($event)" />
          </div>
          <label>
            Nombre
            <input formControlName="nombre" maxlength="80" />
            @if (!sesion.esDueno()) {
              <small>Solo el dueño puede cambiar el nombre.</small>
            }
          </label>
          <label>
            <span>Eslogan <span class="opcional">(opcional)</span></span>
            <input formControlName="eslogan" maxlength="140" />
          </label>
          <label>
            <span>Descripción <span class="opcional">(opcional)</span></span>
            <textarea formControlName="descripcion" rows="4" maxlength="600"></textarea>
          </label>
          @if (sesion.esDueno()) {
            <label>
              Giro
              <select formControlName="giro">
                @for (g of giros.value() ?? []; track g.slug) { <option [value]="g.slug">{{ g.nombre }}</option> }
              </select>
              <small>Su calle en la portada (por ejemplo, «Flores y regalos»).</small>
            </label>
            <fieldset class="campo-color">
              <legend>Color del negocio</legend>
              <div class="colores" role="group" aria-label="Colores sugeridos">
                @for (c of sugeridos; track c.hex) {
                  <button type="button" class="color" [style.background]="c.hex" [attr.aria-label]="c.nombre" [title]="c.nombre"
                          [attr.aria-pressed]="colorActual() === c.hex" (click)="elegirColor(c.hex)"></button>
                }
                <label class="color-otro"><input type="color" formControlName="colorPrimario" /> Otro</label>
              </div>
              @if (seVe(); as v) {
                @if (v.claro && v.oscuro) {
                  <p class="exito color-aviso">✓ Se distingue en modo claro y en modo oscuro.</p>
                } @else {
                  <p class="aviso color-aviso">
                    Este color casi no se ve en modo {{ !v.oscuro ? 'oscuro' : 'claro' }}: el punto, la franja y la fachada del
                    negocio se pierden con el fondo. Elige uno de los sugeridos o uno {{ !v.oscuro ? 'más claro' : 'más oscuro' }}.
                  </p>
                }
              }
              <div class="vista-color" aria-label="Vista previa en la portada">
                <span class="vista claro"><span class="fachada" [style.background]="colorActual()">{{ form.controls.nombre.value }}</span></span>
                <span class="vista oscuro"><span class="fachada" [style.background]="colorActual()">{{ form.controls.nombre.value }}</span></span>
              </div>
              <small>Vista previa en la portada: modo claro y oscuro.</small>
            </fieldset>
          }
        </fieldset>
          }
        }

        @if (error()) {
          <p class="error" role="alert">{{ error() }}</p>
        }
        @if (guardado()) {
          <p class="exito" role="status">Guardado. El sitio ya muestra los cambios.</p>
        }
        <div class="acciones barra-guardar">
          <button class="btn primario grande" type="submit" [disabled]="guardando() || form.pristine">
            {{ guardando() ? 'Guardando…' : 'Guardar cambios' }}
          </button>
          @if (parte() === 'contacto' && whatsappActual(); as w) {
            <span class="ayuda">WhatsApp actual: {{ w }}</span>
          }
        </div>
      </form>
    } @else {
      <p class="ayuda" role="status">Cargando…</p>
    }
  `,
})
export class EditarNegocio {
  readonly slug = input.required<string>();
  /** Parte de los datos: identidad (con giro y color), contacto (y ubicación) o google. */
  readonly seccion = input<string>('identidad');
  protected readonly parte = computed<'identidad' | 'contacto' | 'google'>(() => {
    const s = this.seccion();
    return s === 'contacto' || s === 'google' ? s : 'identidad';
  });
  protected readonly sugeridos = COLORES_SUGERIDOS;
  /** El color elegido (en el formulario, aún sin guardar). */
  private readonly colorForm = signal('#000000');
  protected readonly colorActual = computed(() => this.colorForm().toLowerCase());
  protected readonly seVe = computed(() => colorSeVe(this.colorActual()));

  protected elegirColor(hex: string): void {
    this.form.controls.colorPrimario.setValue(hex);
    this.form.markAsDirty();
    this.guardado.set(false);
  }

  protected readonly sesion = inject(SesionService);
  private readonly api = inject(AdminApi);
  private readonly catalogo = inject(CatalogoService);
  protected readonly mensaje = mensajeDeError;

  protected readonly negocio = rxResource({ params: () => this.slug(), stream: ({ params }) => this.api.negocio(params) });
  /** Giros para el selector (solo el dueño cambia el giro). */
  protected readonly giros = rxResource({
    params: () => (this.sesion.esDueno() ? true : undefined),
    stream: () => this.catalogo.giros(),
  });
  protected readonly whatsappActual = computed(() => {
    const n = this.negocio.value();
    return n ? whatsappLegible(n.whatsapp) : null;
  });

  protected readonly form = inject(FormBuilder).nonNullable.group({
    nombre: ['', [Validators.required, Validators.maxLength(80)]],
    eslogan: [''],
    descripcion: [''],
    whatsapp: ['', Validators.required],
    telefono: [''],
    direccion: [''],
    horario: [''],
    atencionEnLocal: [false],
    colonia: [''],
    referencias: [''],
    googleMapsUrl: [''],
    googleResenasUrl: [''],
    colorPrimario: ['#000000'],
    giro: [''],
    topeAdelanto: [null as number | null],
  });
  protected readonly guardando = signal(false);
  protected readonly guardado = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    this.form.controls.colorPrimario.valueChanges.subscribe((c) => this.colorForm.set(c));
    effect(() => {
      const n = this.negocio.value();
      if (n) this.cargar(n);
    });
  }

  /** Portada nueva subida en esta pantalla (todavía sin guardar). */
  protected readonly portada = signal<string | null>(null);

  protected cambiarPortada(url: string | null): void {
    this.portada.set(url);
    this.form.markAsDirty();
    this.guardado.set(false);
  }

  /** Pin del negocio (fuera del formulario). */
  protected readonly punto = signal<Punto | null>(null);
  private readonly colonias = inject(ColoniasService);
  protected readonly grupos = computed(() => agrupar(this.colonias.lista.hasValue() ? (this.colonias.lista.value() ?? []) : []));
  /** Si la colonia guardada ya no está en el catálogo, se ofrece igual para no perderla. */
  protected readonly coloniaFuera = computed(() => {
    const n = this.negocio.hasValue() ? this.negocio.value() : undefined;
    const c = n?.colonia;
    return c && !this.grupos().some((g) => g.colonias.some((x) => x.nombre === c)) ? c : null;
  });

  protected elegirAtencion(local: boolean): void {
    if (this.form.controls.atencionEnLocal.value === local) return;
    this.form.controls.atencionEnLocal.setValue(local);
    this.form.markAsDirty();
    this.guardado.set(false);
  }

  protected cambiarPunto(p: Punto | null): void {
    this.punto.set(p);
    this.form.markAsDirty();
    this.guardado.set(false);
  }

  private cargar(n: NegocioAdmin): void {
    this.portada.set(null);
    this.punto.set(puntoDe(n.lat, n.lng));
    this.form.reset({
      nombre: n.nombre,
      eslogan: n.eslogan ?? '',
      descripcion: n.descripcion ?? '',
      whatsapp: whatsappLegible(n.whatsapp),
      telefono: n.telefono ?? '',
      direccion: n.direccion ?? '',
      horario: n.horario ?? '',
      atencionEnLocal: !!n.atencionEnLocal,
      colonia: n.colonia ?? '',
      referencias: n.referencias ?? '',
      googleMapsUrl: n.googleMapsUrl ?? '',
      googleResenasUrl: n.googleResenasUrl ?? '',
      colorPrimario: n.colorPrimario,
      giro: n.giro ?? '',
      topeAdelanto: n.topeAdelanto,
    });
    if (this.sesion.esDueno()) this.form.controls.nombre.enable();
    else this.form.controls.nombre.disable();
  }

  protected guardar(n: NegocioAdmin): void {
    this.guardado.set(false);
    const v = this.form.getRawValue();
    if (!v.nombre.trim()) return this.error.set('El nombre es obligatorio.');
    if (!whatsappValido(v.whatsapp)) return this.error.set('El WhatsApp debe tener 10 dígitos.');
    if (v.topeAdelanto !== null && (!Number.isFinite(Number(v.topeAdelanto)) || Number(v.topeAdelanto) < 0)) {
      return this.error.set('El tope debe ser 0 o más.');
    }
    this.error.set(null);
    this.guardando.set(true);
    const p = this.punto();
    const datos: NegocioEdicion = {
      ...v,
      colonia: v.colonia || null,
      referencias: v.referencias.trim() || null,
      googleMapsUrl: v.googleMapsUrl.trim() || null,
      googleResenasUrl: v.googleResenasUrl.trim() || null,
      lat: p?.lat ?? null,
      lng: p?.lng ?? null,
      portadaUrl: this.portada() ?? n.portadaUrl,
      giro: v.giro || null,
    };
    this.api
      .guardarNegocio(n.slug, datos)
      .pipe(finalize(() => this.guardando.set(false)))
      .subscribe({
        next: (guardado) => {
          this.negocio.set(guardado);
          this.guardado.set(true);
        },
        error: (e) => this.error.set(mensajeDeError(e)),
      });
  }
}
