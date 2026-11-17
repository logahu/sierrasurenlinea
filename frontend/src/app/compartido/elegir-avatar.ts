import { Component, input, output, signal } from '@angular/core';
import { Avatar } from './avatar';
import { DIBUJOS, esFoto } from './avatares';

/**
 * Elegir avatar: uno de los dibujos, una foto (cámara o galería) o las iniciales.
 * Quien lo usa da la función `subir` (devuelve la URL de la foto ya subida) y guarda
 * lo que se emita en `elegido` («avatar:flor», la URL o null).
 */
@Component({
  selector: 'app-elegir-avatar',
  imports: [Avatar],
  template: `
    <div class="actual">
      <app-avatar class="grande" [avatar]="avatar()" [nombre]="nombre()" />
      <div class="botones">
        <label class="btn secundario subir" [class.deshabilitado]="subiendo() || ocupado()">
          {{ subiendo() ? 'Subiendo…' : esFoto(avatar()) ? 'Cambiar foto' : 'Subir una foto' }}
          <input type="file" accept="image/*" (change)="elegirFoto($event)" [disabled]="subiendo() || ocupado()" hidden />
        </label>
        @if (avatar()) {
          <button type="button" class="btn secundario" [disabled]="ocupado()" (click)="elegido.emit(null)">Usar mis iniciales</button>
        }
      </div>
    </div>
    @if (error(); as e) { <p class="error-avatar" role="alert">{{ e }}</p> }
    <fieldset class="dibujos">
      <legend>O elige un dibujo</legend>
      <div class="rejilla">
        @for (d of dibujos; track d.id) {
          <button type="button" class="dibujo" [class.elegido]="avatar() === 'avatar:' + d.id" [attr.aria-pressed]="avatar() === 'avatar:' + d.id"
                  [attr.aria-label]="d.nombre" [title]="d.nombre" [disabled]="ocupado()" (click)="elegido.emit('avatar:' + d.id)">
            <app-avatar [avatar]="'avatar:' + d.id" />
          </button>
        }
      </div>
    </fieldset>
  `,
  styles: `
    :host { display: grid; gap: .9rem; }
    .actual { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; }
    .grande { width: 5.5rem; height: 5.5rem; font-size: 1.8rem; box-shadow: 0 0 0 3px var(--superficie, #fff), 0 0 0 5px var(--linea, #ddd); }
    .botones { display: flex; flex-wrap: wrap; gap: .5rem; }
    .subir { cursor: pointer; }
    .deshabilitado { opacity: .6; pointer-events: none; }
    .dibujos { border: 0; padding: 0; margin: 0; min-width: 0; }
    .dibujos legend { padding: 0; margin-bottom: .5rem; font-weight: 600; font-size: .92rem; }
    .rejilla { display: grid; grid-template-columns: repeat(auto-fill, minmax(3.25rem, 1fr)); gap: .5rem; }
    .dibujo { display: grid; place-items: center; aspect-ratio: 1; padding: .2rem; border: 2px solid transparent; border-radius: 50%; background: none; cursor: pointer; }
    .dibujo app-avatar { width: 100%; height: 100%; }
    .dibujo:hover { border-color: var(--linea, #ddd); }
    .dibujo.elegido { border-color: var(--follaje, #2f6b4f); }
    .dibujo:focus-visible { outline: 3px solid var(--follaje, #2f6b4f); outline-offset: 2px; }
    .error-avatar { margin: 0; color: #c92a2a; font-size: .88rem; }
  `,
})
export class ElegirAvatar {
  readonly avatar = input<string | null | undefined>(null);
  readonly nombre = input<string | null | undefined>('');
  /** Sube la foto y devuelve su URL. */
  readonly subir = input.required<(archivo: File) => Promise<string>>();
  /** Mientras se guarda: no se puede elegir otro. */
  readonly ocupado = input(false);
  readonly elegido = output<string | null>();

  protected readonly dibujos = DIBUJOS;
  protected readonly esFoto = esFoto;
  protected readonly subiendo = signal(false);
  protected readonly error = signal<string | null>(null);

  protected async elegirFoto(evento: Event): Promise<void> {
    const entrada = evento.target as HTMLInputElement;
    const archivo = entrada.files?.[0];
    entrada.value = '';
    if (!archivo) return;
    this.error.set(null);
    this.subiendo.set(true);
    try {
      this.elegido.emit(await this.subir()(archivo));
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se pudo subir la foto. Intenta de nuevo.');
    } finally {
      this.subiendo.set(false);
    }
  }
}
