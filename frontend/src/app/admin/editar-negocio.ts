import { RouterLink } from '@angular/router';
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
import { ColoniasService, agrupar } from '../colonias/colonias';

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
  imports: [ReactiveFormsModule, NegocioTabs, FotoCampo, RouterLink, MapaUbicacion],
  styles: `
    .atencion { display: flex; border: 1px solid var(--linea); border-radius: 999px; overflow: hidden; margin-bottom: .4rem; }
    .atencion button { flex: 1; border: 0; background: var(--superficie); color: var(--tinta); font: inherit; font-weight: 600; padding: .55rem .5rem; cursor: pointer; }
    .atencion button.elegida { background: var(--follaje); color: #fff; }
    .campo-mapa { display: grid; gap: .3rem; font-weight: 600; font-size: .9rem; }
    .campo-mapa small { font-weight: 400; color: var(--tinta-suave); }
    .nota-atencion { margin: .2rem 0 0; color: var(--tinta-suave); font-size: .92rem; }
  `,
  template: `
    <app-negocio-tabs [slug]="slug()" [negocio]="negocio.value()" seccion="datos" />

    @if (negocio.error(); as e) {
      <p class="error" role="alert">{{ mensaje(e) }}</p>
    } @else if (negocio.value(); as n) {

      <form class="ficha" [formGroup]="form" (ngSubmit)="guardar(n)" novalidate>
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

        <fieldset>
          <legend>Presentación</legend>
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
            <label class="en-linea">
              <input type="color" formControlName="colorPrimario" />
              Color del negocio
            </label>
            <p class="ayuda">
              Visibilidad:
              <strong>{{ n.estado === 'PUBLICO' ? 'Pública' : n.estado === 'PRUEBAS' ? '🧪 En pruebas (solo probadores)' : 'Oculto' }}</strong>
              · se cambia en <a routerLink="/admin/visibilidad">En el sitio</a>.
            </p>
          }
        </fieldset>

        @if (error()) {
          <p class="error" role="alert">{{ error() }}</p>
        }
        @if (guardado()) {
          <p class="exito" role="status">Guardado. El sitio ya muestra los cambios.</p>
        }
        <div class="acciones">
          <button class="btn primario grande" type="submit" [disabled]="guardando() || form.pristine">
            {{ guardando() ? 'Guardando…' : 'Guardar cambios' }}
          </button>
          @if (whatsappActual(); as w) {
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

  protected readonly sesion = inject(SesionService);
  private readonly api = inject(AdminApi);
  protected readonly mensaje = mensajeDeError;

  protected readonly negocio = rxResource({ params: () => this.slug(), stream: ({ params }) => this.api.negocio(params) });
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
    colorPrimario: ['#000000'],
    topeAdelanto: [null as number | null],
  });
  protected readonly guardando = signal(false);
  protected readonly guardado = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
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
      colorPrimario: n.colorPrimario,
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
      lat: p?.lat ?? null,
      lng: p?.lng ?? null,
      portadaUrl: this.portada() ?? n.portadaUrl,
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
