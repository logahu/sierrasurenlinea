import { Component, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Observable, finalize } from 'rxjs';
import { IconoEncargo, TipoEncargo } from '../catalogo/catalogo.model';
import { AdminApi } from './admin.api';
import { mensajeDeError } from './autorizacion';
import { NegocioTabs } from './negocio-tabs';

export const ICONOS: { id: IconoEncargo; nombre: string }[] = [
  { id: 'bolsa', nombre: 'Bolsa (súper)' },
  { id: 'caja', nombre: 'Caja (paquete)' },
  { id: 'recibo', nombre: 'Recibo (pagos)' },
  { id: 'moto', nombre: 'Moto (viaje)' },
  { id: 'pastilla', nombre: 'Pastilla (farmacia)' },
  { id: 'llave', nombre: 'Llave (trámites)' },
  { id: 'estrella', nombre: 'Estrella (otro)' },
];

/** Una opción nueva, lista para llenar. */
export function opcionNueva(): Omit<TipoEncargo, 'id'> {
  return {
    titulo: '', ayuda: '', ejemplo: '', etiquetaRecoger: 'Dónde empezamos (opcional)',
    recogerObligatorio: false, manejaDinero: false, modo: 'MANDADO', icono: 'estrella',
    soloProgramado: false, visible: true,
  };
}

/**
 * Las tarjetas de "Tu lista del mandado" de Encarguitos: qué opciones ve el cliente,
 * en qué orden y cómo se comporta cada una (mandado o viaje en moto).
 */
@Component({
  selector: 'app-tipos-encargo-page',
  imports: [FormsModule, NegocioTabs],
  template: `
    <app-negocio-tabs [slug]="slug()" [negocio]="negocio.value()" seccion="lista" />

    <p class="ayuda">
      Son las tarjetas de <strong>¿Qué necesitas?</strong> en la página. Las ocultas no se ven en el sitio.
      Para un viaje en moto, sus precios son las tarifas con unidad <em>por viaje</em>.
    </p>
    @if (aviso(); as a) { <p class="exito" role="status">{{ a }}</p> }
    @if (error(); as e) { <p class="error" role="alert">{{ e }}</p> }
    @if (tipos.error(); as e) { <p class="error" role="alert">{{ mensaje(e) }}</p> }

    <ul class="lista">
      @for (t of tipos.value() ?? []; track t.id) {
        <li class="fila-categoria" [class.inactivo]="!t.visible">
          <details>
            <summary>
              <strong>{{ t.titulo }}</strong>
              <span class="ayuda">
                {{ t.modo === 'VIAJE' ? 'Viaje en moto' : 'Mandado' }} · orden {{ t.orden }}
                · {{ t.visible ? 'a la vista' : 'oculta' }}
              </span>
            </summary>
            <form (ngSubmit)="guardar(t)">
              <div class="dos-columnas">
                <label>Título <input name="titulo" [(ngModel)]="t.titulo" maxlength="60" required /></label>
                <label>Orden <input name="orden" type="number" min="0" max="999" [(ngModel)]="t.orden" /></label>
              </div>
              <label><span>Texto corto <span class="opcional">(debajo del título)</span></span>
                <input name="ayuda" [(ngModel)]="t.ayuda" maxlength="80" /></label>
              <label><span>Ejemplo <span class="opcional">(aparece dentro del campo de texto)</span></span>
                <input name="ejemplo" [(ngModel)]="t.ejemplo" maxlength="200" /></label>
              <div class="dos-columnas">
                <label>Tipo
                  <select name="modo" [(ngModel)]="t.modo">
                    <option value="MANDADO">Mandado (llevar cosas)</option>
                    <option value="VIAJE">Viaje en moto (llevar personas)</option>
                  </select>
                </label>
                <label>Ícono
                  <select name="icono" [(ngModel)]="t.icono">
                    @for (i of iconos; track i.id) { <option [value]="i.id">{{ i.nombre }}</option> }
                  </select>
                </label>
              </div>
              <label>Etiqueta de "dónde empezamos"
                <input name="etiquetaRecoger" [(ngModel)]="t.etiquetaRecoger" maxlength="60" /></label>
              <label class="en-linea"><input type="checkbox" name="recogerObligatorio" [(ngModel)]="t.recogerObligatorio" />
                Pedir obligatoriamente dónde empezamos</label>
              @if (t.modo === 'MANDADO') {
                <label class="en-linea"><input type="checkbox" name="manejaDinero" [(ngModel)]="t.manejaDinero" />
                  Implica comprar o pagar algo (pregunta quién paga)</label>
              }
              <label class="en-linea"><input type="checkbox" name="soloProgramado" [(ngModel)]="t.soloProgramado" />
                Solo con reservación (sin "lo antes posible")</label>
              <label class="en-linea"><input type="checkbox" name="visible" [(ngModel)]="t.visible" />
                A la vista en el sitio</label>
              <div class="acciones">
                <button class="btn primario" type="submit" [disabled]="ocupado()">Guardar</button>
              </div>
            </form>
          </details>
        </li>
      }
    </ul>

    <form class="ficha" (ngSubmit)="crear()">
      <fieldset>
        <legend>Agregar opción</legend>
        <div class="dos-columnas">
          <label>Título <input name="nuevoTitulo" [(ngModel)]="nueva.titulo" maxlength="60" placeholder="Ej. Farmacia" /></label>
          <label>Ícono
            <select name="nuevoIcono" [(ngModel)]="nueva.icono">
              @for (i of iconos; track i.id) { <option [value]="i.id">{{ i.nombre }}</option> }
            </select>
          </label>
        </div>
        <label><span>Texto corto <span class="opcional">(opcional)</span></span>
          <input name="nuevoAyuda" [(ngModel)]="nueva.ayuda" maxlength="80" placeholder="Ej. Medicinas con o sin receta" /></label>
        <label>Tipo
          <select name="nuevoModo" [(ngModel)]="nueva.modo">
            <option value="MANDADO">Mandado (llevar cosas)</option>
            <option value="VIAJE">Viaje en moto (llevar personas)</option>
          </select>
        </label>
        <small>Después de agregarla puedes ajustar el resto de sus textos arriba.</small>
        <button class="btn primario grande" type="submit" [disabled]="ocupado()">Agregar opción</button>
      </fieldset>
    </form>
  `,
})
export class TiposEncargoPage {
  readonly slug = input.required<string>();
  private readonly api = inject(AdminApi);
  protected readonly mensaje = mensajeDeError;
  protected readonly iconos = ICONOS;

