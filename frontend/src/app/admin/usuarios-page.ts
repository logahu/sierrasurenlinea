import { Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, finalize } from 'rxjs';
import { Usuario } from './admin.model';
import { AdminApi } from './admin.api';
import { mensajeDeError } from './autorizacion';

const MINIMO = 10;

/** Encargados: uno por negocio. Solo el dueño entra aquí. */
@Component({
  selector: 'app-usuarios-page',
  imports: [ReactiveFormsModule],
  template: `
    <header class="panel-titulo">
      <h1>Encargados y repartidores</h1>
      <p class="ayuda">
        Un <strong>encargado</strong> por negocio: edita su negocio y ve sus pedidos. Los <strong>repartidores</strong>
        (los que quieras) solo reciben y atienden pedidos desde el celular.
      </p>
    </header>

    @if (aviso(); as a) {
      <p class="exito" role="status">{{ a }}</p>
    }
    @if (error(); as e) {
      <p class="error" role="alert">{{ e }}</p>
    }

    <ul class="lista">
      @for (u of usuarios.value() ?? []; track u.id) {
        <li class="fila-usuario" [class.inactivo]="!u.activo">
          <div>
            <strong>{{ u.nombre }}</strong>
            <span class="ayuda">{{ u.correo }}</span>
            <span class="ayuda">
              {{ u.rol === 'DUENO' ? 'Dueño · todos los negocios' : (u.rol === 'REPARTIDOR' ? 'Repartidor · ' : 'Encargado · ') + u.negocioNombre }}
              @if (!u.activo) { · sin acceso }
              @if (u.bloqueado) { · bloqueado por intentos }
            </span>
          </div>
          @if (u.rol !== 'DUENO') {
            <div class="acciones-fila">
              <button type="button" class="btn secundario" (click)="alternarAcceso(u)" [disabled]="ocupado()">
                {{ u.activo ? 'Quitar acceso' : 'Devolver acceso' }}
              </button>
              <button type="button" class="btn secundario" (click)="reiniciando.set(reiniciando() === u.id ? null : u.id)">
                Contraseña nueva
              </button>
            </div>
            @if (reiniciando() === u.id) {
              <form class="en-linea" (ngSubmit)="reiniciar(u, nueva.value)">
                <input #nueva type="text" autocomplete="off" [placeholder]="'Mínimo ' + minimo + ' caracteres'" />
                <button class="btn primario" type="submit" [disabled]="ocupado()">Guardar</button>
              </form>
            }
          }
        </li>
      } @empty {
        @if (usuarios.isLoading()) {
          <li class="ayuda">Cargando…</li>
        }
      }
    </ul>

    <form class="ficha" [formGroup]="form" (ngSubmit)="crear()" novalidate>
      <fieldset>
        <legend>Agregar persona</legend>
        <label>
          Rol
          <select formControlName="rol">
            <option value="ENCARGADO">Encargado (edita su negocio y ve sus pedidos)</option>
            <option value="REPARTIDOR">Repartidor (solo recibe y atiende pedidos)</option>
          </select>
        </label>
        @if (form.controls.rol.value === 'ENCARGADO' && libres().length === 0 && negocios.hasValue()) {
          <p class="ayuda">Todos los negocios ya tienen encargado. Para cambiarlo, primero quítale el acceso al actual.</p>
        } @else {
          <label>
            Negocio
            <select formControlName="negocioSlug">
              <option value="" disabled>Elige…</option>
              @for (n of (form.controls.rol.value === 'ENCARGADO' ? libres() : negocios.value() ?? []); track n.slug) {
                <option [value]="n.slug">{{ n.nombre }}</option>
              }
            </select>
          </label>
          <label>
            Nombre
            <input formControlName="nombre" maxlength="80" autocomplete="off" />
          </label>
          <label>
            Correo
            <input type="email" formControlName="correo" inputmode="email" autocomplete="off" />
          </label>
          <label>
            Contraseña inicial
            <input type="text" formControlName="contrasena" autocomplete="off" />
            <small>Mínimo {{ minimo }} caracteres. Compártela en persona; después la puede cambiar en "Mi cuenta".</small>
          </label>
          <button class="btn primario grande" type="submit" [disabled]="ocupado()">
            {{ form.controls.rol.value === 'REPARTIDOR' ? 'Agregar repartidor' : 'Agregar encargado' }}
          </button>
        }
      </fieldset>
    </form>
  `,
})
export class UsuariosPage {
  private readonly api = inject(AdminApi);
  protected readonly minimo = MINIMO;

  protected readonly usuarios = rxResource({ stream: () => this.api.usuarios() });
  protected readonly negocios = rxResource({ stream: () => this.api.negocios() });
  /** Negocios sin encargado activo: los únicos a los que se puede asignar uno nuevo. */
  protected readonly libres = computed(() => {
    const ocupados = new Set(
      (this.usuarios.value() ?? []).filter((u) => u.rol === 'ENCARGADO' && u.activo).map((u) => u.negocioSlug),
    );
    return (this.negocios.value() ?? []).filter((n) => !ocupados.has(n.slug));
  });

  protected readonly form = inject(FormBuilder).nonNullable.group({
    rol: ['ENCARGADO'],
    negocioSlug: ['', Validators.required],
    nombre: ['', Validators.required],
    correo: ['', [Validators.required, Validators.email]],
    contrasena: ['', [Validators.required, Validators.minLength(MINIMO)]],
  });
  protected readonly ocupado = signal(false);
  protected readonly reiniciando = signal<number | null>(null);
  protected readonly aviso = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  protected crear(): void {
    const c = this.form.controls;
    if (c.negocioSlug.invalid) return this.falla('Elige el negocio.');
    if (c.nombre.invalid) return this.falla('Escribe el nombre.');
    if (c.correo.invalid) return this.falla('Escribe un correo válido.');
    if (c.contrasena.invalid) return this.falla(`La contraseña debe tener al menos ${MINIMO} caracteres.`);
    this.ejecutar(this.api.crearEncargado(this.form.getRawValue()), (u) => {
      this.form.reset();
      return `${u.nombre} ya puede entrar al panel con ${u.correo}.`;
    });
  }

  protected alternarAcceso(u: Usuario): void {
    this.ejecutar(this.api.editarUsuario(u.id, { nombre: u.nombre, activo: !u.activo }), (r) =>
      r.activo ? `${r.nombre} puede volver a entrar.` : `${r.nombre} ya no puede entrar.`,
    );
  }

  protected reiniciar(u: Usuario, nueva: string): void {
    if (nueva.length < MINIMO) return this.falla(`La contraseña debe tener al menos ${MINIMO} caracteres.`);
    this.ejecutar(this.api.reiniciarContrasena(u.id, nueva), () => {
      this.reiniciando.set(null);
      return `Listo: ${u.nombre} ya entra con la contraseña nueva.`;
    });
  }

  private ejecutar<T>(op: Observable<T>, exito: (r: T) => string): void {
    this.aviso.set(null);
    this.error.set(null);
    this.ocupado.set(true);
    op.pipe(finalize(() => this.ocupado.set(false))).subscribe({
      next: (r) => {
        this.aviso.set(exito(r));
        this.usuarios.reload();
      },
      error: (e) => this.error.set(mensajeDeError(e)),
    });
  }

  private falla(texto: string): void {
    this.aviso.set(null);
    this.error.set(texto);
  }
}
