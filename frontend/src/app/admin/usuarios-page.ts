import { DatePipe } from '@angular/common';
import { Component, computed, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable, finalize } from 'rxjs';
import { ClienteAdmin, Rol, Usuario } from './admin.model';
import { AdminApi } from './admin.api';
import { mensajeDeError } from './autorizacion';
import { SesionService } from './sesion';

const MINIMO = 10;
const MAX_ADMINISTRADORES = 2;

/** Texto del rol para mostrar (el valor interno del administrador sigue siendo DUENO). */
export function nombreDelRol(rol: Rol): string {
  return rol === 'DUENO' ? 'Administrador' : rol === 'REPARTIDOR' ? 'Repartidor' : 'Encargado';
}

/**
 * Usuarios del sistema. Pestaña Equipo: administradores (hasta dos), encargados (uno
 * por negocio) y repartidores. Pestaña Clientes: las cuentas del sitio. Nada se borra:
 * se quita o se devuelve el acceso (baja lógica), así queda el historial.
 */
@Component({
  selector: 'app-usuarios-page',
  imports: [ReactiveFormsModule, RouterLink, DatePipe],
  template: `
    <header class="panel-titulo">
      <h1>Usuarios</h1>
      <p class="ayuda">
        Nada se borra: al quitar el acceso, la persona deja de entrar pero su historial se conserva.
      </p>
    </header>

    <nav class="pestanas" aria-label="Tipo de usuario">
      <a routerLink="." [queryParams]="{}" [class.elegida]="!enClientes()">Equipo</a>
      <a routerLink="." [queryParams]="{ ver: 'clientes' }" [class.elegida]="enClientes()">Clientes</a>
    </nav>

    @if (fila() === null) {
      @if (aviso(); as a) {
        <p class="exito" role="status">{{ a }}</p>
      }
      @if (error(); as e) {
        <p class="error" role="alert">{{ e }}</p>
      }
    }

    @if (enClientes()) {
      <form class="en-linea buscar" (ngSubmit)="busqueda.set(q.value.trim())">
        <input #q type="search" placeholder="Buscar por nombre o teléfono" [value]="busqueda()" aria-label="Buscar cliente" />
        <button class="btn secundario" type="submit">Buscar</button>
      </form>
      <ul class="lista">
        @for (c of clientes.value() ?? []; track c.id) {
          <li class="fila-usuario" [class.inactivo]="!c.activo">
            <div>
              <strong>{{ c.nombre }}</strong>
              <span class="ayuda">
                {{ c.telefono }} ·
                <a [href]="'https://wa.me/52' + c.telefono" target="_blank" rel="noopener">WhatsApp</a> ·
                <a [href]="'tel:' + c.telefono">Llamar</a>
                @if (c.correo) { · {{ c.correo }} }
              </span>
              <span class="ayuda">
                Cliente desde {{ c.creado | date: 'd MMM y' }} · {{ c.pedidos }} {{ c.pedidos === 1 ? 'pedido' : 'pedidos' }}
                @if (c.ultimoAcceso) { · última visita {{ c.ultimoAcceso | date: 'd MMM' }} }
                @if (!c.activo) { · sin acceso }
              </span>
              @if (c.direccion) { <span class="ayuda">{{ c.direccion }}</span> }
            </div>
            <div class="acciones-fila">
              <button type="button" class="btn secundario" (click)="alternarCliente(c)" [disabled]="ocupado()">
                {{ c.activo ? 'Quitar acceso' : 'Devolver acceso' }}
              </button>
              <button type="button" class="btn secundario" (click)="reiniciandoCliente.set(reiniciandoCliente() === c.id ? null : c.id)">
                Contraseña nueva
              </button>
            </div>
            @if (reiniciandoCliente() === c.id) {
              <form class="en-linea" (ngSubmit)="reiniciarCliente(c, nuevaCliente.value)">
                <input #nuevaCliente type="text" autocomplete="off" [placeholder]="'Mínimo ' + minimo + ' caracteres'" />
                <button class="btn primario" type="submit" [disabled]="ocupado()">Guardar</button>
              </form>
              <p class="ayuda">Antes, confirma por teléfono o WhatsApp que hablas con el cliente. Dale la contraseña por WhatsApp y pídele que la cambie en Mi cuenta.</p>
            }
            @if (fila() === c.id) {
              @if (aviso(); as a) { <p class="exito" role="status">{{ a }}</p> }
              @if (error(); as e) { <p class="error" role="alert">{{ e }}</p> }
            }
          </li>
        } @empty {
          <li class="ayuda">{{ clientes.isLoading() ? 'Cargando…' : busqueda() ? 'Nadie coincide con la búsqueda.' : 'Aún no hay clientes registrados.' }}</li>
        }
      </ul>
    } @else {
      <p class="ayuda">
        <strong>Administradores</strong> (hasta {{ maxAdmin }}): todo el sitio y los usuarios.
        <strong>Encargados</strong> (uno por negocio): su catálogo y sus pedidos.
        <strong>Repartidores</strong>: reciben los pedidos en el celular y los entregan; pueden ser de un negocio o de
        todos.
      </p>
      <ul class="lista">
        @for (u of usuarios.value() ?? []; track u.id) {
          <li class="fila-usuario" [class.inactivo]="!u.activo">
            <div>
              <strong>{{ u.nombre }}</strong>
              @if (u.id === yo()?.id) { <small> (tú)</small> }
              <span class="ayuda">{{ u.correo }}</span>
              <span class="ayuda">
                {{ rol(u.rol) }}{{ u.rol === 'DUENO' ? ' · todo el sitio' : ' · ' + (u.negocioNombre ?? 'todos los negocios') }}
                @if (!u.activo) { · sin acceso }
                @if (u.bloqueado) { · bloqueado por intentos }
              </span>
            </div>
            @if (u.id !== yo()?.id) {
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
              <option value="ENCARGADO">Encargado (administra su negocio y atiende sus pedidos)</option>
              <option value="REPARTIDOR">Repartidor (recibe y entrega pedidos)</option>
              <option value="DUENO" [disabled]="!hayCupoAdmin()">
                Administrador (todo el sitio){{ hayCupoAdmin() ? '' : ' — ya hay ' + maxAdmin }}
              </option>
            </select>
          </label>
          @if (rolNuevo() === 'ENCARGADO' && libres().length === 0 && negocios.hasValue()) {
            <p class="ayuda">Todos los negocios ya tienen encargado. Para cambiarlo, primero quítale el acceso al actual.</p>
          } @else {
            @if (rolNuevo() !== 'DUENO') {
              <label>
                Negocio
                <select formControlName="negocioSlug">
                  @if (rolNuevo() === 'REPARTIDOR') {
                    <option value="">Todos los negocios (entrega los pedidos a domicilio de todos)</option>
                  } @else {
                    <option value="" disabled>Elige…</option>
                  }
                  @for (n of (rolNuevo() === 'ENCARGADO' ? libres() : negocios.value() ?? []); track n.slug) {
                    <option [value]="n.slug">{{ n.nombre }}</option>
                  }
                </select>
              </label>
            }
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
            <button class="btn primario grande" type="submit" [disabled]="ocupado()">Agregar {{ rol(rolNuevo()).toLowerCase() }}</button>
          }
        </fieldset>
      </form>
    }
  `,
  styles: `
    .pestanas { display: flex; gap: 1.25rem; border-bottom: 1px solid var(--linea); margin-bottom: 1rem; }
    .pestanas a { background: none; border: 0; border-radius: 0; padding: .4rem 0 .6rem; color: var(--tinta-suave); text-decoration: none; font-weight: 600; border-bottom: 3px solid transparent; }
    .pestanas a.elegida { color: var(--tinta); border-bottom-color: var(--follaje); }
    .buscar { margin-bottom: 1rem; display: flex; flex-wrap: nowrap; gap: .5rem; }
    .buscar input { flex: 1; min-width: 0; }
  `,
})
export class UsuariosPage {
  /** ?ver=clientes */
  readonly ver = input<string>();

