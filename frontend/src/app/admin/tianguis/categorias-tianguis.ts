import { Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { CampoAtributo, CategoriaTianguis, TipoCampo } from '../../tianguis/tianguis.model';
import { mensajeDeError } from '../autorizacion';
import { CategoriaEdicion, TianguisAdminApi } from './tianguis-admin.api';

const TIPOS: { valor: TipoCampo; texto: string }[] = [
  { valor: 'TEXTO', texto: 'Texto' }, { valor: 'NUMERO', texto: 'Número' }, { valor: 'OPCION', texto: 'Lista' }, { valor: 'SI_NO', texto: 'Sí / No' },
];

/** «Kilometraje» → «kilometraje»; «Estado de batería» → «estadoDeBateria». */
export function nombreDeCampo(etiqueta: string): string {
  const p = etiqueta.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9 ]/g, ' ').trim().split(/\s+/).filter(Boolean);
  return p.map((w, i) => (i === 0 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase())).join('').slice(0, 30);
}

/** Categorías del tianguis con sus campos (los que se piden al publicar). */
@Component({
  selector: 'app-categorias-tianguis',
  template: `
    @if (mensaje(); as m) { <p class="exito" role="status">{{ m }}</p> }
    @if (error(); as e) { <p class="error" role="alert">{{ e }}</p> }
    @if (edicion(); as c) {
      <form class="ficha" (submit)="$event.preventDefault(); guardar()">
        <h2>{{ editandoId() ? 'Editar categoría' : 'Nueva categoría' }}</h2>
        <label>Nombre <input maxlength="60" [value]="c.nombre" (input)="poner('nombre', $any($event.target).value)" /></label>
        <label>Slug (en la URL) <input maxlength="60" [value]="c.slug" (input)="poner('slug', $any($event.target).value)" /></label>
        <label>Tipo
          <select (change)="poner('tipo', $any($event.target).value)" [disabled]="!!editandoId() && conAnuncios()">
            <option value="ARTICULO" [selected]="c.tipo === 'ARTICULO'">Artículos (se venden; condición y foto obligatorias)</option>
            <option value="SERVICIO" [selected]="c.tipo === 'SERVICIO'">Servicios (sin condición; precio fijo, desde o a cotizar; fotos opcionales)</option>
          </select>
          @if (editandoId() && conAnuncios()) { <small class="opcional">No se cambia porque ya tiene anuncios.</small> }
        </label>
        <label>Icono <span class="opcional">(auto, moto, celular, mueble, herramienta, ropa, caja, oficio, belleza, clases, flete)</span>
          <input maxlength="30" [value]="c.icono ?? ''" (input)="poner('icono', $any($event.target).value)" /></label>
        <label>Orden <input type="number" [value]="c.orden" (input)="poner('orden', +$any($event.target).value)" /></label>
        <label class="en-linea"><input type="checkbox" [checked]="c.activa" (change)="poner('activa', $any($event.target).checked)" /> Activa (se ve en el tianguis)</label>
        <fieldset>
          <legend>Campos al publicar</legend>
          @for (f of c.campos; track $index; let i = $index) {
            <div class="campo-def">
              <label>Etiqueta <input maxlength="40" [value]="f.etiqueta" (input)="ponerCampo(i, { etiqueta: $any($event.target).value, nombre: f.nombre || nombreDeCampo($any($event.target).value) })" /></label>
              <label>Tipo
                <select (change)="ponerCampo(i, { tipo: $any($event.target).value })">
                  @for (t of tipos; track t.valor) { <option [value]="t.valor" [selected]="f.tipo === t.valor">{{ t.texto }}</option> }
                </select>
              </label>
              @if (f.tipo === 'OPCION') {
                <label class="ancho">Opciones (separadas por coma)
                  <input [value]="(f.opciones ?? []).join(', ')" (change)="ponerCampo(i, { opciones: separar($any($event.target).value) })" /></label>
              }
              <label>Unidad <span class="opcional">(km, cc, %)</span> <input maxlength="10" [value]="f.unidad ?? ''" (input)="ponerCampo(i, { unidad: $any($event.target).value || null })" /></label>
              <label class="en-linea"><input type="checkbox" [checked]="f.requerido" (change)="ponerCampo(i, { requerido: $any($event.target).checked })" /> Obligatorio</label>
              <button type="button" class="btn secundario" (click)="quitarCampo(i)">Quitar campo</button>
            </div>
          }
          <button type="button" class="btn secundario" (click)="agregarCampo()">＋ Agregar campo</button>
        </fieldset>
        <div class="acciones">
          <button class="btn primario" type="submit" [disabled]="ocupado()">Guardar</button>
          <button class="btn secundario" type="button" (click)="edicion.set(null)">Cancelar</button>
        </div>
      </form>
    } @else {
      <button type="button" class="btn secundario" (click)="nueva()">＋ Nueva categoría</button>
      <ul class="categorias">
        @for (c of categorias.value() ?? []; track c.id) {
          <li [class.inactiva]="!c.activa">
            <span><strong>{{ c.nombre }}</strong>@if (c.tipo === 'SERVICIO') { · servicio } · /tianguis/c/{{ c.slug }} · {{ c.anuncios }} anuncios @if (!c.activa) { · inactiva }</span>
            <span class="meta">{{ c.campos.length ? c.campos.map(etiqueta).join(', ') : 'Sin campos propios' }}</span>
            <button type="button" class="btn secundario" (click)="editar(c)">Editar</button>
          </li>
        }
      </ul>
    }
  `,
  styles: `
    .categorias { list-style: none; margin: .8rem 0 0; padding: 0; display: grid; gap: .5rem; }
    .categorias li { display: grid; gap: .2rem; padding: .7rem; border: 1px solid var(--linea); border-radius: var(--panel-radio); background: var(--superficie); }
    .categorias li.inactiva { opacity: .65; }
    .categorias .btn { justify-self: start; padding: .35rem .8rem; font-size: .85rem; }
    .meta { font-size: .85rem; color: var(--tinta-suave); }
    fieldset { border: 1px solid var(--linea); border-radius: var(--panel-radio); padding: .7rem; display: grid; gap: .7rem; }
    .campo-def { display: grid; grid-template-columns: 1fr 1fr; gap: .5rem; padding-bottom: .7rem; border-bottom: 1px dashed var(--linea); }
    .campo-def .ancho { grid-column: 1 / -1; }
    .acciones { display: flex; gap: .5rem; }
  `,
})
export class CategoriasTianguis {
  private readonly api = inject(TianguisAdminApi);
  readonly categorias = rxResource({ stream: () => this.api.categorias() });
  protected readonly tipos = TIPOS;
  protected readonly nombreDeCampo = nombreDeCampo;
  protected readonly edicion = signal<CategoriaEdicion | null>(null);
  protected readonly editandoId = signal<number | null>(null);
  /** La categoría en edición ya tiene anuncios: no se cambia entre artículo y servicio. */
  protected readonly conAnuncios = computed(
    () => ((this.categorias.value() ?? []).find((c) => c.id === this.editandoId())?.anuncios ?? 0) > 0,
  );
  protected readonly ocupado = signal(false);
  protected readonly mensaje = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  protected etiqueta = (c: CampoAtributo) => c.etiqueta;
  protected separar = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

