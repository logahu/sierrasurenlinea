import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CategoriasTianguis } from './categorias-tianguis';
import { ListaAnuncios } from './lista-anuncios';
import { ReportesTianguis } from './reportes-tianguis';
import { TianguisAdminApi } from './tianguis-admin.api';
import { VendedoresTianguis } from './vendedores-tianguis';

type Vista = 'pendientes' | 'anuncios' | 'reportes' | 'vendedores' | 'categorias';

/** Panel → Tianguis: moderación, anuncios, reportes, vendedores y categorías (?ver=…). */
@Component({
  selector: 'app-tianguis-admin-page',
  imports: [RouterLink, ListaAnuncios, ReportesTianguis, VendedoresTianguis, CategoriasTianguis],
  template: `
    <p class="migas"><a routerLink="/admin">← Negocios</a> · <a routerLink="/tianguis" target="_blank">Ver el tianguis</a></p>
    <div class="panel-titulo">
      <h1>Tianguis</h1>
      <a class="btn primario" routerLink="/admin/tianguis/nuevo">＋ Nuevo anuncio</a>
    </div>
    <nav class="pestanas" aria-label="Secciones del tianguis">
      @for (p of pestanas; track p.ver) {
        <a [routerLink]="[]" [queryParams]="{ ver: p.ver === 'pendientes' ? null : p.ver }" [attr.aria-current]="vista() === p.ver ? 'page' : null">
          {{ p.texto }}
          @if (p.ver === 'pendientes' && api.pendientes()) { <span class="marca-nuevos">{{ api.pendientes() }}</span> }
          @if (p.ver === 'reportes' && api.reportes()) { <span class="marca-nuevos">{{ api.reportes() }}</span> }
        </a>
      }
    </nav>
    @switch (vista()) {
      @case ('pendientes') { <app-lista-anuncios modo="pendientes" /> }
      @case ('anuncios') { <app-lista-anuncios modo="todos" /> }
      @case ('reportes') { <app-reportes-tianguis /> }
      @case ('vendedores') { <app-vendedores-tianguis /> }
      @case ('categorias') { <app-categorias-tianguis /> }
    }
  `,
  styles: `
    .panel-titulo { display: flex; justify-content: space-between; align-items: center; gap: .8rem; flex-wrap: wrap; }
    .pestanas { display: flex; gap: .3rem; overflow-x: auto; margin: 1rem 0 .5rem; border-bottom: 1px solid var(--linea); scrollbar-width: none; }
    .pestanas a { flex: none; padding: .55rem .8rem; border-bottom: 3px solid transparent; color: var(--tinta-suave); font-weight: 700; text-decoration: none; display: inline-flex; gap: .35rem; align-items: center; }
    .pestanas a[aria-current='page'] { color: var(--tinta); border-bottom-color: var(--follaje); }
  `,
})
export class TianguisAdminPage {
  protected readonly api = inject(TianguisAdminApi);
  readonly ver = input<string>();
  protected readonly pestanas: { ver: Vista; texto: string }[] = [
    { ver: 'pendientes', texto: 'Por revisar' },
    { ver: 'anuncios', texto: 'Anuncios' },
    { ver: 'reportes', texto: 'Reportes' },
    { ver: 'vendedores', texto: 'Vendedores' },
    { ver: 'categorias', texto: 'Categorías' },
  ];
  protected readonly vista = computed<Vista>(() => (this.pestanas.find((p) => p.ver === this.ver())?.ver ?? 'pendientes'));

  constructor() {
    this.api.actualizarResumen();
  }
}