  private readonly api = inject(AdminApi);
  protected readonly yo = inject(SesionService).usuario;
  protected readonly minimo = MINIMO;
  protected readonly maxAdmin = MAX_ADMINISTRADORES;
  protected readonly rol = nombreDelRol;
  protected readonly enClientes = computed(() => this.ver() === 'clientes');

  protected readonly usuarios = rxResource({ stream: () => this.api.usuarios() });
  protected readonly negocios = rxResource({ stream: () => this.api.negocios() });
  protected readonly busqueda = signal('');
  protected readonly clientes = rxResource({
    params: () => (this.enClientes() ? { q: this.busqueda() } : undefined),
    stream: ({ params }) => this.api.clientes(params.q),
  });
  /** Negocios sin encargado activo: los únicos a los que se puede asignar uno nuevo. */
  protected readonly libres = computed(() => {
    const ocupados = new Set(
      (this.usuarios.value() ?? []).filter((u) => u.rol === 'ENCARGADO' && u.activo).map((u) => u.negocioSlug),
    );
    return (this.negocios.value() ?? []).filter((n) => !ocupados.has(n.slug));
  });
  protected readonly hayCupoAdmin = computed(
    () => (this.usuarios.value() ?? []).filter((u) => u.rol === 'DUENO' && u.activo).length < MAX_ADMINISTRADORES,
  );

