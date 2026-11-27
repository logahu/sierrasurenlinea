import { Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { NegocioAdmin } from './admin.model';
import { AdminApi } from './admin.api';
import { mensajeDeError } from './autorizacion';
import { SesionService } from './sesion';
import { textosCatalogo } from './textos';
import { acentoLegible } from '../color';

/** Sección del negocio que está abierta. */
export type SeccionNegocio =
  | 'resumen' | 'catalogo' | 'lista' | 'comida' | 'categorias' | 'fotos' | 'equipo'
  | 'identidad' | 'contacto' | 'google' | 'datos';

interface Enlace {
  texto: string;
  /** Segmentos después de /admin/negocios/:slug. */
  ruta: string[];
  seccion: SeccionNegocio;
  queryParams?: Record<string, string>;
}

/** Las secciones de un negocio, agrupadas como en el menú lateral del negocio. */
export function seccionesDe(
  n: Pick<NegocioAdmin, 'tipo' | 'modoPedido'> | undefined,
): { titulo: string | null; enlaces: Enlace[] }[] {
  const textos = textosCatalogo(n?.tipo);
  const servicio = n?.tipo === 'SERVICIO';
  const grupos: { titulo: string | null; enlaces: Enlace[] }[] = [
    { titulo: null, enlaces: [{ texto: 'Resumen', ruta: [], seccion: 'resumen' }] },
    {
      titulo: 'Lo que ofrece',
      enlaces: [
        { texto: textos.plural, ruta: ['catalogo'], seccion: 'catalogo' },
        ...(servicio
          ? [
              { texto: 'Lista del mandado', ruta: ['lista-del-mandado'], seccion: 'lista' as const },
              { texto: 'Comida', ruta: ['comida'], seccion: 'comida' as const },
            ]
          : []),
        { texto: 'Categorías', ruta: ['categorias'], seccion: 'categorias' },
        { texto: 'Fotos', ruta: ['fotos'], seccion: 'fotos' },
      ],
    },
    {
      titulo: 'Cómo atiende',
      enlaces: servicio
        ? []
        : [{ texto: n?.modoPedido === 'CITA' ? 'Horario de citas y equipo' : 'Equipo', ruta: ['equipo'], seccion: 'equipo' }],
    },
    {
      titulo: 'Datos del negocio',
      enlaces: [
        { texto: 'Identidad y apariencia', ruta: ['datos', 'identidad'], seccion: 'identidad' },
        { texto: servicio ? 'Contacto y mandados' : 'Contacto y ubicación', ruta: ['datos', 'contacto'], seccion: 'contacto' },
        { texto: 'Google', ruta: ['datos', 'google'], seccion: 'google' },
      ],
    },
  ];
  return grupos.filter((g) => g.enlaces.length);
}

/**
 * Marco de un negocio en el panel: migas, encabezado con su visibilidad (el administrador la cambia
 * aquí mismo) y el menú del negocio agrupado. En escritorio el menú va a la izquierda del contenido.
 */
@Component({
  selector: 'app-negocio-tabs',
  imports: [RouterLink],
  template: `
    <p class="migas negocio-migas">
      @if (sesion.esDueno()) { <a routerLink="/admin/negocios">Mis negocios</a> / } {{ actual()?.nombre ?? '…' }}
    </p>
    <header class="negocio-cabeza" [style.--acento]="acento(actual()?.colorPrimario)">
      <span class="negocio-sello" aria-hidden="true" [style.background]="actual()?.colorPrimario">{{ inicial() }}</span>
      <div class="negocio-nombre">
        <h1>{{ actual()?.nombre ?? '…' }}</h1>
        <p class="ayuda"><a [href]="'/' + slug()" target="_blank" rel="noopener">Ver en el sitio ↗</a></p>
      </div>
      @if (actual(); as n) {
        @if (sesion.esDueno()) {
          <div class="negocio-estado" role="radiogroup" [attr.aria-label]="'Visibilidad de ' + n.nombre">
            @for (e of estados; track e.valor) {
              <button type="button" role="radio" [attr.aria-checked]="n.estado === e.valor" [attr.data-estado]="e.valor"
                      [class.elegido]="n.estado === e.valor" [disabled]="cambiando()" (click)="cambiarEstado(n, e.valor)"
                      [title]="e.ayuda">{{ e.texto }}</button>
            }
          </div>
          <label class="interruptor">
            <input type="checkbox" role="switch" [checked]="n.visibleApp && n.estado !== 'OCULTO'"
                   [disabled]="cambiando() || n.estado === 'OCULTO'" (change)="cambiarApp(n, $any($event.target).checked)" />
            <span>En la app</span>
          </label>
        } @else {
          <span class="negocio-chip" [attr.data-estado]="n.estado">{{ nombreEstado(n.estado) }}</span>
        }
      }
      @if (error(); as e) { <p class="error negocio-error" role="alert">{{ e }}</p> }
    </header>
    <nav class="negocio-menu" [attr.aria-label]="'Secciones de ' + (actual()?.nombre ?? 'el negocio')">
      @for (g of grupos(); track $index) {
        <div class="negocio-grupo">
          @if (g.titulo) { <p class="negocio-grupo-titulo">{{ g.titulo }}</p> }
          @for (e of g.enlaces; track e.seccion) {
            <a [routerLink]="[base()].concat(e.ruta)" [class.activo]="marcada() === e.seccion"
               [attr.aria-current]="marcada() === e.seccion ? 'page' : null">{{ e.texto }}</a>
          }
        </div>
      }
      @if (sesion.esDueno()) {
        <div class="negocio-grupo">
          <p class="negocio-grupo-titulo">Más</p>
          <a routerLink="/admin/usuarios" [queryParams]="{ negocio: slug() }">Encargado</a>
          <a routerLink="/admin/historial" [queryParams]="{ negocio: slug() }">Actividad</a>
        </div>
      }
    </nav>
  `,
})
export class NegocioTabs {
  protected readonly acento = acentoLegible;
  protected readonly sesion = inject(SesionService);
  private readonly api = inject(AdminApi);

  readonly slug = input.required<string>();
  readonly negocio = input<NegocioAdmin | undefined>();
  /** Sección marcada; la del catálogo sigue marcada al editar un producto. */
  readonly seccion = input<SeccionNegocio>('catalogo');

  /** Copia local: al cambiar la visibilidad se actualiza sin recargar la página. */
  protected readonly actual = linkedSignal(() => this.negocio());
  protected readonly base = computed(() => `/admin/negocios/${this.slug()}`);
  protected readonly grupos = computed(() => seccionesDe(this.actual()));
  protected readonly marcada = computed<SeccionNegocio>(() => (this.seccion() === 'datos' ? 'identidad' : this.seccion()));
  protected readonly inicial = computed(() => (this.actual()?.nombre ?? '').trim().charAt(0).toUpperCase());
  protected readonly cambiando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly estados = [
    { valor: 'PUBLICO' as const, texto: 'Público', ayuda: 'Lo ven todos los clientes' },
    { valor: 'PRUEBAS' as const, texto: 'En pruebas', ayuda: 'Solo lo ven los clientes probadores; sus pedidos llegan como PRUEBA' },
    { valor: 'OCULTO' as const, texto: 'Oculto', ayuda: 'No lo ve nadie en el sitio' },
  ];

  protected nombreEstado(e: NegocioAdmin['estado']): string {
    return e === 'PUBLICO' ? 'Público' : e === 'PRUEBAS' ? 'En pruebas' : 'Oculto';
  }

  protected cambiarEstado(n: NegocioAdmin, estado: NegocioAdmin['estado']): void {
    if (n.estado !== estado) this.guardar(this.api.cambiarEstado(n.slug, estado));
  }

  protected cambiarApp(n: NegocioAdmin, visible: boolean): void {
    this.guardar(this.api.cambiarVisibleApp(n.slug, visible));
  }

  private guardar(op: Observable<NegocioAdmin>): void {
    this.error.set(null);
    this.cambiando.set(true);
    op.subscribe({
      next: (nuevo) => {
        this.actual.set(nuevo);
        this.cambiando.set(false);
      },
      error: (e) => {
        this.error.set(mensajeDeError(e));
        this.cambiando.set(false);
      },
    });
  }
}
