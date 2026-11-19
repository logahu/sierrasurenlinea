import { Component, computed, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { EstadoAnuncio } from '../../tianguis/tianguis.model';
import { ESTADOS, haceCuanto, precioMxn, textoCondicion, valorAtributo } from '../../tianguis/tianguis';
import { mensajeDeError } from '../autorizacion';
import { AnuncioAdmin, MOTIVOS_RECHAZO, TianguisAdminApi } from './tianguis-admin.api';

/** Anuncios del panel. «pendientes»: bandeja de revisión (aprobar/rechazar). «todos»: filtros y acciones rápidas. */
@Component({
  selector: 'app-lista-anuncios',
  imports: [RouterLink],
  template: `
    @if (modo() === 'todos') {
      <div class="filtros">
        <label>Estado
          <select (change)="estado.set($any($event.target).value || null); pagina.set(0)">
            <option value="">Todos</option>
            @for (e of estados; track e[0]) { <option [value]="e[0]" [selected]="estado() === e[0]">{{ e[1] }}</option> }
          </select>
        </label>
        <label>Categoría
          <select (change)="categoria.set($any($event.target).value || null); pagina.set(0)">
            <option value="">Todas</option>
            @for (c of categorias.value() ?? []; track c.slug) { <option [value]="c.slug">{{ c.nombre }}</option> }
          </select>
        </label>
        <label class="buscar">Buscar
          <input type="search" placeholder="Título, vendedor o WhatsApp" [value]="q()" (change)="q.set($any($event.target).value); pagina.set(0)" />
        </label>
      </div>
    } @else {
      <p class="ayuda">Los más antiguos primero. Al aprobar se publica 30 días; al rechazar, el vendedor ve el motivo en su enlace.</p>
    }
    @if (mensaje(); as m) { <p class="exito" role="status">{{ m }}</p> }
    @if (error(); as e) { <p class="error" role="alert">{{ e }}</p> }

    @if (lista.isLoading() && !lista.hasValue()) {
      <p class="ayuda" aria-busy="true">Cargando…</p>
    } @else if (lista.error()) {
      <p class="error">No se pudieron cargar los anuncios. <button type="button" class="btn secundario" (click)="lista.reload()">Reintentar</button></p>
    } @else {
      <p class="ayuda">{{ total() }} {{ total() === 1 ? 'anuncio' : 'anuncios' }}</p>
      <ul class="anuncios">
        @for (a of anuncios(); track a.id) {
          <li class="anuncio" [attr.data-estado]="a.estado">
            <div class="fotos">
              @for (f of a.fotos.slice(0, modo() === 'pendientes' ? 4 : 1); track f) { <img [src]="f" alt="" width="96" height="72" loading="lazy" /> }
            </div>
            <div class="cuerpo">
              <p class="titulo"><strong>{{ a.titulo }}</strong> · {{ precio(a.precio) }}@if (a.negociable) { <small> negociable</small> }</p>
              <p class="meta">
                <span class="estado">{{ estados_[a.estado] }}</span>
                {{ a.categoria.nombre }} · {{ condicion(a.condicion) }} · {{ a.ubicacion }}
                @if (a.reportesSinAtender) { · <strong class="alerta">⚠ {{ a.reportesSinAtender }} reporte(s)</strong> }
              </p>
              <p class="meta">
                {{ a.vendedor.nombre }} · <a [href]="'https://wa.me/' + a.vendedor.whatsapp" target="_blank" rel="noopener">{{ a.vendedor.whatsapp.slice(2) }}</a>
                @if (a.vendedor.verificado) { · ✓ verificado }
                @if (a.vendedor.bloqueado) { · <strong class="alerta">bloqueado</strong> }
                · {{ a.delPublico ? 'enviado por el público' : 'alta en el panel' }} {{ hace(a.fechaCreacion) }}
              </p>
              @if (modo() === 'pendientes') {
                @if (atributos(a); as t) { <p class="meta">{{ t }}</p> }
                <p class="descripcion">{{ a.descripcion }}</p>
              }
              @if (a.estado === 'RECHAZADO' && a.motivoRechazo) { <p class="meta">Motivo: {{ a.motivoRechazo }}</p> }
              @if (a.estado === 'PAUSADO' && a.pausadoPor) { <p class="meta">Pausado por: {{ pausadoPor(a.pausadoPor) }}</p> }

              @if (rechazando() === a.id) {
                <div class="rechazo">
                  <label>Motivo (lo verá el vendedor)
                    <select (change)="motivo.set($any($event.target).value)">
                      <option value="">Elige un motivo…</option>
                      @for (m of motivos; track m) { <option [value]="m">{{ m }}</option> }
                    </select>
                  </label>
                  <label>Detalle <span class="opcional">(opcional)</span>
                    <input maxlength="150" [value]="detalle()" (input)="detalle.set($any($event.target).value)" />
                  </label>
                  <div class="acciones">
                    <button type="button" class="btn primario" [disabled]="ocupado()" (click)="rechazar(a)">Rechazar</button>
                    <button type="button" class="btn secundario" (click)="rechazando.set(null)">Cancelar</button>
                  </div>
                </div>
              } @else {
                <div class="acciones">
                  @for (acc of acciones(a); track acc.estado) {
                    <button type="button" class="btn" [class.primario]="acc.principal" [class.secundario]="!acc.principal" [disabled]="ocupado()"
                            (click)="acc.estado === 'RECHAZADO' ? empezarRechazo(a) : cambiar(a, acc.estado, acc.hecho)">{{ acc.texto }}</button>
                  }
                  <a class="btn secundario" [routerLink]="['/admin/tianguis', a.id]">Editar</a>
                  @if (a.estado === 'PUBLICADO' || a.estado === 'VENDIDO') {
                    <a class="btn secundario" [routerLink]="['/tianguis', a.idSlug]" target="_blank">Ver</a>
                  }
                </div>
              }
            </div>
          </li>
        } @empty {
          <li class="vacio">{{ modo() === 'pendientes' ? '¡Al día! No hay anuncios por revisar.' : 'No hay anuncios con esos filtros.' }}</li>
        }
      </ul>
      @if (paginas() > 1) {
        <div class="paginas">
          <button type="button" class="btn secundario" [disabled]="pagina() === 0" (click)="pagina.update((p) => p - 1)">← Anteriores</button>
          <span>{{ pagina() + 1 }} de {{ paginas() }}</span>
          <button type="button" class="btn secundario" [disabled]="pagina() + 1 >= paginas()" (click)="pagina.update((p) => p + 1)">Siguientes →</button>
        </div>
      }
    }
  `,
  styles: `
    .filtros { display: grid; grid-template-columns: 1fr 1fr 2fr; gap: .5rem; margin: .5rem 0; }
    @media (max-width: 36rem) { .filtros { grid-template-columns: 1fr 1fr; } .buscar { grid-column: 1 / -1; } }
    .anuncios { list-style: none; margin: .5rem 0 0; padding: 0; display: grid; gap: .7rem; }
    .anuncio { display: grid; grid-template-columns: auto 1fr; gap: .8rem; padding: .8rem; border: 1px solid var(--linea); border-radius: var(--panel-radio); background: var(--superficie); }
    .anuncio[data-estado='PENDIENTE'] { border-left: 4px solid var(--cempasuchil); }
    .fotos { display: grid; gap: .3rem; align-content: start; }
    .fotos img { width: 6rem; height: 4.5rem; object-fit: cover; border-radius: .45rem; background: var(--fondo-alt); }
    .cuerpo { min-width: 0; display: grid; gap: .25rem; }
    .cuerpo p { margin: 0; }
    .titulo small { color: var(--tinta-suave); }
    .meta { font-size: .85rem; color: var(--tinta-suave); }
    .meta a { color: var(--tinta); }
    .estado { display: inline-block; font-weight: 700; font-size: .75rem; padding: .1rem .45rem; border-radius: 999px; background: var(--fondo-alt); color: var(--tinta); margin-right: .2rem; }
    .alerta { color: #b42318; }
    .descripcion { font-size: .9rem; white-space: pre-line; max-height: 7.5rem; overflow: auto; background: var(--fondo-alt); padding: .5rem .6rem; border-radius: .5rem; }
    .acciones { display: flex; flex-wrap: wrap; gap: .4rem; margin-top: .3rem; }
    .acciones .btn { padding: .4rem .8rem; font-size: .85rem; }
    .rechazo { display: grid; gap: .5rem; margin-top: .4rem; }
    .vacio { padding: 1.5rem; text-align: center; color: var(--tinta-suave); border: 1px dashed var(--linea); border-radius: var(--panel-radio); }
    .paginas { display: flex; justify-content: space-between; align-items: center; margin-top: .8rem; }
    @media (prefers-color-scheme: dark) { .alerta { color: #ff9b8f; } }
  `,
})
export class ListaAnuncios {
  private readonly api = inject(TianguisAdminApi);
  readonly modo = input<'pendientes' | 'todos'>('todos');

  protected readonly estados = Object.entries(ESTADOS) as [EstadoAnuncio, string][];
  protected readonly estados_ = ESTADOS;
  protected readonly motivos = MOTIVOS_RECHAZO;
  protected readonly estado = signal<string | null>(null);
  protected readonly categoria = signal<string | null>(null);
  protected readonly q = signal('');
  protected readonly pagina = signal(0);

  readonly categorias = rxResource({ stream: () => this.api.categorias() });
  readonly lista = rxResource({
    params: () => ({
      estado: this.modo() === 'pendientes' ? 'PENDIENTE' : this.estado(),
      categoria: this.categoria(), q: this.q(), page: this.pagina(),
    }),
    stream: ({ params }) => this.api.anuncios(params),
  });
  protected readonly anuncios = computed(() => (this.lista.hasValue() ? this.lista.value()?.anuncios : []) ?? []);
  protected readonly total = computed(() => (this.lista.hasValue() ? this.lista.value()?.total : 0) ?? 0);
  protected readonly paginas = computed(() => (this.lista.hasValue() ? this.lista.value()?.paginas : 0) ?? 0);

  protected readonly ocupado = signal(false);
  protected readonly mensaje = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly rechazando = signal<number | null>(null);
  protected readonly motivo = signal('');
  protected readonly detalle = signal('');

  protected precio = precioMxn;
  protected condicion = textoCondicion;
  protected hace = haceCuanto;

  /** «Marca: Motorola · IMEI limpio: Sí» con las etiquetas de su categoría. */
  protected atributos(a: AnuncioAdmin): string {
    const campos = (this.categorias.value() ?? []).find((c) => c.slug === a.categoria.slug)?.campos ?? [];
    return Object.entries(a.atributos)
      .map(([k, v]) => {
        const c = campos.find((x) => x.nombre === k);
        return `${c?.etiqueta ?? k}: ${valorAtributo(v, c?.unidad)}`;
      })
      .join(' · ');
  }

  protected pausadoPor(p: string): string {
    return ({ VENDEDOR: 'el vendedor', ADMIN: 'el panel', REPORTES: 'reportes', BLOQUEO: 'vendedor bloqueado' } as Record<string, string>)[p] ?? p;
  }

  /** Acciones rápidas válidas según el estado. */
  protected acciones(a: AnuncioAdmin): { estado: EstadoAnuncio; texto: string; hecho: string; principal?: boolean }[] {
    switch (a.estado) {
      case 'PENDIENTE': return [
        { estado: 'PUBLICADO', texto: '✓ Aprobar y publicar', hecho: 'Publicado por 30 días.', principal: true },
        { estado: 'RECHAZADO', texto: 'Rechazar', hecho: '' },
      ];
      case 'PUBLICADO': return [
        { estado: 'PAUSADO', texto: 'Pausar', hecho: 'Pausado.' },
        { estado: 'VENDIDO', texto: 'Marcar vendido', hecho: 'Marcado como vendido.' },
        { estado: 'RECHAZADO', texto: 'Retirar', hecho: '' },
      ];
      case 'PAUSADO': return [
        { estado: 'PUBLICADO', texto: 'Publicar', hecho: 'Publicado por 30 días.', principal: true },
        { estado: 'VENDIDO', texto: 'Marcar vendido', hecho: 'Marcado como vendido.' },
        { estado: 'RECHAZADO', texto: 'Retirar', hecho: '' },
      ];
      case 'VENCIDO': return [{ estado: 'PUBLICADO', texto: 'Publicar otra vez', hecho: 'Publicado por 30 días.' }];
      case 'RECHAZADO': return [{ estado: 'PUBLICADO', texto: 'Publicar', hecho: 'Publicado por 30 días.' }];
      case 'VENDIDO': return [{ estado: 'PUBLICADO', texto: 'Volver a publicar', hecho: 'Publicado por 30 días.' }];
    }
  }

  protected cambiar(a: AnuncioAdmin, estado: EstadoAnuncio, hecho: string, motivo?: string): void {
    this.ocupado.set(true);
    this.error.set(null);
    this.mensaje.set(null);
    this.api.estado(a.id, estado, motivo).subscribe({
      next: () => {
        this.ocupado.set(false);
        this.rechazando.set(null);
        this.mensaje.set(`«${a.titulo}»: ${hecho}`);
        this.lista.reload();
      },
      error: (e) => {
        this.ocupado.set(false);
        this.error.set(mensajeDeError(e));
      },
    });
  }

  protected empezarRechazo(a: AnuncioAdmin): void {
    this.motivo.set('');
    this.detalle.set('');
    this.rechazando.set(a.id);
  }

  protected rechazar(a: AnuncioAdmin): void {
    const m = [this.motivo(), this.detalle().trim()].filter(Boolean).join('. ');
    if (!m) {
      this.error.set('Elige o escribe el motivo del rechazo.');
      return;
    }
    this.cambiar(a, 'RECHAZADO', 'Rechazado; el vendedor verá el motivo.', m);
  }
}
