import { Component, inject, input, model, signal } from '@angular/core';
import { mensajeDeError } from './autorizacion';
import { FotosService } from './fotos';

/**
 * Foto de un producto o portada: muestra la actual y permite cambiarla desde la
 * cámara o la galería. La nueva URL queda en `url` y se guarda con el formulario.
 */
@Component({
  selector: 'app-foto-campo',
  template: `
    <div class="foto-campo">
      @if (url() || respaldo()) {
        <img [src]="url() || respaldo()" alt="" width="120" height="120" />
      } @else {
        <span class="sin-foto" aria-hidden="true">📷</span>
      }
      <div>
        <label class="btn secundario" [class.deshabilitado]="subiendo()">
          {{ subiendo() ? 'Subiendo…' : url() ? 'Cambiar foto' : 'Subir foto' }}
          <input type="file" accept="image/*" (change)="elegir($event)" [disabled]="subiendo()" hidden />
        </label>
        <small>Se recorta cuadrada desde el centro y se comprime antes de subir.</small>
        @if (error()) {
          <small class="error-foto" role="alert">{{ error() }}</small>
        }
      </div>
    </div>
  `,
})
export class FotoCampo {
  readonly slug = input.required<string>();
  /** Imagen que se muestra si todavía no hay foto. */
  readonly respaldo = input<string>('');
  readonly url = model<string | null>(null);

  private readonly fotos = inject(FotosService);
  protected readonly subiendo = signal(false);
  protected readonly error = signal<string | null>(null);

  protected async elegir(evento: Event): Promise<void> {
    const entrada = evento.target as HTMLInputElement;
    const archivo = entrada.files?.[0];
    entrada.value = '';
    if (!archivo) return;
    this.error.set(null);
    this.subiendo.set(true);
    try {
      this.url.set(await this.fotos.subir(this.slug(), archivo));
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : mensajeDeError(e));
    } finally {
      this.subiendo.set(false);
    }
  }
}
