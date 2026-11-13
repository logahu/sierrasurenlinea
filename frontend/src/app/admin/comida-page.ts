import { Component, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Observable, finalize } from 'rxjs';
import { precioConUnidad } from '../catalogo/contacto';
import { Platillo, Restaurante } from '../catalogo/catalogo.model';
import { AdminApi } from './admin.api';
import { mensajeDeError } from './autorizacion';
import { FotoCampo } from './foto-campo';
import { NegocioTabs } from './negocio-tabs';

const platilloNuevo = (): Partial<Platillo> => ({ nombre: '', descripcion: '', precio: undefined, disponible: true });

/**
 * Encarguitos → Comida a domicilio: los lugares de comida y sus menús.
 * El sitio solo muestra lugares visibles que tengan al menos un platillo disponible.
 */
@Component({
  selector: 'app-comida-page',
  imports: [FormsModule, NegocioTabs, FotoCampo],
  styles: `
    .opciones-admin { border: 1px dashed var(--linea); border-radius: .6rem; padding: .6rem .75rem; margin: -.2rem 0 .8rem; background: var(--superficie); display: grid; gap: .6rem; }
    .opciones-admin .ayuda { margin: 0; }
    .grupo-admin { border: 1px solid var(--linea); border-radius: .5rem; padding: .5rem .6rem; display: grid; gap: .4rem; margin: 0; }
    .grupo-cabeza, .opcion-admin { display: flex; flex-wrap: wrap; gap: .4rem; align-items: center; }
    .grupo-cabeza input:first-child { flex: 1 1 12rem; font-weight: 600; }
    .grupo-cabeza select { width: auto; }
    .maximo { width: 5rem; }
    .opcion-admin input:first-child { flex: 1 1 10rem; }
    .opcion-admin .extra { width: 6rem; }
    .quitar { color: #c92a2a; }
    .opcion-admin.inactivo input { text-decoration: line-through; color: var(--tinta-suave); }
  `,
  template: `
    <app-negocio-tabs [slug]="slug()" [negocio]="negocio.value()" seccion="comida" />

    <p class="ayuda">
      Lugares de comida para <strong>Comida a domicilio</strong>. Para que el cliente vea esta opción, actívala en
      <em>Lista del mandado</em>. Un lugar sin platillos disponibles no aparece en el sitio.
    </p>
    @if (aviso(); as a) { <p class="exito" role="status">{{ a }}</p> }
    @if (error(); as e) { <p class="error" role="alert">{{ e }}</p> }
    @if (lugares.error(); as e) { <p class="error" role="alert">{{ mensaje(e) }}</p> }

    <ul class="lista">
      @for (r of lugares.value() ?? []; track r.id) {
        <li class="fila-categoria" [class.inactivo]="!r.visible">
          <details [open]="abierto() === r.id" (toggle)="alAbrir(r.id, $event)">
            <summary>
              <strong>{{ r.nombre }}</strong>
              <span class="ayuda">
                {{ disponibles(r) }} de {{ r.platillos.length }} platillos disponibles · {{ r.visible ? 'a la vista' : 'oculto' }}
              </span>
            </summary>
            <form (ngSubmit)="guardarLugar(r)">
              <app-foto-campo [slug]="slug()" [url]="r.imagenUrl" (urlChange)="r.imagenUrl = $event" />
              <div class="dos-columnas">
                <label>Nombre <input name="nombre" [(ngModel)]="r.nombre" maxlength="80" /></label>
                <label>Orden <input name="orden" type="number" min="0" max="999" [(ngModel)]="r.orden" /></label>
              </div>
              <label><span>Descripción <span class="opcional">(opcional)</span></span>
                <input name="descripcion" [(ngModel)]="r.descripcion" maxlength="200" /></label>
              <div class="dos-columnas">
                <label><span>Horario <span class="opcional">(opcional)</span></span>
                  <input name="horario" [(ngModel)]="r.horario" maxlength="120" placeholder="Lun a Sáb 13:00 – 17:00" /></label>
                <label><span>Dirección <span class="opcional">(opcional)</span></span>
                  <input name="direccion" [(ngModel)]="r.direccion" maxlength="200" /></label>
              </div>
              <label class="en-linea"><input type="checkbox" name="visible" [(ngModel)]="r.visible" /> A la vista en el sitio</label>
              <div class="acciones"><button class="btn primario" type="submit" [disabled]="ocupado()">Guardar lugar</button></div>
            </form>

            <div class="menu-admin">
              <strong class="etiqueta-campo">Menú</strong>
              @for (p of r.platillos; track p.id) {
                <form class="platillo-admin" [class.inactivo]="!p.disponible" (ngSubmit)="guardarPlatillo(r, p)">
                  <input name="nombre" [(ngModel)]="p.nombre" maxlength="100" aria-label="Nombre del platillo" />
                  <input name="precio" type="number" min="0" step="0.5" [(ngModel)]="p.precio" aria-label="Precio" />
                  <input class="ancho" name="descripcion" [(ngModel)]="p.descripcion" maxlength="300"
                         placeholder="Descripción (opcional)" aria-label="Descripción" />
                  <label class="en-linea"><input type="checkbox" name="disponible" [(ngModel)]="p.disponible" /> Disponible</label>
                  <button class="btn secundario" type="submit" [disabled]="ocupado()">Guardar</button>
                  <button class="btn secundario" type="button" (click)="alternarOpciones(p)" [attr.aria-expanded]="opcionesDe() === p.id">
                    ⚙️ Opciones @if (p.opciones?.length) { ({{ p.opciones?.length }}) }
                  </button>
                </form>
                @if (opcionesDe() === p.id) {
                  <div class="opciones-admin">
                    <p class="ayuda">
                      Para que el cliente elija, por ejemplo, <strong>Carne</strong> (elige 1) o <strong>Extras</strong> (varias,
                      con precio). El precio extra se suma al del platillo. Si se acaba algo, desmarca «Hay».
                    </p>
                    @for (g of p.opciones ?? []; track $index; let gi = $index) {
                      <fieldset class="grupo-admin">
                        <div class="grupo-cabeza">
                          <input [(ngModel)]="g.nombre" [ngModelOptions]="{ standalone: true }" maxlength="40"
                                 placeholder="Nombre del grupo (ej. Carne)" aria-label="Nombre del grupo" />
                          <select [(ngModel)]="g.multiple" [ngModelOptions]="{ standalone: true }" aria-label="Cuántas se eligen">
                            <option [ngValue]="false">Elige 1</option>
                            <option [ngValue]="true">Varias</option>
                          </select>
                          @if (g.multiple) {
                            <input class="maximo" type="number" min="1" max="20" [(ngModel)]="g.maximo" [ngModelOptions]="{ standalone: true }"
                                   placeholder="Máx." aria-label="Máximo que se pueden elegir (vacío = sin límite)" />
                          }
                          <label class="en-linea"><input type="checkbox" [(ngModel)]="g.obligatorio" [ngModelOptions]="{ standalone: true }" /> Obligatorio</label>
                          <button type="button" class="enlace quitar" (click)="quitarGrupo(p, gi)">Quitar grupo</button>
                        </div>
                        @for (o of g.opciones; track $index; let oi = $index) {
                          <div class="opcion-admin" [class.inactivo]="!o.disponible">
                            <input [(ngModel)]="o.nombre" [ngModelOptions]="{ standalone: true }" maxlength="40" placeholder="Opción (ej. Pastor)" aria-label="Opción" />
                            <input class="extra" type="number" min="0" step="0.5" [(ngModel)]="o.precio" [ngModelOptions]="{ standalone: true }"
                                   aria-label="Precio extra" title="Precio extra (0 = sin costo)" />
                            <label class="en-linea"><input type="checkbox" [(ngModel)]="o.disponible" [ngModelOptions]="{ standalone: true }" /> Hay</label>
                            <button type="button" class="enlace quitar" (click)="g.opciones.splice(oi, 1)" [attr.aria-label]="'Quitar ' + o.nombre">✕</button>
                          </div>
                        }
                        <button type="button" class="enlace" (click)="g.opciones.push({ nombre: '', precio: 0, disponible: true })">＋ Opción</button>
                      </fieldset>
                    }
                    <div class="acciones-fila">
                      <button type="button" class="btn secundario" (click)="agregarGrupo(p)">＋ Grupo de opciones</button>
                      @if (conOpciones(r, p).length) {
                        <select (change)="copiarDe(r, p, $any($event.target).value); $any($event.target).value = ''" aria-label="Copiar grupos de otro platillo">
                          <option value="">⧉ Copiar grupos de…</option>
                          @for (x of conOpciones(r, p); track x.id) { <option [value]="x.id">{{ x.nombre }}</option> }
                        </select>
                      }
                      <button type="button" class="btn primario" (click)="guardarOpciones(r, p)" [disabled]="ocupado()">Guardar opciones</button>
                    </div>
                  </div>
                }
              }
              <form class="platillo-admin nuevo" (ngSubmit)="agregarPlatillo(r)">
                <input name="nombre" [(ngModel)]="nuevoPlatillo.nombre" maxlength="100" placeholder="Platillo nuevo" aria-label="Platillo nuevo" />
                <input name="precio" type="number" min="0" step="0.5" [(ngModel)]="nuevoPlatillo.precio" placeholder="$" aria-label="Precio" />
                <input class="ancho" name="descripcion" [(ngModel)]="nuevoPlatillo.descripcion" maxlength="300"
                       placeholder="Descripción (opcional)" aria-label="Descripción" />
                <button class="btn primario" type="submit" [disabled]="ocupado()">+ Agregar platillo</button>
              </form>
            </div>
          </details>
        </li>
      } @empty {
        @if (lugares.hasValue()) { <li class="ayuda">Todavía no hay lugares de comida.</li> }
      }
    </ul>

    <form class="ficha" (ngSubmit)="agregarLugar()">
      <fieldset>
        <legend>Agregar lugar de comida</legend>
        <label>Nombre <input name="nuevoNombre" [(ngModel)]="nuevoLugar.nombre" maxlength="80" placeholder="Ej. Fonda Doña Lupe" /></label>
        <label><span>Descripción <span class="opcional">(opcional)</span></span>
          <input name="nuevoDescripcion" [(ngModel)]="nuevoLugar.descripcion" maxlength="200" placeholder="Ej. Comida corrida y guisados" /></label>
        <label><span>Horario <span class="opcional">(opcional)</span></span>
          <input name="nuevoHorario" [(ngModel)]="nuevoLugar.horario" maxlength="120" /></label>
        <button class="btn primario grande" type="submit" [disabled]="ocupado()">Agregar lugar</button>
      </fieldset>
    </form>
  `,
})
export class ComidaPage {
  readonly slug = input.required<string>();
  private readonly api = inject(AdminApi);
  protected readonly mensaje = mensajeDeError;
  protected readonly precio = precioConUnidad;

