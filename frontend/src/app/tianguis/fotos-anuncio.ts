import { Component, input, model, signal } from '@angular/core';

/** Fotos de un anuncio: agregar (hasta 8), reordenar y quitar. La primera es la portada. En servicios son opcionales. */
@Component({
  selector: 'app-fotos-anuncio',
  template: `
    @if (fotos().length) {
      <ol class="fotos">
        @for (f of fotos(); track f; let i = $index) {
          <li>
            <img [src]="f" [alt]="'Foto ' + (i + 1)" width="120" height="90" />
            @if (i === 0) { <span class="portada">Portada</span> }
            <div class="botones">
              <button type="button" (click)="mover(i, -1)" [disabled]="i === 0" [attr.aria-label]="'Mover la foto ' + (i + 1) + ' antes'">←</button>
              <button type="button" (click)="quitar(i)" [attr.aria-label]="'Quitar la foto ' + (i + 1)">✕</button>
              <button type="button" (click)="mover(i, 1)" [disabled]="i === fotos().length - 1" [attr.aria-label]="'Mover la foto ' + (i + 1) + ' después'">→</button>
            </div>
          </li>
        }
      </ol>
    }
    @if (fotos().length < maximo) {
      <label class="agregar" [class.deshabilitado]="subiendo()">
        <span aria-hidden="true">📷</span>
        {{ subiendo() ? 'Subiendo ' + progreso() + '…' : fotos().length ? 'Agregar más fotos' : 'Agregar fotos' }}
        <input type="file" accept="image/*" multiple (change)="agregar($event)" [disabled]="subiendo()" class="solo-lector" />
      </label>
    }
    <small class="nota">
      @if (opcionales()) {
        Opcional: hasta {{ maximo }} fotos de tus trabajos o de ti. Sin fotos se muestra el dibujo de la categoría.
      } @else {
        De 1 a {{ maximo }} fotos reales del artículo.
      }
      La primera es la portada. Se reducen para cargar rápido.
    </small>
    @if (error(); as e) { <p class="error" role="alert">{{ e }}</p> }
  `,
  styles: `
    :host { display: grid; gap: .6rem; }
    .fotos { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(7.5rem, 1fr)); gap: .6rem; }
    li { position: relative; border: 1px solid var(--linea); border-radius: .7rem; overflow: hidden; background: var(--fondo-alt); }
    img { display: block; width: 100%; aspect-ratio: 4 / 3; object-fit: cover; }
    .portada { position: absolute; top: .3rem; left: .3rem; font-size: .7rem; font-weight: 800; padding: .15rem .45rem; border-radius: 999px; background: #2f6b4f; color: #fff; }
    .botones { display: flex; justify-content: space-between; padding: .25rem; }
    .botones button { border: 1px solid var(--linea); background: var(--superficie); color: var(--tinta); border-radius: .4rem; min-width: 2rem; min-height: 2rem; cursor: pointer; }
    .botones button:disabled { opacity: .35; cursor: default; }
    .agregar { display: inline-flex; align-items: center; gap: .5rem; justify-self: start; padding: .7rem 1.1rem; border-radius: 999px;
      border: 2px dashed var(--follaje); color: var(--tinta); font-weight: 700; cursor: pointer; }
    .agregar:focus-within { outline: 3px solid var(--follaje); outline-offset: 2px; }
    .agregar.deshabilitado { opacity: .6; cursor: progress; }
    .solo-lector { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
    .nota { color: var(--tinta-suave); }
    .error { color: #b42318; font-weight: 600; margin: 0; }
    @media (prefers-color-scheme: dark) { .error { color: #ff9b8f; } }
  `,
})
export class FotosAnuncio {
  /** Servicios: se puede publicar sin fotos. */
  readonly opcionales = input(false);
  readonly fotos = model<string[]>([]);
  /** Sube un archivo y devuelve su URL pública. */
  readonly subir = input.required<(archivo: File) => Promise<string>>();
  protected readonly maximo = 8;
  protected readonly subiendo = signal(false);
  protected readonly progreso = signal('');
  protected readonly error = signal<string | null>(null);

  protected async agregar(ev: Event): Promise<void> {
    const entrada = ev.target as HTMLInputElement;
    const archivos = Array.from(entrada.files ?? []).slice(0, this.maximo - this.fotos().length);
    entrada.value = '';
    if (!archivos.length) return;
    this.subiendo.set(true);
    this.error.set(null);
    try {
      for (const [i, a] of archivos.entries()) {
        this.progreso.set(`${i + 1} de ${archivos.length}`);
        const url = await this.subir()(a);
        this.fotos.update((l) => [...l, url]);
      }
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se pudo subir la foto.');
    } finally {
      this.subiendo.set(false);
    }
  }

  protected mover(i: number, d: number): void {
    this.fotos.update((l) => {
      const c = [...l];
      [c[i], c[i + d]] = [c[i + d], c[i]];
      return c;
    });
  }

  protected quitar(i: number): void {
    this.fotos.update((l) => l.filter((_, j) => j !== i));
  }
}
