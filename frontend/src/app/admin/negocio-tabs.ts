import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NegocioAdmin } from './admin.model';
import { textosCatalogo } from './textos';

/** Encabezado de un negocio en el panel, con sus pestañas. */
@Component({
  selector: 'app-negocio-tabs',
  imports: [RouterLink],
  template: `
    <p class="migas"><a routerLink="/admin">← Negocios</a></p>
    <header class="panel-titulo" [style.--acento]="negocio()?.colorPrimario">
      <h1>{{ negocio()?.nombre ?? '…' }}</h1>
      <p class="ayuda"><a [href]="'/' + slug()" target="_blank" rel="noopener">Ver la página en el sitio ↗</a></p>
    </header>
    <nav class="pestanas" aria-label="Secciones del negocio">
      <a [routerLink]="base()" [class.activo]="seccion() === 'catalogo'">{{ textos().plural }}</a>
      @if (negocio()?.tipo === 'SERVICIO') {
        <a [routerLink]="base() + '/lista-del-mandado'" [class.activo]="seccion() === 'lista'">Lista del mandado</a>
        <a [routerLink]="base() + '/comida'" [class.activo]="seccion() === 'comida'">Comida</a>
      }
      <a [routerLink]="base() + '/categorias'" [class.activo]="seccion() === 'categorias'">Categorías</a>
      <a [routerLink]="base() + '/datos'" [class.activo]="seccion() === 'datos'">Datos del negocio</a>
      @if (negocio()?.tipo !== 'SERVICIO') {
        <a [routerLink]="base() + '/equipo'" [class.activo]="seccion() === 'equipo'">{{ negocio()?.modoPedido === 'CITA' ? 'Equipo y agenda' : 'Equipo' }}</a>
      }
      <a [routerLink]="base() + '/fotos'" [class.activo]="seccion() === 'fotos'">Fotos</a>
    </nav>
  `,
})
export class NegocioTabs {
  readonly slug = input.required<string>();
  readonly negocio = input<NegocioAdmin | undefined>();
  /** Pestaña marcada; la de catálogo sigue marcada al editar un producto. */
  readonly seccion = input<'catalogo' | 'lista' | 'comida' | 'categorias' | 'datos' | 'fotos' | 'equipo'>('catalogo');
  protected readonly base = computed(() => `/admin/negocios/${this.slug()}`);
  protected readonly textos = computed(() => textosCatalogo(this.negocio()?.tipo));
}