  protected readonly negocio = rxResource({ params: () => this.slug(), stream: ({ params }) => this.api.negocio(params) });
  protected readonly lugares = rxResource({ params: () => this.slug(), stream: ({ params }) => this.api.restaurantes(params) });
  protected nuevoLugar: Partial<Restaurante> = { nombre: '', descripcion: '', horario: '' };
  protected nuevoPlatillo = platilloNuevo();
  protected readonly abierto = signal<number | null>(null);
  protected readonly ocupado = signal(false);
  protected readonly aviso = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  /** Platillo con el editor de opciones abierto. */
  protected readonly opcionesDe = signal<number | null>(null);

  protected alternarOpciones(p: Platillo): void {
    p.opciones ??= [];
    this.opcionesDe.set(this.opcionesDe() === p.id ? null : p.id);
  }

  protected agregarGrupo(p: Platillo): void {
    (p.opciones ??= []).push({ nombre: '', multiple: false, obligatorio: true, maximo: null, opciones: [{ nombre: '', precio: 0, disponible: true }] });
  }

  protected quitarGrupo(p: Platillo, i: number): void {
    p.opciones?.splice(i, 1);
  }

  /** Otros platillos del lugar que ya tienen opciones. */
  protected conOpciones(r: Restaurante, p: Platillo): Platillo[] {
    return r.platillos.filter((x) => x.id !== p.id && x.opciones?.length);
  }