  protected readonly negocio = rxResource({ params: () => this.slug(), stream: ({ params }) => this.api.negocio(params) });
  protected readonly tipos = rxResource({ params: () => this.slug(), stream: ({ params }) => this.api.tiposEncargo(params) });
  protected nueva = opcionNueva();
  protected readonly ocupado = signal(false);
  protected readonly aviso = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  protected guardar(t: TipoEncargo): void {
    if (!t.titulo?.trim()) return this.falla('El título es obligatorio.');
    const { id, ...datos } = t;
    this.ejecutar(this.api.editarTipoEncargo(this.slug(), id, datos), (r) => `Guardada: ${r.titulo}.`);
  }

  protected crear(): void {
    if (!this.nueva.titulo.trim()) return this.falla('Escribe el título de la opción.');
    const datos = { ...this.nueva };
    if (datos.modo === 'VIAJE') {
      datos.etiquetaRecoger = 'Dónde te recogemos';
      datos.recogerObligatorio = true;
    }
    this.ejecutar(this.api.crearTipoEncargo(this.slug(), datos), (r) => {
      this.nueva = opcionNueva();
      return `Agregada: ${r.titulo}.`;
    });
  }

  private ejecutar(op: Observable<TipoEncargo>, exito: (r: TipoEncargo) => string): void {
    this.aviso.set(null);
    this.error.set(null);
    this.ocupado.set(true);
    op.pipe(finalize(() => this.ocupado.set(false))).subscribe({
      next: (r) => {
        this.aviso.set(exito(r));
        this.tipos.reload();
      },
      error: (e) => this.error.set(mensajeDeError(e)),
    });
  }

  private falla(texto: string): void {
    this.aviso.set(null);
    this.error.set(texto);
  }
}
