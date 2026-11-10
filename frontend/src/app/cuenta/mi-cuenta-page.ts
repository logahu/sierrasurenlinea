import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { mensajeDeError } from '../admin/autorizacion';
import { ClienteSesionService } from './cliente-sesion';
import { ESTADO_PARA_CLIENTE, MINIMO_CONTRASENA } from './cuenta.model';

@Component({
  selector: 'app-mi-cuenta-page',
  imports: [ReactiveFormsModule, RouterLink, DatePipe, CurrencyPipe],
  styleUrl: './cuenta.scss',
  styles: `
    .encabezado { display: flex; justify-content: space-between; align-items: baseline; gap: 1rem; flex-wrap: wrap; }
    .pedidos { list-style: none; margin: 0; padding: 0; display: grid; gap: .6rem; }
    .pedido {
      display: grid; grid-template-columns: 1fr auto; gap: .15rem 1rem;
      padding: .8rem 1rem; border: 1px solid var(--linea); border-radius: .85rem;
      small { color: var(--tinta-suave); }
    }
    .estado { font-size: .8rem; font-weight: 700; padding: .15rem .6rem; border-radius: 999px; background: var(--fondo-alt); align-self: start; }
    .estado.ENTREGADO { color: var(--follaje); }
    .estado.CANCELADO { color: #c92a2a; }
    details { margin-top: 1.5rem; }
    summary { cursor: pointer; font-weight: 600; }
    details form { margin-top: .9rem; }
  `,
  template: `
    @if (sesion.cliente(); as c) {
      <section class="tarjeta-cuenta ancha">
        <div class="encabezado">
          <h1>Hola, {{ sesion.primerNombre() }}</h1>
          <button type="button" class="btn secundario" (click)="salir()">Cerrar sesión</button>
        </div>
        <p class="intro">Desde aquí consultas tus pedidos y mantienes tus datos al día.</p>

        <h2>Mis pedidos</h2>
        @if (pedidos.isLoading()) {
          <p class="nota">Cargando tus pedidos…</p>
        } @else if (pedidos.error()) {
          <p class="error">No pudimos cargar tus pedidos. Intenta de nuevo en un momento.</p>
        } @else {
          <ul class="pedidos">
            @for (p of pedidos.value() ?? []; track p.id) {
              <li class="pedido">
                <strong>{{ p.negocioNombre }} · {{ p.tipo }}</strong>
                <span class="estado" [class]="p.estado">{{ estado[p.estado] }}</span>
                <small>
                  Folio {{ p.folio }} · {{ p.creado | date: "d MMM y, h:mm a" }}
                  @if (p.totalEstimado) { · {{ p.totalEstimado | currency: 'MXN' : 'symbol-narrow' }} aprox. }
                </small>
              </li>
            } @empty {
              <li class="nota">Aún no tienes pedidos. <a routerLink="/">Explora los negocios</a> y haz el primero.</li>
            }
          </ul>
        }

        <h2>Mis datos</h2>
        <form [formGroup]="datos" (ngSubmit)="guardar()" novalidate>
          <label>
            Nombre completo
            <input type="text" formControlName="nombre" autocomplete="name" maxlength="80" />
          </label>
          <label>
            Teléfono
            <input type="tel" [value]="c.telefono" disabled />
            <small>Es tu usuario para iniciar sesión; no se puede cambiar.</small>
          </label>
          <label>
            Correo electrónico <small>(opcional)</small>
            <input type="email" formControlName="correo" autocomplete="email" maxlength="120" />
          </label>
          <label>
            Dirección de entrega habitual <small>(opcional)</small>
            <textarea formControlName="direccion" rows="2" maxlength="300" autocomplete="street-address"
                      placeholder="Calle, número, colonia y alguna referencia"></textarea>
            <small>La llenamos por ti en tus próximos pedidos.</small>
          </label>
          @if (avisoDatos(); as a) { <p class="exito" role="status">{{ a }}</p> }
          @if (errorDatos(); as e) { <p class="error" role="alert">{{ e }}</p> }
          <button class="btn primario" type="submit" [disabled]="ocupado()">Guardar cambios</button>
        </form>

        <details>
          <summary>Cambiar contraseña</summary>
          <form [formGroup]="claves" (ngSubmit)="cambiarContrasena()" novalidate>
            <label>
              Contraseña actual
              <input type="password" formControlName="actual" autocomplete="current-password" />
            </label>
            <label>
              Contraseña nueva
              <input type="password" formControlName="nueva" autocomplete="new-password" />
              <small>Mínimo {{ minimo }} caracteres.</small>
            </label>
            @if (avisoClave(); as a) { <p class="exito" role="status">{{ a }}</p> }
            @if (errorClave(); as e) { <p class="error" role="alert">{{ e }}</p> }
            <button class="btn primario" type="submit" [disabled]="ocupado()">Cambiar contraseña</button>
          </form>
        </details>

        <p class="nota" style="margin-top: 1.5rem">
          Consulta nuestro <a routerLink="/privacidad">Aviso de privacidad</a>.
        </p>
      </section>
    }
  `,
})
export class MiCuentaPage {
  protected readonly sesion = inject(ClienteSesionService);
  private readonly router = inject(Router);
  protected readonly estado = ESTADO_PARA_CLIENTE;
  protected readonly minimo = MINIMO_CONTRASENA;