  protected copiarDe(r: Restaurante, p: Platillo, id: string): void {
    const origen = r.platillos.find((x) => String(x.id) === id);
    if (!origen?.opciones) return;
    const copia = structuredClone(origen.opciones);
    const existentes = new Set((p.opciones ?? []).map((g) => g.nombre.trim().toLowerCase()));
    p.opciones = [...(p.opciones ?? []), ...copia.filter((g) => !existentes.has(g.nombre.trim().toLowerCase()))];
  }

  protected guardarOpciones(r: Restaurante, p: Platillo): void {
    const grupos = p.opciones ?? [];
    for (const g of grupos) {
      g.opciones = g.opciones.filter((o) => o.nombre?.trim());
      if (!g.nombre?.trim()) return this.falla('Cada grupo de opciones necesita nombre.');
      if (!g.opciones.length) return this.falla(`«${g.nombre}» necesita al menos una opción.`);
      if (g.opciones.some((o) => o.precio === null || o.precio === undefined || o.precio < 0)) {
        return this.falla(`Revisa los precios extra de «${g.nombre}».`);
      }
      if (!g.multiple || !g.maximo) g.maximo = null;
    }
    this.ejecutar(this.api.guardarPlatillo(this.slug(), r.id, p), () =>
      grupos.length ? `Opciones de ${p.nombre} guardadas.` : `${p.nombre} queda sin opciones.`,
    );
  }

