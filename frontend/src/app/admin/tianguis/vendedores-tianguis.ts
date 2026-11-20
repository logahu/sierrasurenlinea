import { Component, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { whatsappValido } from '../../tianguis/tianguis';
import { mensajeDeError } from '../autorizacion';
import { TianguisAdminApi, VendedorAdmin } from './tianguis-admin.api';

/** Catálogo de vendedores: alta, notas internas, verificar (WhatsApp confirmado) y bloquear. */
@Component({
  selector: 'app-vendedores-tianguis',
  imports: [RouterLink],
  template: `
    <form class="en-linea" role="search" (submit)="$event.preventDefault(); q.set(busqueda())">
      <input type="search" placeholder="Nombre o WhatsApp" aria-label="Buscar vendedor" [value]="busqueda()" (input)="busqueda.set($any($event.target).value)" />
      <button class="btn secundario" type="submit">Buscar</button>
    </form>
    @if (mensaje(); as m) { <p class="exito" role="status">{{ m }}</p> }
    @if (error(); as e) { <p class="error" role="alert">{{ e }}</p> }

    <details class="alta">
      <summary>＋ Dar de alta un vendedor</summary>
      <form (submit)="$event.preventDefault(); crear()">
        <label>Nombre <input maxlength="80" [value]="nuevo().nombre" (input)="nuevo.update((n) => ({ ...n, nombre: $any($event.target).value }))" /></label>
        <label>WhatsApp (10 dígitos) <input type="tel" [value]="nuevo().whatsapp" (input)="nuevo.update((n) => ({ ...n, whatsapp: $any($event.target).value }))" /></label>
        <label>Notas internas <span class="opcional">(solo el panel)</span>
          <textarea maxlength="1000" rows="2" [value]="nuevo().notasInternas" (input)="nuevo.update((n) => ({ ...n, notasInternas: $any($event.target).value }))"></textarea></label>
        <button class="btn primario" type="submit" [disabled]="ocupado()">Guardar vendedor</button>
      </form>
    </details>

    <ul class="vendedores">
      @for (v of vendedores.value() ?? []; track v.id) {
        <li>
          <div>
            <p><strong>{{ v.nombre }}</strong>
              @if (v.verificado) { <span class="sello ok">✓ Verificado</span> }
              @if (v.bloqueado) { <span class="sello no">Bloqueado</span> }</p>
            <p class="meta"><a [href]="'https://wa.me/' + v.whatsapp" target="_blank" rel="noopener">{{ v.whatsapp.slice(2) }}</a>
              · <a [routerLink]="[]" [queryParams]="{ ver: 'anuncios' }">{{ v.activos }} activos de {{ v.total }}</a></p>
            @if (editando() === v.id) {
              <label class="notas">Notas internas
                <textarea maxlength="1000" rows="2" [value]="notas()" (input)="notas.set($any($event.target).value)"></textarea></label>
              <div class="acciones">
                <button type="button" class="btn primario" (click)="guardarNotas(v)">Guardar notas</button>
                <button type="button" class="btn secundario" (click)="editando.set(null)">Cancelar</button>
              </div>
            } @else if (v.notasInternas) {
              <p class="meta">📝 {{ v.notasInternas }}</p>
            }
          </div>
          <div class="acciones">
            <button type="button" class="btn secundario" [disabled]="ocupado()" (click)="verificar(v)">{{ v.verificado ? 'Quitar verificación' : '✓ Verificar' }}</button>
            <button type="button" class="btn secundario" [disabled]="ocupado()" (click)="bloquear(v)">{{ v.bloqueado ? 'Desbloquear' : 'Bloquear' }}</button>
            <button type="button" class="btn secundario" (click)="editando.set(v.id); notas.set(v.notasInternas ?? '')">Notas</button>
          </div>
        </li>
      } @empty {
        <li class="vacio">{{ vendedores.isLoading() ? 'Cargando…' : 'No hay vendedores.' }}</li>
      }
    </ul>
    <p class="ayuda">Verifica a alguien después de confirmar su WhatsApp. Al bloquear, sus anuncios se pausan y no puede publicar; al desbloquear vuelven a revisión.</p>
  `,
  styles: `
    .alta { margin: .8rem 0; summary { cursor: pointer; font-weight: 700; } form { margin-top: .6rem; } }
    .vendedores { list-style: none; margin: .5rem 0 0; padding: 0; display: grid; gap: .6rem; }
    .vendedores > li { display: flex; justify-content: space-between; gap: .8rem; flex-wrap: wrap; padding: .75rem; border: 1px solid var(--linea); border-radius: var(--panel-radio); background: var(--superficie); }
    p { margin: 0 0 .2rem; } .meta { font-size: .85rem; color: var(--tinta-suave); a { color: var(--tinta); } }
    .sello { font-size: .72rem; font-weight: 800; padding: .1rem .45rem; border-radius: 999px; margin-left: .3rem; }
    .sello.ok { background: #2f6b4f; color: #fff; } .sello.no { background: #b42318; color: #fff; }
    .acciones { display: flex; flex-wrap: wrap; gap: .4rem; align-items: flex-start; .btn { padding: .4rem .8rem; font-size: .85rem; } }
    .notas { margin-top: .4rem; }
    .vacio { padding: 1.5rem; justify-content: center !important; color: var(--tinta-suave); }
  `,
})
export class VendedoresTianguis {
  private readonly api = inject(TianguisAdminApi);
  protected readonly busqueda = signal('');
  protected readonly q = signal('');
  readonly vendedores = rxResource({ params: () => this.q(), stream: ({ params }) => this.api.vendedores(params) });
  protected readonly nuevo = signal({ nombre: '', whatsapp: '', notasInternas: '' });
  protected readonly editando = signal<number | null>(null);
  protected readonly notas = signal('');
  protected readonly ocupado = signal(false);
  protected readonly mensaje = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  protected crear(): void {
    const n = this.nuevo();
    if (!n.nombre.trim() || !whatsappValido(n.whatsapp)) {
      this.error.set('Escribe el nombre y un WhatsApp de 10 dígitos.');
      return;
    }
    this.hacer(this.api.crearVendedor({ nombre: n.nombre.trim(), whatsapp: n.whatsapp, notasInternas: n.notasInternas.trim() || null }),
      `Vendedor ${n.nombre.trim()} dado de alta.`, () => this.nuevo.set({ nombre: '', whatsapp: '', notasInternas: '' }));
  }

  protected verificar(v: VendedorAdmin): void {
    this.hacer(this.api.verificar(v.id, !v.verificado), v.verificado ? `${v.nombre} ya no está verificado.` : `${v.nombre} verificado.`);
  }

  protected bloquear(v: VendedorAdmin): void {
    this.hacer(this.api.bloquear(v.id, !v.bloqueado),
      v.bloqueado ? `${v.nombre} desbloqueado; sus anuncios pausados volvieron a revisión.` : `${v.nombre} bloqueado; sus anuncios se pausaron.`);
  }

  protected guardarNotas(v: VendedorAdmin): void {
    this.hacer(this.api.editarVendedor(v.id, { nombre: v.nombre, whatsapp: v.whatsapp, notasInternas: this.notas().trim() || null }),
      'Notas guardadas.', () => this.editando.set(null));
  }

  private hacer(o: ReturnType<TianguisAdminApi['verificar']>, ok: string, despues?: () => void): void {
    this.ocupado.set(true);
    this.error.set(null);
    o.subscribe({
      next: () => {
        this.ocupado.set(false);
        this.mensaje.set(ok);
        despues?.();
        this.vendedores.reload();
      },
      error: (e) => {
        this.ocupado.set(false);
        this.error.set(mensajeDeError(e));
      },
    });
  }
}
