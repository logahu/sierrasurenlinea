import { Component, DestroyRef, inject, input, signal } from '@angular/core';
import { VerContrasena } from '../compartido/ver-contrasena';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { mensajeDeError } from '../admin/autorizacion';
import { ClienteSesionService } from './cliente-sesion';
import { destinoSeguro } from './destino';
import { SesionService } from '../admin/sesion';
import { telefonoValido } from '../catalogo/encargo';

@Component({
  selector: 'app-entrar-cliente-page',
  imports: [ReactiveFormsModule, RouterLink, VerContrasena],
  styleUrl: './cuenta.scss',
  template: `
    <section class="tarjeta-cuenta">
      <h1>Iniciar sesión</h1>
      <p class="intro">Entra con tu número de teléfono y tu contraseña para hacer pedidos y consultar su seguimiento.</p>
      @if (pedido()) {
        <p class="beneficios" role="status">Para enviar tu pedido necesitas iniciar sesión. Si aún no tienes cuenta, créala en menos de un minuto.</p>
      }
      <form [formGroup]="form" (ngSubmit)="entrar()" novalidate>
        <label>
          Teléfono
          <input type="tel" formControlName="telefono" inputmode="tel" autocomplete="tel" placeholder="951 123 4567" />
        </label>
        <label>
          Contraseña
          <input type="password" verContrasena formControlName="contrasena" autocomplete="current-password" />
        </label>
        @if (error(); as e) {
          <p class="error" role="alert">{{ e }}</p>
        }
        <button class="btn primario grande" type="submit" [disabled]="enviando()">
          {{ enviando() ? 'Entrando…' : 'Iniciar sesión' }}
        </button>
        @if (despertando()) {
          <p class="nota" role="status">Estamos conectando con el servidor; puede tardar hasta un minuto.</p>
        }
        <p class="nota">¿Olvidaste tu contraseña? Escríbenos por WhatsApp a cualquiera de los negocios y te ayudamos a recuperarla.</p>
      </form>
      <p class="cambio">
        ¿Aún no tienes cuenta?
        <a routerLink="/cuenta/registro" [queryParams]="{ volver: volver() }">Crear cuenta</a>
      </p>
      <!-- El equipo de los negocios entra al panel desde aquí (en la app no se puede escribir /admin). -->
      <p class="separador" aria-hidden="true">¿Trabajas en un negocio?</p>
      <a class="acceso-panel" [routerLink]="equipo.activa() ? equipo.inicio() : '/admin/entrar'">
        <span class="icono" aria-hidden="true">🗂️</span>
        <span>
          <strong>{{ equipo.activa() ? 'Ir a mi panel' : 'Entrar al panel' }}</strong>
          <small>{{ equipo.activa() ? 'Ya tienes la sesión abierta como ' + equipo.usuario()?.nombre : 'Dueño, encargados, empleados y repartidores' }}</small>
        </span>
        <span class="flecha" aria-hidden="true">›</span>
      </a>
    </section>
  `,
})
export class EntrarClientePage {
  /** ?volver=/encarguitos : a dónde regresar después de entrar. */
  readonly volver = input<string>();
  /** ?pedido=1 : llegó aquí al intentar enviar un pedido. */
  readonly pedido = input<string>();

  private readonly sesion = inject(ClienteSesionService);
  /** Sesión del panel (dueño, encargados, empleados, repartidores). */
  protected readonly equipo = inject(SesionService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    telefono: ['', Validators.required],
    contrasena: ['', Validators.required],
  });
  protected readonly enviando = signal(false);
  protected readonly despertando = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    if (this.sesion.activa()) queueMicrotask(() => void this.router.navigateByUrl(destinoSeguro(this.volver())));
  }

  protected entrar(): void {
    if (this.form.invalid) {
      this.error.set('Escribe tu teléfono y tu contraseña.');
      return;
    }
    if (!telefonoValido(this.form.controls.telefono.value)) {
      const digitos = this.form.controls.telefono.value.replace(/\D/g, '').length;
      this.error.set(`El teléfono debe tener 10 dígitos (escribiste ${digitos}). Revísalo e inténtalo de nuevo.`);
      return;
    }
    this.error.set(null);
    this.enviando.set(true);
    const aviso = setTimeout(() => this.despertando.set(true), 5000);
    this.destroyRef.onDestroy(() => clearTimeout(aviso));
    const { telefono, contrasena } = this.form.getRawValue();
    this.sesion
      .entrar(telefono, contrasena)
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