  protected disponibles(r: Restaurante): number {
    return r.platillos.filter((p) => p.disponible).length;
  }

  protected alAbrir(id: number, e: Event): void {
    if ((e.target as HTMLDetailsElement).open) {
      if (this.abierto() !== id) this.nuevoPlatillo = platilloNuevo();
      this.abierto.set(id);
    }
  }

  protected guardarLugar(r: Restaurante): void {
    if (!r.nombre?.trim()) return this.falla('El nombre del lugar es obligatorio.');
    this.ejecutar(this.api.guardarRestaurante(this.slug(), r), () => `Guardado: ${r.nombre}.`);
  }

  protected agregarLugar(): void {
    if (!this.nuevoLugar.nombre?.trim()) return this.falla('Escribe el nombre del lugar.');
    this.ejecutar(this.api.guardarRestaurante(this.slug(), this.nuevoLugar), (r) => {
      this.nuevoLugar = { nombre: '', descripcion: '', horario: '' };
      this.abierto.set(r.id);
      return `Agregado: ${r.nombre}. Ahora agrégale su menú.`;
    });
  }

  protected guardarPlatillo(r: Restaurante, p: Platillo): void {
    if (!p.nombre?.trim() || p.precio === null || p.precio === undefined || p.precio < 0) {
      return this.falla('El platillo necesita nombre y precio.');
    }
    this.ejecutar(this.api.guardarPlatillo(this.slug(), r.id, p), () => `Guardado: ${p.nombre}.`);
  }

  protected agregarPlatillo(r: Restaurante): void {
    const p = this.nuevoPlatillo;
    if (!p.nombre?.trim() || p.precio === null || p.precio === undefined || p.precio < 0) {
      return this.falla('El platillo necesita nombre y precio.');
    }
    this.ejecutar(this.api.guardarPlatillo(this.slug(), r.id, p), (x) => {
      this.nuevoPlatillo = platilloNuevo();
      return `Agregado a ${r.nombre}: ${x.nombre} (${this.precio({ precio: x.precio, unidadPrecio: null })}).`;
    });
  }

  private ejecutar<T>(op: Observable<T>, exito: (r: T) => string): void {
    this.aviso.set(null);
    this.error.set(null);
    this.ocupado.set(true);
    op.pipe(finalize(() => this.ocupado.set(false))).subscribe({
      next: (r) => {
        this.aviso.set(exito(r));
        this.lugares.reload();
      },
      error: (e) => this.error.set(mensajeDeError(e)),
    });
  }

  private falla(texto: string): void {
    this.aviso.set(null);
    this.error.set(texto);
  }
}