  protected nueva(): void {
    this.editandoId.set(null);
    this.edicion.set({ nombre: '', slug: '', icono: null, orden: 50, activa: true, tipo: 'ARTICULO', campos: [] });
  }

  protected editar(c: CategoriaTianguis): void {
    this.editandoId.set(c.id);
    this.edicion.set({ nombre: c.nombre, slug: c.slug, icono: c.icono, orden: c.orden, activa: c.activa, tipo: c.tipo, campos: c.campos.map((x) => ({ ...x })) });
  }

  protected poner<K extends keyof CategoriaEdicion>(k: K, v: CategoriaEdicion[K]): void {
    this.edicion.update((c) => (c ? { ...c, [k]: v } : c));
  }

  protected ponerCampo(i: number, cambio: Partial<CampoAtributo>): void {
    this.edicion.update((c) => (c ? { ...c, campos: c.campos.map((f, j) => (j === i ? { ...f, ...cambio } : f)) } : c));
  }

  protected agregarCampo(): void {
    this.edicion.update((c) => (c ? { ...c, campos: [...c.campos, { nombre: '', etiqueta: '', tipo: 'TEXTO', requerido: false }] } : c));
  }

  protected quitarCampo(i: number): void {
    this.edicion.update((c) => (c ? { ...c, campos: c.campos.filter((_, j) => j !== i) } : c));
  }

  protected guardar(): void {
    const c = this.edicion();
    if (!c) return;
    const datos = { ...c, campos: c.campos.map((f) => ({ ...f, nombre: f.nombre || nombreDeCampo(f.etiqueta) })) };
    const id = this.editandoId();
    this.ocupado.set(true);
    this.error.set(null);
    (id ? this.api.editarCategoria(id, datos) : this.api.crearCategoria(datos)).subscribe({
      next: () => {
        this.ocupado.set(false);
        this.edicion.set(null);
        this.mensaje.set(`Categoría «${datos.nombre}» guardada.`);
        this.categorias.reload();
      },
      error: (e) => {
        this.ocupado.set(false);
        this.error.set(mensajeDeError(e));
      },
    });
  }
}