  protected readonly form = inject(FormBuilder).nonNullable.group({
    rol: ['ENCARGADO' as Rol],
    negocioSlug: [''],
    nombre: ['', Validators.required],
    correo: ['', [Validators.required, Validators.email]],
    contrasena: ['', [Validators.required, Validators.minLength(MINIMO)]],
  });
  protected readonly rolNuevo = signal<Rol>('ENCARGADO');
  protected readonly ocupado = signal(false);
  protected readonly reiniciando = signal<number | null>(null);
  protected readonly aviso = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  constructor() {
    this.form.controls.rol.valueChanges.subscribe((r) => this.rolNuevo.set(r));
  }

  protected crear(): void {
    this.fila.set(null);
    const c = this.form.controls;
    const datos = this.form.getRawValue();
    const esAdmin = datos.rol === 'DUENO';
    if (datos.rol === 'ENCARGADO' && !datos.negocioSlug) return this.falla('Elige el negocio.');
    if (c.nombre.invalid) return this.falla('Escribe el nombre.');
    if (c.correo.invalid) return this.falla('Escribe un correo válido.');
    if (c.contrasena.invalid) return this.falla(`La contraseña debe tener al menos ${MINIMO} caracteres.`);
    this.ejecutar(this.api.crearEncargado({ ...datos, negocioSlug: esAdmin ? null : datos.negocioSlug || null }), (u) => {
      this.form.reset();
      return `${u.nombre} ya puede entrar al panel con ${u.correo}.`;
    });
  }

  protected alternarAcceso(u: Usuario): void {
    this.fila.set(null);
    this.ejecutar(this.api.editarUsuario(u.id, { nombre: u.nombre, activo: !u.activo }), (r) =>
      r.activo ? `${r.nombre} puede volver a entrar.` : `${r.nombre} ya no puede entrar.`,
    );
  }

  protected alternarCliente(c: ClienteAdmin): void {
    this.fila.set(c.id);
    this.ejecutar(this.api.cambiarAccesoCliente(c.id, !c.activo), (r) =>
      r.activo ? `${r.nombre} puede volver a pedir.` : `${r.nombre} ya no puede iniciar sesión.`,
    );
  }

  protected readonly reiniciandoCliente = signal<number | null>(null);
  /** Cliente cuyo aviso (éxito o error) se muestra junto a su renglón. */
  protected readonly fila = signal<number | null>(null);

  protected reiniciarCliente(c: ClienteAdmin, nueva: string): void {
    this.fila.set(c.id);
    if (nueva.length < MINIMO) return this.falla(`La contraseña debe tener al menos ${MINIMO} caracteres.`);
    this.ejecutar(this.api.reiniciarContrasenaCliente(c.id, nueva), () => {
      this.reiniciandoCliente.set(null);
      return `Listo: ${c.nombre} ya entra con la contraseña nueva.`;
    });
  }

  protected reiniciar(u: Usuario, nueva: string): void {
    this.fila.set(null);
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
        this.clientes.reload();
      },
      error: (e) => this.error.set(mensajeDeError(e)),
    });
  }

  private falla(texto: string): void {
    this.aviso.set(null);
    this.error.set(texto);
  }
}
