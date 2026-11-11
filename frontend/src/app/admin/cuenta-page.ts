import { Component, inject, signal } from '@angular/core';
import { VerContrasena } from '../compartido/ver-contrasena';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { mensajeDeError } from './autorizacion';
import { SesionService } from './sesion';

const MINIMO = 10;

@Component({
  selector: 'app-cuenta-page',
  imports: [ReactiveFormsModule, VerContrasena],
  template: `
    <header class="panel-titulo">
      <h1>Mi cuenta</h1>
      @if (sesion.usuario(); as u) {
        <p class="ayuda">{{ u.correo }} · {{ u.rol === 'DUENO' ? 'Administrador' : (u.rol === 'REPARTIDOR' ? 'Repartidor de ' : 'Encargado de ') + u.negocioNombre }}</p>
      }
    </header>
    <form class="ficha" [formGroup]="form" (ngSubmit)="cambiar()" novalidate>
      <fieldset>
        <legend>Cambiar contraseña</legend>
        <label>
          Contraseña actual
          <input type="password" verContrasena formControlName="actual" autocomplete="current-password" />
        </label>
        <label>
          Contraseña nueva
          <input type="password" verContrasena formControlName="nueva" autocomplete="new-password" />
          <small>Mínimo {{ minimo }} caracteres.</small>
        </label>
        <label>
          Repite la nueva
          <input type="password" verContrasena formControlName="repetida" autocomplete="new-password" />
        </label>
        @if (error()) {
          <p class="error" role="alert">{{ error() }}</p>
        }
        @if (listo()) {
          <p class="exito" role="status">Contraseña cambiada.</p>
        }
        <button class="btn primario grande" type="submit" [disabled]="enviando()">Cambiar contraseña</button>
      </fieldset>
    </form>
  `,
})
export class CuentaPage {
  protected readonly sesion = inject(SesionService);
  protected readonly minimo = MINIMO;
  protected readonly form = inject(FormBuilder).nonNullable.group({ actual: '', nueva: '', repetida: '' });
  protected readonly enviando = signal(false);
  protected readonly listo = signal(false);
  protected readonly error = signal<string | null>(null);

  protected cambiar(): void {
    const { actual, nueva, repetida } = this.form.getRawValue();
    this.listo.set(false);
    if (!actual) return this.error.set('Escribe tu contraseña actual.');
    if (nueva.length < MINIMO) return this.error.set(`La nueva debe tener al menos ${MINIMO} caracteres.`);
    if (nueva !== repetida) return this.error.set('Las dos contraseñas nuevas no coinciden.');
    this.error.set(null);
    this.enviando.set(true);
    this.sesion
      .cambiarContrasena(actual, nueva)
      .pipe(finalize(() => this.enviando.set(false)))
      .subscribe({
        next: () => {
          this.form.reset();
          this.listo.set(true);
        },
        error: (e) => this.error.set(mensajeDeError(e)),
      });
  }
}
