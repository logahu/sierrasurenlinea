import { DatePipe } from '@angular/common';
import { telefonoValido } from '../catalogo/encargo';
import { Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable, finalize } from 'rxjs';
import { ClienteAdmin, PaginaClientes, Rol, Usuario } from './admin.model';
import { AdminApi } from './admin.api';
import { mensajeDeError } from './autorizacion';
import { SesionService } from './sesion';
import { UsuariosPrueba } from './usuarios-prueba';
import {
  CLIENTES_POR_OMISION, EQUIPO_POR_OMISION, FiltrosClientes, FiltrosEquipo, filtrarEquipo, juntarPaginas, telefonoLegible,
} from './usuarios-filtros';

const MINIMO = 10;
const MAX_ADMINISTRADORES = 2;

/** Texto del rol para mostrar (el valor interno del administrador sigue siendo DUENO). */
export function nombreDelRol(rol: Rol): string {
  return rol === 'DUENO' ? 'Administrador' : rol === 'REPARTIDOR' ? 'Repartidor' : 'Encargado';
}

/** El valor de la dirección si es uno de los permitidos; si no, el de por omisión. */
function elegir<T extends string>(valor: string | undefined, permitidos: readonly T[], omision: T): T {
  return permitidos.includes(valor as T) ? (valor as T) : omision;
}

/**
 * Usuarios del sistema. Pestaña Equipo: administradores (hasta dos), encargados (uno
 * por negocio) y repartidores. Pestaña Clientes: las cuentas del sitio. Nada se borra:
 * se quita o se devuelve el acceso (baja lógica), así queda el historial.
 */
