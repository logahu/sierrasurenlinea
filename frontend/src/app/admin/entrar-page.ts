import { Component, DestroyRef, inject, input, signal } from '@angular/core';
import { VerContrasena } from '../compartido/ver-contrasena';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { mensajeDeError } from './autorizacion';
import { SesionService } from './sesion';

@Component({
  selector: 'app-entrar-page',
  imports: [ReactiveFormsModule, RouterLink, VerContrasena],
  template: `
    <section class="entrar">
      <h1>Panel de Sierra Sur en Línea</h1>
      <p class="ayuda">Entra con tu teléfono (o tu correo) y la contraseña que te dieron.</p>
      @if (vencida()) {
        <p class="aviso" role="status">Tu sesión terminó. Vuelve a entrar.</p>
      }
      <form [formGroup]="form" (ngSubmit)="entrar()" novalidate>
        <label>
          Teléfono o correo
          <input type="text" formControlName="correo" autocomplete="username" required placeholder="951 123 4567" />
        </label>
        <label>
          Contraseña
          <input type="password" verContrasena formControlName="contrasena" autocomplete="current-password" required />
        </label>
        @if (error()) {
          <p class="error" role="alert">{{ error() }}</p>
        }
        <button class="btn primario grande" type="submit" [disabled]="enviando()">
          {{ enviando() ? 'Entrando…' : 'Entrar' }}
        </button>
        @if (despertando()) {
          <p class="ayuda" role="status">El servidor estaba dormido y está despertando; puede tardar hasta un minuto.</p>
        }
      </form>
      <a class="volver-sitio" routerLink="/">‹ Volver al sitio</a>
    </section>
  `,
})
export class EntrarPage {
  /** ?volver=/admin/... : a dónde ir después de entrar. */
  readonly volver = input<string>();
  /** ?vencida=1 : se llegó aquí porque la sesión terminó. */
  readonly vencida = input<string>();

  private readonly sesion = inject(SesionService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    correo: ['', Validators.required],
    contrasena: ['', Validators.required],
  });
  protected readonly enviando = signal(false);
  protected readonly despertando = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    if (this.sesion.activa()) void this.router.navigateByUrl(this.sesion.inicio());
  }

  protected entrar(): void {
    if (this.form.invalid) {
      this.error.set('Escribe tu teléfono (o correo) y tu contraseña.');
      return;
    }
    this.error.set(null);
    this.enviando.set(true);
    // Render apaga el backend tras 15 minutos sin uso; la primera petición tarda.
    const aviso = setTimeout(() => this.despertando.set(true), 5000);
    this.destroyRef.onDestroy(() => clearTimeout(aviso));
    const { correo, contrasena } = this.form.getRawValue();
    this.sesion
      .entrar(correo, contrasena)
      .pipe(
        finalize(() => {
          clearTimeout(aviso);
          this.enviando.set(false);
          this.despertando.set(false);
        }),
      )
      .subscribe({
        next: () => {
          const destino = this.volver();
          void this.router.navigateByUrl(destino?.startsWith('/admin') ? destino : this.sesion.inicio());
        },
        error: (e) => {
          this.error.set(mensajeDeError(e));
          this.form.controls.contrasena.reset();
        },
      });
  }
}
