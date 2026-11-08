import { Component, inject, input, model, signal } from '@angular/core';
import { mensajeDeError } from './autorizacion';
import { FotosService } from './fotos';

export const MAX_GALERIA = 8;

/** Fotos adicionales de un producto: agregar varias de una vez, quitar y mover. */
@Component({
  selector: 'app-galeria-campo',
  template: `
    <div class="galeria-campo">
      @if (fotos().length) {
        <ul>
          @for (f of fotos(); track f; let i = $index) {
            <li>
              <img [src]="f" alt="" width="88" height="88" />
              <div class="botones">
                <button type="button" (click)="mover(i, -1)" [disabled]="i === 0" aria-label="Mover antes">←</button>
                <button type="button" (click)="quitar(i)" aria-label="Quitar foto">✕</button>
                <button type="button" (click)="mover(i, 1)" [disabled]="i === fotos().length - 1" aria-label="Mover después">→</button>
              </div>
            </li>
          }
        </ul>
      }
      @if (fotos().length < maximo) {
        <label class="btn secundario" [class.deshabilitado]="subiendo()">
          {{ subiendo() ? 'Subiendo ' + progreso() + '…' : '+ Agregar fotos' }}
          <input type="file" accept="image/*" multiple (change)="agregar($event)" [disabled]="subiendo()" hidden />
        </label>
      }
      <small>Hasta {{ maximo }} fotos además de la principal. Se recortan cuadradas y se comprimen.</small>
      @if (error()) { <small class="error-foto" role="alert">{{ error() }}</small> }
    </div>
  `,
})
export class GaleriaCampo {
  readonly slug = input.required<string>();
  readonly fotos = model<string[]>([]);
  protected readonly maximo = MAX_GALERIA;

  private readonly servicio = inject(FotosService);
  protected readonly subiendo = signal(false);
  protected readonly progreso = signal('');
  protected readonly error = signal<string | null>(null);

  protected async agregar(evento: Event): Promise<void> {
    const entrada = evento.target as HTMLInputElement;
    const archivos = [...(entrada.files ?? [])].slice(0, MAX_GALERIA - this.fotos().length);
    entrada.value = '';
    if (!archivos.length) return;
    this.error.set(null);
    this.subiendo.set(true);
    try {
      for (const [i, archivo] of archivos.entries()) {
        this.progreso.set(`${i + 1} de ${archivos.length}`);
        const url = await this.servicio.subir(this.slug(), archivo);
        this.fotos.update((lista) => [...lista, url]);
      }
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : mensajeDeError(e));
    } finally {
      this.subiendo.set(false);
    }
  }

  protected quitar(i: number): void {
    this.fotos.update((lista) => lista.filter((_, j) => j !== i));
  }

  protected mover(i: number, paso: number): void {
    this.fotos.update((lista) => {
      const copia = [...lista];
      [copia[i], copia[i + paso]] = [copia[i + paso], copia[i]];
      return copia;
    });
  }
}
