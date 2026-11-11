import { Component, DestroyRef, inject, input, signal } from '@angular/core';
import { VerContrasena } from '../compartido/ver-contrasena';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { mensajeDeError } from '../admin/autorizacion';
import { telefonoValido } from '../catalogo/encargo';
import { ClienteSesionService } from './cliente-sesion';
import { MINIMO_CONTRASENA } from './cuenta.model';
import { destinoSeguro } from './destino';

@Component({
  selector: 'app-registro-page',
  imports: [ReactiveFormsModule, RouterLink, VerContrasena],
  styleUrl: './cuenta.scss',
  template: `
    <section class="tarjeta-cuenta">
      <h1>Crea tu cuenta</h1>
      <p class="intro">
        Para hacer pedidos te pedimos una cuenta. Así cada pedido llega con tus datos verificados y los negocios
        pueden atenderte con mayor confianza.
      </p>
      <ul class="beneficios">
        <li>Tus datos quedan guardados: tus próximos pedidos son más rápidos.</li>
        <li>Consulta el estado y el historial de tus pedidos.</li>
        <li>Atención personalizada de cada negocio.</li>
      </ul>
      <form [formGroup]="form" (ngSubmit)="registrar()" novalidate>
        <label>
          Nombre completo
          <input type="text" formControlName="nombre" autocomplete="name" maxlength="80" />
        </label>
        <label>
          Teléfono celular
          <input type="tel" formControlName="telefono" inputmode="tel" autocomplete="tel" placeholder="951 123 4567" />
          <small>10 dígitos. Con este número inicias sesión y te contactamos sobre tus pedidos.</small>
        </label>
        <label>
          Correo electrónico <small>(opcional)</small>
          <input type="email" formControlName="correo" inputmode="email" autocomplete="email" maxlength="120" />
        </label>
        <label>
          Contraseña
          <input type="password" verContrasena formControlName="contrasena" autocomplete="new-password" />
          <small>Mínimo {{ minimo }} caracteres.</small>
        </label>
        <label class="casilla">
          <input type="checkbox" formControlName="aceptaPrivacidad" />
          <span>
            He leído y acepto el <a routerLink="/privacidad" target="_blank">Aviso de privacidad</a>, que explica cómo
            usamos y protegemos mis datos personales.
          </span>
        </label>
        @if (error(); as e) {
          <p class="error" role="alert">{{ e }}</p>
        }
        <button class="btn primario grande" type="submit" [disabled]="enviando()">
          {{ enviando() ? 'Creando tu cuenta…' : 'Crear cuenta' }}
        </button>
        @if (despertando()) {
          <p class="nota" role="status">Estamos conectando con el servidor; puede tardar hasta un minuto.</p>
        }
      </form>
      <p class="cambio">
        ¿Ya tienes cuenta?
        <a routerLink="/cuenta/entrar" [queryParams]="{ volver: volver() }">Iniciar sesión</a>
      </p>
    </section>
  `,
})
export class RegistroPage {
  readonly volver = input<string>();

  private readonly sesion = inject(ClienteSesionService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly minimo = MINIMO_CONTRASENA;

  protected readonly form = inject(FormBuilder).nonNullable.group({
    nombre: ['', Validators.required],
    telefono: ['', Validators.required],
    correo: ['', Validators.email],
    contrasena: ['', [Validators.required, Validators.minLength(MINIMO_CONTRASENA)]],
    aceptaPrivacidad: [false],
  });
  protected readonly enviando = signal(false);
  protected readonly despertando = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    if (this.sesion.activa()) queueMicrotask(() => void this.router.navigateByUrl(destinoSeguro(this.volver())));
  }

  protected registrar(): void {
    const d = this.form.getRawValue();
    const falta = !d.nombre.trim()
      ? 'Escribe tu nombre.'
      : !telefonoValido(d.telefono)
        ? 'El teléfono debe tener 10 dígitos.'
        : this.form.controls.correo.invalid
          ? 'El correo no es válido.'
          : d.contrasena.length < MINIMO_CONTRASENA
            ? `La contraseña debe tener al menos ${MINIMO_CONTRASENA} caracteres.`
            : !d.aceptaPrivacidad
              ? 'Para crear tu cuenta es necesario aceptar el Aviso de privacidad.'
              : null;
    if (falta) {
      this.error.set(falta);
      return;
    }
    this.error.set(null);
    this.enviando.set(true);
    const aviso = setTimeout(() => this.despertando.set(true), 5000);
    this.destroyRef.onDestroy(() => clearTimeout(aviso));
    this.sesion
      .registrar({ ...d, nombre: d.nombre.trim(), correo: d.correo.trim() || null })
      .pipe(
        finalize(() => {
          clearTimeout(aviso);
          this.enviando.set(false);
          this.despertando.set(false);
        }),
      )
      .subscribe({
        next: () => void this.router.navigateByUrl(destinoSeguro(this.volver())),
        error: (e) => this.error.set(mensajeDeError(e)),
      });
  }
}
