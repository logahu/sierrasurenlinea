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
                </form>
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