@Component({
  selector: 'app-usuarios-page',
  imports: [ReactiveFormsModule, RouterLink, DatePipe, UsuariosPrueba],
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

    @if (enClientes()) {
      <section class="filtros" aria-label="Filtros de clientes">
        <input type="search" class="buscador" placeholder="🔍 Buscar por nombre, teléfono o correo"
               [value]="texto()" (input)="escribir($any($event.target).value)" aria-label="Buscar cliente" />
        <div class="chips" role="group" aria-label="Grupo">
          @for (g of grupos; track g.valor) {
            <button type="button" class="chip" [class.elegido]="fc().grupo === g.valor" [attr.aria-pressed]="fc().grupo === g.valor"
                    (click)="filtrar({ grupo: g.valor })">
              {{ g.texto }} <b>{{ conteoGrupo(g.valor) }}</b>
            </button>
          }
        </div>
        <div class="selects">
          <select aria-label="Pedidos" [value]="fc().pedidos" (change)="filtrar({ pedidos: $any($event.target).value })">
            <option value="">Con y sin pedidos</option>
            <option value="con">Con pedidos</option>
            <option value="sin">Sin pedidos</option>
          </select>
          <label class="orden">Ordenar
            <select [value]="fc().orden" (change)="filtrar({ orden: $any($event.target).value })">
              <option value="recientes">Más recientes</option>
              <option value="visita">Última visita</option>
              <option value="nombre">Nombre A-Z</option>
              <option value="pedidos">Más pedidos</option>
            </select>
          </label>
          @if (hayFiltrosClientes()) { <button type="button" class="limpiar" (click)="limpiar()">Limpiar filtros</button> }
        </div>
      </section>
      <p class="resultado" role="status">
        {{ clientesPagina.isLoading() && listaClientes().length === 0 ? 'Cargando…' : listaClientes().length + ' de ' + totalClientes() + (totalClientes() === 1 ? ' cliente' : ' clientes') }}
        @if (fc().q) { · búsqueda «{{ fc().q }}» }
      </p>
      @if (fila() === null) {
        @if (aviso(); as a) { <p class="exito" role="status">{{ a }}</p> }
        @if (error(); as e) { <p class="error" role="alert">{{ e }}</p> }
      }

      <table class="tabla-usuarios">
        <thead>
          <tr><th>Nombre</th><th class="solo-pc">Teléfono</th><th class="solo-pc">Pedidos</th><th class="solo-pc">Última visita</th><th>Estado</th><th></th></tr>
        </thead>
        <tbody>
          @for (c of listaClientes(); track c.id) {
            <tr class="renglon" [class.abierto]="abierto() === 'c' + c.id" [class.inactivo]="!c.activo" (click)="abrir('c' + c.id)">
              <td>
                <strong>{{ c.nombre }}</strong>
                @if (c.probador) { <span class="etiqueta-prueba">🧪 Probador</span> }
                <small class="solo-cel">{{ tel(c.telefono) }} · {{ c.pedidos }} {{ c.pedidos === 1 ? 'pedido' : 'pedidos' }}</small>
              </td>
              <td class="solo-pc">{{ tel(c.telefono) }}</td>
              <td class="solo-pc">{{ c.pedidos }}</td>
              <td class="solo-pc">{{ c.ultimoAcceso ? (c.ultimoAcceso | date: 'd MMM y') : '—' }}</td>
              <td><span class="estado" [class.activo]="c.activo">{{ c.activo ? 'Activo' : 'Sin acceso' }}</span></td>
              <td class="flecha"><button type="button" class="abre" [attr.aria-expanded]="abierto() === 'c' + c.id" aria-label="Acciones">{{ abierto() === 'c' + c.id ? '▴' : '▾' }}</button></td>
            </tr>
            @if (abierto() === 'c' + c.id) {
              <tr class="detalle"><td colspan="6">
                <p class="ayuda">
                  Cliente desde {{ c.creado | date: 'd MMM y' }}
                  @if (c.correo) { · {{ c.correo }} }
                  @if (c.direccion) { · {{ c.direccion }} }
                </p>
                <div class="acciones-fila">
                  <a class="btn secundario" [href]="'https://wa.me/52' + c.telefono" target="_blank" rel="noopener">💬 WhatsApp</a>
                  <a class="btn secundario" [href]="'tel:' + c.telefono">📞 Llamar</a>
                  <button type="button" class="btn secundario" (click)="alternarProbador(c)" [disabled]="ocupado()"
                          title="Los probadores ven los negocios en pruebas; sus pedidos llegan como prueba">
                    {{ c.probador ? 'Quitar probador' : '🧪 Hacer probador' }}
                  </button>
                  <button type="button" class="btn secundario" (click)="reiniciandoCliente.set(reiniciandoCliente() === c.id ? null : c.id)">
                    🔑 Contraseña nueva
                  </button>
                  <button type="button" class="btn secundario" (click)="alternarCliente(c)" [disabled]="ocupado()">
                    {{ c.activo ? '⛔ Quitar acceso' : '✅ Devolver acceso' }}
                  </button>
                </div>
                @if (reiniciandoCliente() === c.id) {
                  <form class="en-linea" (submit)="$event.preventDefault(); reiniciarCliente(c, nuevaCliente.value)">
                    <input #nuevaCliente type="text" autocomplete="off" [placeholder]="'Mínimo ' + minimo + ' caracteres'" />
                    <button class="btn primario" type="submit" [disabled]="ocupado()">Guardar</button>
                  </form>
                  <p class="ayuda">Antes, confirma por teléfono o WhatsApp que hablas con el cliente. Dale la contraseña por WhatsApp y pídele que la cambie en Mi cuenta.</p>
                }
                @if (fila() === c.id) {
                  @if (aviso(); as a) { <p class="exito" role="status">{{ a }}</p> }
                  @if (error(); as e) { <p class="error" role="alert">{{ e }}</p> }
                }
              </td></tr>
            }
          } @empty {
            <tr><td colspan="6" class="ayuda vacio">
              {{ clientesPagina.isLoading() ? 'Cargando…' : hayFiltrosClientes() ? 'Nadie coincide con los filtros.' : 'Aún no hay clientes registrados.' }}
            </td></tr>
          }
        </tbody>
      </table>
      @if (listaClientes().length < totalClientes()) {
        <p class="mas"><button type="button" class="btn secundario" (click)="pagina.set(pagina() + 1)" [disabled]="clientesPagina.isLoading()">
          {{ clientesPagina.isLoading() ? 'Cargando…' : 'Ver más (' + (totalClientes() - listaClientes().length) + ')' }}
        </button></p>
      }
    } @else {
      <div class="encabezado-equipo">
        <p class="ayuda">
          <strong>Administradores</strong> (hasta {{ maxAdmin }}) · <strong>Encargados</strong> (uno por negocio) ·
          <strong>Repartidores</strong> (de un negocio o de todos)
        </p>
        <button type="button" class="btn primario" (click)="agregando.set(!agregando())" [attr.aria-expanded]="agregando()">
          {{ agregando() ? 'Cerrar' : '＋ Agregar persona' }}
        </button>
      </div>
      @if (agregando()) {
      <form class="ficha agregar" [formGroup]="form" (ngSubmit)="crear()" novalidate>
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
              Teléfono celular
              <input type="tel" formControlName="telefono" inputmode="tel" autocomplete="off" placeholder="951 123 4567" />
              <small>10 dígitos. Con este número entra al panel.</small>
            </label>
            <label>
              Correo <small>(opcional)</small>
              <input type="email" formControlName="correo" inputmode="email" autocomplete="off" />
            </label>
            <label>
              Contraseña inicial
              <input type="text" formControlName="contrasena" autocomplete="off" />
              <small>Mínimo {{ minimo }} caracteres. Compártela en persona; después la puede cambiar en "Mi cuenta".</small>
            </label>
            <button class="btn primario grande" type="submit" [disabled]="ocupado()">Agregar {{ rol(rolNuevo()).toLowerCase() }}</button>
            @if (filaEquipo() === null) {
              @if (aviso(); as a) { <p class="exito" role="status">{{ a }}</p> }
              @if (error(); as e) { <p class="error" role="alert">{{ e }}</p> }
            }
          }
        </fieldset>
      </form>
      }

      <section class="filtros" aria-label="Filtros del equipo">
        <input type="search" class="buscador" placeholder="🔍 Buscar por nombre, teléfono, correo o negocio"
               [value]="texto()" (input)="escribir($any($event.target).value)" aria-label="Buscar persona" />
        <div class="chips" role="group" aria-label="Rol">
          @for (r of roles; track r.valor) {
            <button type="button" class="chip" [class.elegido]="fe().rol === r.valor" [attr.aria-pressed]="fe().rol === r.valor"
                    (click)="filtrar({ rol: r.valor })">
              {{ r.texto }} <b>{{ equipo().conteos[r.valor] }}</b>
            </button>
          }
        </div>
        <div class="selects">
          <select aria-label="Negocio" [value]="fe().negocio" (change)="filtrar({ negocio: $any($event.target).value })">
            <option value="">Negocio: todos</option>
            <option value="_general">Sin negocio (generales)</option>
            @for (n of negocios.value() ?? []; track n.slug) { <option [value]="n.slug">{{ n.nombre }}</option> }
          </select>
          <select aria-label="Estado" [value]="fe().estado" (change)="filtrar({ estado: $any($event.target).value })">
            <option value="activos">Activos</option>
            <option value="sin-acceso">Sin acceso</option>
            <option value="bloqueados">Bloqueados por intentos</option>
            <option value="todos">Todos los estados</option>
          </select>
          <select aria-label="Cuentas de prueba" [value]="fe().prueba" (change)="filtrar({ prueba: $any($event.target).value })">
            <option value="ocultar">Sin cuentas de prueba</option>
            <option value="mostrar">Con cuentas de prueba</option>
            <option value="solo">Solo cuentas de prueba</option>
          </select>
          <label class="orden">Ordenar
            <select [value]="fe().orden" (change)="filtrar({ orden: $any($event.target).value })">
              <option value="nombre">Nombre A-Z</option>
              <option value="rol">Rol</option>
              <option value="negocio">Negocio</option>
              <option value="alta">Más recientes</option>
            </select>
          </label>
          @if (hayFiltrosEquipo()) { <button type="button" class="limpiar" (click)="limpiar()">Limpiar filtros</button> }
        </div>
      </section>
      <p class="resultado" role="status">
        {{ usuarios.isLoading() && !usuarios.hasValue() ? 'Cargando…' : equipo().lista.length + ' de ' + (usuarios.value()?.length ?? 0) + ' personas' }}
        @if (fe().q) { · búsqueda «{{ fe().q }}» }
      </p>

      <table class="tabla-usuarios">
        <thead>
          <tr><th>Nombre</th><th class="solo-pc">Rol</th><th class="solo-pc">Negocio</th><th class="solo-pc">Teléfono</th><th>Estado</th><th></th></tr>
        </thead>
        <tbody>
          @for (u of equipo().lista; track u.id) {
            <tr class="renglon" [class.abierto]="abierto() === 'u' + u.id" [class.inactivo]="!u.activo" (click)="abrir('u' + u.id)">
              <td>
                <strong>{{ u.nombre }}</strong>
                @if (u.id === yo()?.id) { <small> (tú)</small> }
                <small class="solo-cel">{{ rol(u.rol) }} · {{ u.rol === 'DUENO' ? 'todo el sitio' : (u.negocioNombre ?? 'todos los negocios') }} · {{ tel(u.telefono) || 'sin teléfono' }}</small>
              </td>
              <td class="solo-pc"><span class="rol" [class]="'rol rol-' + u.rol">{{ rol(u.rol) }}</span></td>
              <td class="solo-pc">{{ u.rol === 'DUENO' ? 'Todo el sitio' : (u.negocioNombre ?? 'Todos los negocios') }}</td>
              <td class="solo-pc">
                @if (u.telefono) { {{ tel(u.telefono) }} } @else { <span class="falta-tel">Sin teléfono</span> }
              </td>
              <td>
                <span class="estado" [class.activo]="u.activo && !u.bloqueado">{{ !u.activo ? 'Sin acceso' : u.bloqueado ? 'Bloqueado' : 'Activo' }}</span>
              </td>
              <td class="flecha"><button type="button" class="abre" [attr.aria-expanded]="abierto() === 'u' + u.id" aria-label="Acciones">{{ abierto() === 'u' + u.id ? '▴' : '▾' }}</button></td>
            </tr>
            @if (abierto() === 'u' + u.id) {
              <tr class="detalle"><td colspan="6">
                <p class="ayuda">
                  @if (u.correo) { {{ u.correo }} · }
                  @if (u.creado) { Alta: {{ u.creado | date: 'd MMM y' }} }
                  @if (u.rol === 'REPARTIDOR') { · {{ u.entregas ?? 0 }} {{ u.entregas === 1 ? 'entrega' : 'entregas' }} }
                  @if (u.bloqueado) { · bloqueado por intentos (se libera solo o con contraseña nueva) }
                </p>
                <div class="acciones-fila">
                  <button type="button" class="btn secundario" (click)="editando.set(editando() === u.id ? null : u.id)">✏️ Editar datos</button>
                  @if (u.id !== yo()?.id) {
                    <button type="button" class="btn secundario" (click)="reiniciando.set(reiniciando() === u.id ? null : u.id)">🔑 Contraseña nueva</button>
                    <button type="button" class="btn secundario" (click)="alternarAcceso(u)" [disabled]="ocupado()">
                      {{ u.activo ? '⛔ Quitar acceso' : '✅ Devolver acceso' }}
                    </button>
                  }
                  @if (u.telefono) {
                    <a class="btn secundario" [href]="'https://wa.me/52' + u.telefono" target="_blank" rel="noopener">💬 WhatsApp</a>
                  }
                </div>
                @if (editando() === u.id) {
                  <form class="ficha-edicion" (submit)="$event.preventDefault(); guardarDatos(u, en.value, et.value, ec.value)">
                    <label>Nombre <input #en type="text" maxlength="80" [value]="u.nombre" /></label>
                    <label>Teléfono <input #et type="tel" inputmode="tel" [value]="u.telefono ?? ''" placeholder="951 123 4567" /></label>
                    <label>Correo <small>(opcional)</small> <input #ec type="email" inputmode="email" [value]="u.correo ?? ''" /></label>
                    <button class="btn primario" type="submit" [disabled]="ocupado()">Guardar</button>
                  </form>
                }
                @if (reiniciando() === u.id) {
                  <form class="en-linea" (submit)="$event.preventDefault(); reiniciar(u, nueva.value)">
                    <input #nueva type="text" autocomplete="off" [placeholder]="'Mínimo ' + minimo + ' caracteres'" />
                    <button class="btn primario" type="submit" [disabled]="ocupado()">Guardar</button>
                  </form>
                }
                @if (filaEquipo() === u.id) {
                  @if (aviso(); as a) { <p class="exito" role="status">{{ a }}</p> }
                  @if (error(); as e) { <p class="error" role="alert">{{ e }}</p> }
                }
              </td></tr>
            }
          } @empty {
            <tr><td colspan="6" class="ayuda vacio">{{ usuarios.isLoading() ? 'Cargando…' : 'Nadie coincide con los filtros.' }}</td></tr>
          }
        </tbody>
      </table>

      <details class="plegable">
        <summary>🧪 Usuarios de prueba</summary>
        <app-usuarios-prueba (cambio)="usuarios.reload(); reiniciarClientes()" />
      </details>
    }
  `,
  styles: `
    .pestanas { display: flex; gap: 1.25rem; border-bottom: 1px solid var(--linea); margin-bottom: 1rem; }
    .pestanas a { background: none; border: 0; border-radius: 0; padding: .4rem 0 .6rem; color: var(--tinta-suave); text-decoration: none; font-weight: 600; border-bottom: 3px solid transparent; }
    .pestanas a.elegida { color: var(--tinta); border-bottom-color: var(--follaje); }
    .encabezado-equipo { display: flex; justify-content: space-between; align-items: center; gap: .75rem; flex-wrap: wrap; margin-bottom: .75rem; }
    .encabezado-equipo p { margin: 0; }
    .agregar { margin-bottom: 1rem; }
    .filtros { display: grid; gap: .6rem; padding: .75rem; border: 1px solid var(--linea); border-radius: .75rem; background: var(--superficie); }
    .buscador { width: 100%; padding: .6rem .8rem; font-size: 1rem; }
    .chips { display: flex; flex-wrap: wrap; gap: .4rem; }
    .chip { border: 1px solid var(--linea); background: var(--superficie); color: var(--tinta); border-radius: 999px; padding: .3rem .75rem; font-size: .85rem; cursor: pointer; }
    .chip b { color: var(--tinta-suave); font-weight: 600; margin-left: .15rem; }
    .chip.elegido { border-color: var(--follaje); color: var(--follaje); font-weight: 600; background: color-mix(in srgb, var(--follaje) 10%, var(--superficie)); }
    .chip.elegido b { color: var(--follaje); }
    .selects { display: flex; flex-wrap: wrap; gap: .5rem; align-items: center; }
    .selects select { width: auto; flex: 0 1 auto; padding: .4rem .5rem; font-size: .85rem; }
    .orden { display: flex; align-items: center; gap: .35rem; font-size: .8rem; color: var(--tinta-suave); }
    .limpiar { margin-left: auto; background: none; border: 0; color: var(--follaje); text-decoration: underline; cursor: pointer; font-size: .85rem; }
    .resultado { margin: .6rem .15rem; font-size: .85rem; color: var(--tinta-suave); }
    .tabla-usuarios { width: 100%; border-collapse: separate; border-spacing: 0; border: 1px solid var(--linea); border-radius: .75rem; overflow: hidden; background: var(--superficie); margin-bottom: 1.25rem; }
    .tabla-usuarios th { text-align: left; font-size: .72rem; text-transform: uppercase; letter-spacing: .04em; color: var(--tinta-suave); padding: .55rem .7rem; border-bottom: 1px solid var(--linea); background: var(--fondo-alt); }
    .tabla-usuarios td { padding: .55rem .7rem; border-bottom: 1px solid var(--linea); vertical-align: middle; }
    .tabla-usuarios tbody tr:last-child td { border-bottom: 0; }
    .renglon { cursor: pointer; }
    .renglon:hover td, .renglon.abierto td, .detalle td { background: color-mix(in srgb, var(--follaje) 6%, var(--superficie)); }
    .renglon.inactivo td { color: var(--tinta-suave); }
    .detalle td { display: table-cell; padding-top: .2rem; }
    .detalle .ayuda { margin: 0 0 .5rem; }
    .detalle form { margin-top: .6rem; }
    .solo-cel { display: none; }
    .rol { font-size: .75rem; padding: .1rem .55rem; border-radius: 999px; white-space: nowrap; background: var(--fondo-alt); }
    .rol-DUENO { background: color-mix(in srgb, #8b5cf6 16%, var(--superficie)); }
    .rol-ENCARGADO { background: color-mix(in srgb, var(--follaje) 16%, var(--superficie)); }
    .rol-REPARTIDOR { background: color-mix(in srgb, var(--cempasuchil) 22%, var(--superficie)); }
    .estado { font-size: .8rem; white-space: nowrap; color: var(--tinta-suave); }
    .estado::before { content: '● '; color: #a8a29e; }
    .estado.activo { color: var(--tinta); }
    .estado.activo::before { color: #2f9e5b; }
    .flecha { width: 2rem; text-align: right; }
    .abre { background: none; border: 0; color: var(--tinta-suave); font-size: 1rem; cursor: pointer; padding: .2rem; }
    .vacio { text-align: center; padding: 1.25rem !important; }
    .mas { text-align: center; }
    .plegable { margin-top: .5rem; }
    .plegable summary { cursor: pointer; font-weight: 600; padding: .4rem 0; }
    .ficha-edicion { display: grid; gap: .6rem; grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr)); align-items: end; }
    .ficha-edicion label { display: grid; gap: .25rem; font-size: .85rem; font-weight: 600; }
    .falta-tel { color: #c2410c; font-weight: 600; }
    @media (max-width: 640px) {
      .solo-pc { display: none; }
      .solo-cel { display: block; color: var(--tinta-suave); font-size: .78rem; margin-top: .1rem; }
      .selects select { flex: 1 1 45%; width: 100%; }
      .orden { flex: 1 1 100%; }
      .orden select { flex: 1; }
      .limpiar { margin-left: 0; }
      .encabezado-equipo .btn { width: 100%; }
    }
  `,
})
export class UsuariosPage {
  /** ?ver=clientes y los filtros de la dirección. */
  readonly ver = input<string>();
  readonly q = input<string>();
  readonly rolFiltro = input<string>(undefined, { alias: 'rol' });
  readonly negocio = input<string>();
  readonly estado = input<string>();
  readonly prueba = input<string>();
  readonly orden = input<string>();
  readonly grupo = input<string>();
  readonly pedidos = input<string>();

  private readonly api = inject(AdminApi);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);
  protected readonly yo = inject(SesionService).usuario;
  protected readonly minimo = MINIMO;
  protected readonly maxAdmin = MAX_ADMINISTRADORES;
  protected readonly rol = nombreDelRol;
  protected readonly tel = telefonoLegible;
  protected readonly enClientes = computed(() => this.ver() === 'clientes');

  protected readonly roles: { valor: FiltrosEquipo['rol']; texto: string }[] = [
    { valor: 'todos', texto: 'Todos' },
    { valor: 'DUENO', texto: 'Administradores' },
    { valor: 'ENCARGADO', texto: 'Encargados' },
    { valor: 'REPARTIDOR', texto: 'Repartidores' },
  ];
  protected readonly grupos: { valor: FiltrosClientes['grupo']; texto: string }[] = [
    { valor: '', texto: 'Todos' },
    { valor: 'probadores', texto: 'Probadores' },
    { valor: 'prueba', texto: 'De prueba' },
    { valor: 'sin-acceso', texto: 'Sin acceso' },
  ];

  /** Lo que se escribe en el buscador; llega a la dirección un momento después. */
  protected readonly texto = linkedSignal(() => this.q() ?? '');
  private espera?: ReturnType<typeof setTimeout>;

  protected readonly fe = computed<FiltrosEquipo>(() => ({
    q: this.texto(),
    rol: elegir(this.rolFiltro(), ['DUENO', 'ENCARGADO', 'REPARTIDOR'] as const, EQUIPO_POR_OMISION.rol),
    negocio: this.negocio() ?? '',
    estado: elegir(this.estado(), ['sin-acceso', 'bloqueados', 'todos'] as const, EQUIPO_POR_OMISION.estado),
    prueba: elegir(this.prueba(), ['mostrar', 'solo'] as const, EQUIPO_POR_OMISION.prueba),
    orden: elegir(this.orden(), ['rol', 'negocio', 'alta'] as const, EQUIPO_POR_OMISION.orden),
  }));
  protected readonly fc = computed<FiltrosClientes>(() => ({
    q: (this.q() ?? '').trim(),
    grupo: elegir(this.grupo(), ['probadores', 'prueba', 'sin-acceso'] as const, CLIENTES_POR_OMISION.grupo),
    pedidos: elegir(this.pedidos(), ['con', 'sin'] as const, CLIENTES_POR_OMISION.pedidos),
    orden: elegir(this.orden(), ['visita', 'nombre', 'pedidos'] as const, CLIENTES_POR_OMISION.orden),
  }));

  protected readonly usuarios = rxResource({ stream: () => this.api.usuarios() });
  protected readonly negocios = rxResource({ stream: () => this.api.negocios() });
  protected readonly equipo = computed(() => filtrarEquipo(this.usuarios.value() ?? [], this.fe()));
  protected readonly hayFiltrosEquipo = computed(() => {
    const f = this.fe();
    return Object.keys(EQUIPO_POR_OMISION).some((k) => f[k as keyof FiltrosEquipo] !== EQUIPO_POR_OMISION[k as keyof FiltrosEquipo]);
  });

  /** Página de clientes; vuelve a 0 cuando cambian los filtros. */
  protected readonly pagina = linkedSignal({ source: this.fc, computation: () => 0 });
  protected readonly clientesPagina = rxResource({
    params: () => (this.enClientes() ? { ...this.fc(), pagina: this.pagina() } : undefined),
    stream: ({ params }) => this.api.clientes(params),
  });
  protected readonly listaClientes = linkedSignal<PaginaClientes | undefined, ClienteAdmin[]>({
    source: () => this.clientesPagina.value(),
    computation: (p, previo) => (p ? juntarPaginas(previo?.value ?? [], p.clientes, p.pagina) : (previo?.value ?? [])),
  });
  protected readonly totalClientes = computed(() => this.clientesPagina.value()?.total ?? 0);
  protected readonly hayFiltrosClientes = computed(() => {
    const f = this.fc();
    return !!(f.q || f.grupo || f.pedidos || f.orden !== 'recientes');
  });

  protected conteoGrupo(g: FiltrosClientes['grupo']): number {
    const c = this.clientesPagina.value()?.conteos;
    if (!c) return 0;
    return g === 'probadores' ? c.probadores : g === 'prueba' ? c.dePrueba : g === 'sin-acceso' ? c.sinAcceso : c.todos - c.dePrueba;
  }

  /** Renglón con las acciones a la vista ('u12' equipo, 'c40' cliente). */
  protected readonly abierto = signal<string | null>(null);
  protected readonly agregando = signal(false);

  protected abrir(clave: string): void {
    this.abierto.set(this.abierto() === clave ? null : clave);
  }

  protected escribir(valor: string): void {
    this.texto.set(valor);
    clearTimeout(this.espera);
    this.espera = setTimeout(() => this.filtrar({ q: valor.trim() }), 300);
  }

  protected filtrar(cambios: Record<string, string>): void {
    const params: Record<string, string | null> = {};
    for (const [k, v] of Object.entries(cambios)) {
      const omision = (this.enClientes() ? CLIENTES_POR_OMISION : EQUIPO_POR_OMISION) as unknown as Record<string, string>;
      params[k] = v === '' || v === omision[k] ? null : v;
    }
    this.abierto.set(null);
    this.router.navigate([], { relativeTo: this.ruta, queryParams: params, queryParamsHandling: 'merge', replaceUrl: true });
  }

  protected limpiar(): void {
    clearTimeout(this.espera);
    this.texto.set('');
    this.router.navigate([], {
      relativeTo: this.ruta, queryParams: this.enClientes() ? { ver: 'clientes' } : {}, replaceUrl: true,
    });
  }

  protected reiniciarClientes(): void {
    if (this.pagina() === 0) this.clientesPagina.reload();
    else this.pagina.set(0);
  }

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
    telefono: ['', Validators.required],
    correo: ['', Validators.email],
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
    this.filaEquipo.set(null);
    const c = this.form.controls;
    const datos = this.form.getRawValue();
    const esAdmin = datos.rol === 'DUENO';
    if (datos.rol === 'ENCARGADO' && !datos.negocioSlug) return this.falla('Elige el negocio.');
    if (c.nombre.invalid) return this.falla('Escribe el nombre.');
    if (!telefonoValido(datos.telefono)) return this.falla('El teléfono debe tener 10 dígitos.');
    if (c.correo.invalid) return this.falla('El correo no es válido.');
    if (c.contrasena.invalid) return this.falla(`La contraseña debe tener al menos ${MINIMO} caracteres.`);
    this.ejecutar(this.api.crearEncargado({ ...datos, negocioSlug: esAdmin ? null : datos.negocioSlug || null, correo: datos.correo.trim() || null }), (u) => {
      this.form.reset();
      return `${u.nombre} ya puede entrar al panel en sierrasurenlinea.com.mx/admin con su teléfono ${u.telefono}.`;
    });
  }

  protected alternarAcceso(u: Usuario): void {
    this.fila.set(null);
    this.filaEquipo.set(u.id);
    this.ejecutar(this.api.editarUsuario(u.id, { nombre: u.nombre, activo: !u.activo }), (r) =>
      r.activo ? `${r.nombre} puede volver a entrar.` : `${r.nombre} ya no puede entrar.`,
    );
  }

  protected alternarProbador(c: ClienteAdmin): void {
    this.fila.set(c.id);
    this.filaEquipo.set(null);
    this.ejecutar(this.api.cambiarProbador(c.id, !c.probador), (r) => this.actualizarCliente(r,
      r.probador
        ? `${r.nombre} ya es probador: al iniciar sesión verá los negocios en pruebas.`
        : `${r.nombre} ya no es probador.`),
    );
  }

  protected alternarCliente(c: ClienteAdmin): void {
    this.fila.set(c.id);
    this.filaEquipo.set(null);
    this.ejecutar(this.api.cambiarAccesoCliente(c.id, !c.activo), (r) =>
      this.actualizarCliente(r, r.activo ? `${r.nombre} puede volver a pedir.` : `${r.nombre} ya no puede iniciar sesión.`),
    );
  }

  protected readonly reiniciandoCliente = signal<number | null>(null);
  /** Cliente cuyo aviso (éxito o error) se muestra junto a su renglón. */
  protected readonly fila = signal<number | null>(null);
  /** Persona del equipo cuyo aviso se muestra junto a su renglón. */
  protected readonly filaEquipo = signal<number | null>(null);

  protected reiniciarCliente(c: ClienteAdmin, nueva: string): void {
    this.fila.set(c.id);
    this.filaEquipo.set(null);
    if (nueva.length < MINIMO) return this.falla(`La contraseña debe tener al menos ${MINIMO} caracteres.`);
    this.ejecutar(this.api.reiniciarContrasenaCliente(c.id, nueva), () => {
      this.reiniciandoCliente.set(null);
      return `Listo: ${c.nombre} ya entra con la contraseña nueva.`;
    });
  }

  protected readonly editando = signal<number | null>(null);

  protected guardarDatos(u: Usuario, nombre: string, telefono: string, correo: string): void {
    this.fila.set(null);
    this.filaEquipo.set(u.id);
    if (!nombre.trim()) return this.falla('Escribe el nombre.');
    if (!telefonoValido(telefono)) return this.falla('El teléfono debe tener 10 dígitos.');
    this.ejecutar(
      this.api.editarUsuario(u.id, { nombre: nombre.trim(), telefono, correo: correo.trim() }),
      (r) => {
        this.editando.set(null);
        return `Datos de ${r.nombre} guardados. Entra al panel con el teléfono ${r.telefono}.`;
      },
    );
  }

  protected reiniciar(u: Usuario, nueva: string): void {
    this.fila.set(null);
    this.filaEquipo.set(u.id);
    if (nueva.length < MINIMO) return this.falla(`La contraseña debe tener al menos ${MINIMO} caracteres.`);
    this.ejecutar(this.api.reiniciarContrasena(u.id, nueva), () => {
      this.reiniciando.set(null);
      return `Listo: ${u.nombre} ya entra al panel con la contraseña nueva${u.telefono ? ' y su teléfono ' + u.telefono : ''}.`;
    });
  }

  private ejecutar<T>(op: Observable<T>, exito: (r: T) => string): void {
    this.aviso.set(null);
    this.error.set(null);
    this.ocupado.set(true);
    op.pipe(finalize(() => this.ocupado.set(false))).subscribe({
      next: (r) => {
        this.aviso.set(exito(r));
        if (!this.enClientes()) this.usuarios.reload();
      },
      error: (e) => this.error.set(mensajeDeError(e)),
    });
  }

  /** Cambia el cliente en la lista sin recargarla (así no se pierden las páginas de «Ver más»). */
  private actualizarCliente(r: ClienteAdmin, texto: string): string {
    this.listaClientes.update((l) => l.map((c) => (c.id === r.id ? { ...c, ...r } : c)));
    return texto;
  }

  private falla(texto: string): void {
    this.aviso.set(null);
    this.error.set(texto);
  }
}
