import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { RenglonHistorial } from './admin.model';
import { AdminApi } from './admin.api';
import { mensajeDeError } from './autorizacion';
import { SesionService } from './sesion';

const ENTIDADES: { valor: string; texto: string }[] = [
  { valor: '', texto: 'Todo' },
  { valor: 'PEDIDO', texto: 'Pedidos' },
  { valor: 'PRODUCTO', texto: 'Productos' },
  { valor: 'CATEGORIA', texto: 'Categorías' },
  { valor: 'NEGOCIO', texto: 'Datos del negocio' },
  { valor: 'FOTO', texto: 'Fotos' },
  { valor: 'ENCARGO', texto: 'Lista del mandado' },
  { valor: 'COMIDA', texto: 'Comida' },
  { valor: 'USUARIO', texto: 'Usuarios del panel' },
  { valor: 'CLIENTE', texto: 'Clientes' },
  { valor: 'COLONIA', texto: 'Colonias' },
  { valor: 'ANUNCIO', texto: 'Publicidad' },
];

const ICONOS: Record<string, string> = {
  PEDIDO: '🧾', PRODUCTO: '🏷️', CATEGORIA: '🗂️', NEGOCIO: '🏪', FOTO: '🖼️', ENCARGO: '📝', COMIDA: '🍲', USUARIO: '👤', CLIENTE: '🙋', COLONIA: '📍', ANUNCIO: '📣',
};

/**
 * Historial: quién hizo qué y cuándo. Solo lectura. El administrador ve todo y puede
 * filtrar por negocio; el encargado ve lo de su negocio.
 */
@Component({
  selector: 'app-historial-page',
  imports: [DatePipe],
  template: `
    <header class="panel-titulo">
      <h1>Historial</h1>
      <p class="ayuda">Cada cambio queda registrado con quién lo hizo y cuándo. El historial no se puede editar ni borrar.</p>
    </header>

    <form class="filtros-historial" (submit)="$event.preventDefault(); buscar(q.value)">
      <label>
        Qué
        <select [value]="entidad()" (change)="entidad.set(valor($event)); reiniciar()">
          @for (e of entidades; track e.valor) { <option [value]="e.valor">{{ e.texto }}</option> }
        </select>
      </label>
      @if (sesion.esDueno()) {
        <label>
          Negocio
          <select [value]="negocio()" (change)="negocio.set(valor($event)); reiniciar()">
            <option value="">Todos</option>
            @for (n of negocios.value() ?? []; track n.slug) { <option [value]="n.slug">{{ n.nombre }}</option> }
          </select>
        </label>
      }
      <label class="crece">
        Buscar
        <input #q type="search" placeholder="Folio, producto, persona…" [value]="texto()" />
      </label>
      <button class="btn secundario" type="submit">Buscar</button>
    </form>

    @if (error(); as e) { <p class="error" role="alert">{{ e }}</p> }

    <ol class="historial">
      @for (r of renglones(); track r.id; let i = $index) {
        @if (i === 0 || dia(r) !== dia(renglones()[i - 1])) {
          <li class="dia">{{ r.cuando | date: "EEEE d 'de' MMMM y" }}</li>
        }
        <li class="renglon">
          <span class="icono" aria-hidden="true">{{ icono(r.entidad) }}</span>
          <div>
            <p class="accion">{{ r.accion }}</p>
            @if (r.detalle) { <p class="detalle">{{ r.detalle }}</p> }
            <p class="quien">
              {{ r.cuando | date: 'h:mm a' }} · {{ r.actorNombre }}{{ r.actorTipo === 'CLIENTE' ? ' (cliente)' : '' }}
              @if (r.negocioNombre && sesion.esDueno()) { · {{ r.negocioNombre }} }
            </p>
          </div>
        </li>
      } @empty {
        @if (!cargando()) { <li class="ayuda vacio">No hay movimientos con esos filtros.</li> }
      }
    </ol>
    @if (cargando()) { <p class="ayuda">Cargando…</p> }
    @if (hayMas() && !cargando()) {
      <button type="button" class="btn secundario" (click)="cargar()">Ver más</button>
    }
  `,
  styles: `
    .filtros-historial { display: flex; flex-wrap: wrap; gap: .6rem; align-items: flex-end; margin-bottom: 1.25rem; }
    .filtros-historial label { display: grid; gap: .25rem; font-size: .85rem; font-weight: 600; }
    .filtros-historial .crece { flex: 1 1 12rem; }
    .historial { list-style: none; margin: 0; padding: 0; }
    .dia { margin: 1.1rem 0 .4rem; font-weight: 700; font-size: .85rem; color: var(--tinta-suave); }
    .dia::first-letter { text-transform: uppercase; }
    .renglon { display: flex; gap: .75rem; padding: .65rem 0; border-bottom: 1px solid var(--linea); }
    .icono { font-size: 1.15rem; line-height: 1.4; }
    .accion { margin: 0; font-weight: 600; }
    .detalle { margin: .15rem 0 0; font-size: .88rem; color: var(--tinta); overflow-wrap: anywhere; }
    .quien { margin: .2rem 0 0; font-size: .82rem; color: var(--tinta-suave); }
    .vacio { padding: 1.5rem 0; }
  `,
})
export class HistorialPage {
  private readonly api = inject(AdminApi);
  protected readonly sesion = inject(SesionService);
  protected readonly entidades = ENTIDADES;
  protected readonly negocios = rxResource({ stream: () => this.api.negocios() });

  protected readonly entidad = signal('');
  protected readonly negocio = signal('');
  protected readonly texto = signal('');
  protected readonly renglones = signal<RenglonHistorial[]>([]);
  protected readonly hayMas = signal(false);
  protected readonly cargando = signal(false);
  protected readonly error = signal<string | null>(null);
  private pagina = 0;

  constructor() {
    this.cargar();
  }

  protected valor(e: Event): string {
    return (e.target as HTMLSelectElement).value;
  }

  protected icono(entidad: string): string {
    return ICONOS[entidad] ?? '•';
  }

  protected dia(r: RenglonHistorial): string {
    return new Date(r.cuando).toDateString();
  }

  protected buscar(q: string): void {
    this.texto.set(q.trim());
    this.reiniciar();
  }

  protected reiniciar(): void {
    this.pagina = 0;
    this.renglones.set([]);
    this.cargar();
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.api
      .historial({ entidad: this.entidad(), negocio: this.negocio(), q: this.texto(), pagina: this.pagina })
      .pipe(finalize(() => this.cargando.set(false)))
      .subscribe({
        next: (p) => {
          this.renglones.update((r) => [...r, ...p.renglones]);
          this.hayMas.set(p.hayMas);
          this.pagina++;
        },
        error: (e) => this.error.set(mensajeDeError(e)),
      });
  }
}