  protected readonly pedidos = rxResource({ stream: () => this.sesion.pedidos() });

  private readonly fb = inject(FormBuilder).nonNullable;
  protected readonly datos = this.fb.group({
    nombre: [this.sesion.cliente()?.nombre ?? '', Validators.required],
    correo: [this.sesion.cliente()?.correo ?? '', Validators.email],
    direccion: [this.sesion.cliente()?.direccion ?? ''],
  });
  protected readonly claves = this.fb.group({ actual: [''], nueva: [''] });

  protected readonly ocupado = signal(false);
  protected readonly avisoDatos = signal<string | null>(null);
  protected readonly errorDatos = signal<string | null>(null);
  protected readonly avisoClave = signal<string | null>(null);
  protected readonly errorClave = signal<string | null>(null);

  constructor() {
    // Trae los datos al día (y detecta si la sesión ya no es válida).
    this.sesion.refrescar().subscribe({
      next: (c) => this.datos.patchValue({ nombre: c.nombre, correo: c.correo ?? '', direccion: c.direccion ?? '' }),
      error: () => {
        if (!this.sesion.activa()) void this.router.navigate(['/cuenta/entrar']);
      },
    });
  }

  protected guardar(): void {
    this.avisoDatos.set(null);
    const d = this.datos.getRawValue();
    if (!d.nombre.trim()) return this.errorDatos.set('Escribe tu nombre.');
    if (this.datos.controls.correo.invalid) return this.errorDatos.set('El correo no es válido.');
    this.errorDatos.set(null);
    this.ocupado.set(true);
    this.sesion
      .editar({ nombre: d.nombre.trim(), correo: d.correo.trim() || null, direccion: d.direccion.trim() || null })
      .pipe(finalize(() => this.ocupado.set(false)))
      .subscribe({
        next: () => this.avisoDatos.set('Tus datos se guardaron.'),
        error: (e) => this.errorDatos.set(mensajeDeError(e)),
      });
  }

  protected cambiarContrasena(): void {
    this.avisoClave.set(null);
    const { actual, nueva } = this.claves.getRawValue();
    if (!actual) return this.errorClave.set('Escribe tu contraseña actual.');
    if (nueva.length < MINIMO_CONTRASENA) {
      return this.errorClave.set(`La contraseña nueva debe tener al menos ${MINIMO_CONTRASENA} caracteres.`);
    }
    this.errorClave.set(null);
    this.ocupado.set(true);
    this.sesion
      .cambiarContrasena(actual, nueva)
      .pipe(finalize(() => this.ocupado.set(false)))
      .subscribe({
        next: () => {
          this.claves.reset();
          this.avisoClave.set('Listo: tu contraseña se actualizó.');
        },
        error: (e) => this.errorClave.set(mensajeDeError(e)),
      });
  }

  protected salir(): void {
    this.sesion.salir();
    void this.router.navigateByUrl('/');
  }
}
