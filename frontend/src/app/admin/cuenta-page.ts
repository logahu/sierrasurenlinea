import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { ElegirAvatar } from '../compartido/elegir-avatar';
import { VerContrasena } from '../compartido/ver-contrasena';
import { Usuario } from './admin.model';
import { mensajeDeError } from './autorizacion';
import { SesionService } from './sesion';
import { telefonoLegible } from './usuarios-filtros';

const MINIMO = 10;

/** «Administrador», «Encargado de TuRamoHoy», «Equipo de Estudio Melgarejo», «Repartidor de Encarguitos». */
export function puestoDe(u: Pick<Usuario, 'rol' | 'negocioNombre'>): string {
  const de = u.negocioNombre ? ' de ' + u.negocioNombre : '';
  switch (u.rol) {
    case 'DUENO': return 'Administrador';
    case 'ENCARGADO': return 'Encargado' + de;
    case 'EMPLEADO': return 'Equipo' + de;
    case 'REPARTIDOR': return u.negocioNombre ? 'Repartidor' + de : 'Repartidor general';
  }
}

/** Mi perfil: avatar o foto, nombre y correo; y cambiar la contraseña. Para todo el equipo del panel. */
@Component({
  selector: 'app-cuenta-page',
  imports: [ReactiveFormsModule, VerContrasena, ElegirAvatar],
  template: `
    <header class="panel-titulo">
      <h1>Mi perfil</h1>
      @if (sesion.usuario(); as u) { <p class="ayuda">{{ puesto() }}</p> }
    </header>

    @if (sesion.usuario(); as u) {
      <div class="ficha">
        <fieldset>
          <legend>Tu foto o avatar</legend>
          <app-elegir-avatar [avatar]="u.avatar" [nombre]="u.nombre" [subir]="subirFoto" [ocupado]="guardandoAvatar()"
                             (elegido)="cambiarAvatar($event)" />
          <small>Lo ven tus compañeros en el panel{{ u.rol === 'EMPLEADO' || u.rol === 'ENCARGADO' ? ' y, si atiendes citas, los clientes al apartar' : '' }}.</small>
          @if (avisoAvatar(); as a) { <p class="exito" role="status">{{ a }}</p> }
          @if (errorAvatar(); as e) { <p class="error" role="alert">{{ e }}</p> }
        </fieldset>
      </div>

      <form class="ficha" [formGroup]="perfil" (ngSubmit)="guardarPerfil()" novalidate>
        <fieldset>
          <legend>Tus datos</legend>
          <label>Nombre <input formControlName="nombre" maxlength="80" autocomplete="name" /></label>
          <label>
            <span>Correo <span class="opcional">(opcional)</span></span>
            <input type="email" formControlName="correo" maxlength="120" autocomplete="email" />
            <small>También puedes entrar al panel con él.</small>
          </label>
          <label>
            Teléfono
            <input [value]="u.telefono ? tel(u.telefono) : 'Sin teléfono'" disabled />
            <small>Con él entras al panel. Para cambiarlo, pídeselo al administrador.</small>
          </label>
          @if (avisoPerfil(); as a) { <p class="exito" role="status">{{ a }}</p> }
          @if (errorPerfil(); as e) { <p class="error" role="alert">{{ e }}</p> }
          <div class="acciones">
            <button class="btn primario" type="submit" [disabled]="guardandoPerfil() || perfil.pristine">
              {{ guardandoPerfil() ? 'Guardando…' : 'Guardar datos' }}
            </button>
          </div>
        </fieldset>
      </form>
    }

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
  styles: `.ficha + .ficha { margin-top: 1rem; }`,
})
export class CuentaPage {
  protected readonly sesion = inject(SesionService);
  protected readonly minimo = MINIMO;
  protected readonly tel = telefonoLegible;
  protected readonly puesto = computed(() => {
    const u = this.sesion.usuario();
    return u ? puestoDe(u) : '';
  });
  private readonly fb = inject(FormBuilder).nonNullable;

  // ---- Avatar: se guarda en cuanto se elige.
  protected readonly subirFoto = (archivo: File) => this.sesion.subirFoto(archivo);
  protected readonly guardandoAvatar = signal(false);
  protected readonly avisoAvatar = signal<string | null>(null);
  protected readonly errorAvatar = signal<string | null>(null);

  // ---- Datos
  protected readonly perfil = this.fb.group({
    nombre: [this.sesion.usuario()?.nombre ?? '', [Validators.required, Validators.maxLength(80)]],
    correo: [this.sesion.usuario()?.correo ?? ''],
  });
  protected readonly guardandoPerfil = signal(false);
  protected readonly avisoPerfil = signal<string | null>(null);
  protected readonly errorPerfil = signal<string | null>(null);

  // ---- Contraseña
  protected readonly form = this.fb.group({ actual: '', nueva: '', repetida: '' });
  protected readonly enviando = signal(false);
  protected readonly listo = signal(false);
  protected readonly error = signal<string | null>(null);

  protected cambiarAvatar(avatar: string | null): void {
    const u = this.sesion.usuario();
    if (!u) return;
    this.avisoAvatar.set(null);
    this.errorAvatar.set(null);
    this.guardandoAvatar.set(true);
    this.sesion
      .editarPerfil({ nombre: u.nombre, correo: u.correo, avatar })
      .pipe(finalize(() => this.guardandoAvatar.set(false)))
      .subscribe({
        next: () => this.avisoAvatar.set(avatar ? 'Listo, ya tienes nuevo avatar.' : 'Listo, se usarán tus iniciales.'),
        error: (e) => this.errorAvatar.set(mensajeDeError(e)),
      });
  }

  protected guardarPerfil(): void {
    const u = this.sesion.usuario();
    const { nombre, correo } = this.perfil.getRawValue();
    this.avisoPerfil.set(null);
    if (!u) return;
    if (!nombre.trim()) return this.errorPerfil.set('Escribe tu nombre.');
    this.errorPerfil.set(null);
    this.guardandoPerfil.set(true);
    this.sesion
      .editarPerfil({ nombre: nombre.trim(), correo: correo.trim() || null, avatar: u.avatar ?? null })
      .pipe(finalize(() => this.guardandoPerfil.set(false)))
      .subscribe({
        next: (nuevo) => {
          this.perfil.reset({ nombre: nuevo.nombre, correo: nuevo.correo ?? '' });
          this.avisoPerfil.set('Tus datos se guardaron.');
        },
        error: (e) => this.errorPerfil.set(mensajeDeError(e)),
      });
  }

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
