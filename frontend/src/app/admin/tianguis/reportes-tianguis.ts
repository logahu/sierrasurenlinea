import { Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { EstadoAnuncio } from '../../tianguis/tianguis.model';
import { ESTADOS, haceCuanto } from '../../tianguis/tianguis';
import { mensajeDeError } from '../autorizacion';
import { ReporteAdmin, TianguisAdminApi } from './tianguis-admin.api';

export interface GrupoReportes {
  anuncioId: number;
  titulo: string;
  estado: EstadoAnuncio;
  reportes: ReporteAdmin[];
}

/** Agrupa los reportes por anuncio (los más reportados primero). */
export function agrupar(reportes: ReporteAdmin[]): GrupoReportes[] {
  const m = new Map<number, GrupoReportes>();
  for (const r of reportes) {
    const g = m.get(r.anuncioId) ?? { anuncioId: r.anuncioId, titulo: r.anuncioTitulo, estado: r.anuncioEstado, reportes: [] };
    g.reportes.push(r);
    m.set(r.anuncioId, g);
  }
  return [...m.values()].sort((a, b) => b.reportes.length - a.reportes.length);
}

/** Reportes sin atender. Con 3, el anuncio ya está pausado. */
@Component({
  selector: 'app-reportes-tianguis',
  imports: [RouterLink],
  template: `
    <p class="ayuda">Con {{ 3 }} reportes sin atender, el anuncio se pausa solo. Revísalo: publícalo de nuevo (si está bien) o retíralo.</p>
    @if (mensaje(); as m) { <p class="exito" role="status">{{ m }}</p> }
    @if (error(); as e) { <p class="error" role="alert">{{ e }}</p> }
    <ul class="grupos">
      @for (g of grupos(); track g.anuncioId) {
        <li>
          <p><strong>{{ g.titulo }}</strong> · {{ estados[g.estado] }} · {{ g.reportes.length }} {{ g.reportes.length === 1 ? 'reporte' : 'reportes' }}</p>
          <ul class="motivos">
            @for (r of g.reportes; track r.id) {
              <li>{{ r.motivoTexto }}@if (r.comentario) { — «{{ r.comentario }}» } <small>{{ hace(r.fecha) }}</small></li>
            }
          </ul>
          <div class="acciones">
            <a class="btn secundario" [routerLink]="['/admin/tianguis', g.anuncioId]">Revisar / editar</a>
            @if (g.estado === 'PAUSADO') {
              <button type="button" class="btn primario" [disabled]="ocupado()" (click)="publicar(g)">Está bien: publicar de nuevo</button>
            }
            @if (g.estado === 'PUBLICADO' || g.estado === 'PAUSADO') {
              <button type="button" class="btn secundario" [disabled]="ocupado()" (click)="retirar(g)">Retirar anuncio</button>
            }
            <button type="button" class="btn secundario" [disabled]="ocupado()" (click)="atender(g)">Marcar atendidos</button>
          </div>
        </li>
      } @empty {
        <li class="vacio">{{ reportes.isLoading() ? 'Cargando…' : 'No hay reportes por atender.' }}</li>
      }
    </ul>
  `,
  styles: `
    .grupos { list-style: none; margin: .5rem 0 0; padding: 0; display: grid; gap: .7rem; }
    .grupos > li { padding: .8rem; border: 1px solid var(--linea); border-left: 4px solid #b42318; border-radius: var(--panel-radio); background: var(--superficie); }
    .grupos p { margin: 0 0 .3rem; }
    .motivos { margin: 0 0 .4rem; padding-left: 1.1rem; font-size: .9rem; small { color: var(--tinta-suave); } }
    .acciones { display: flex; flex-wrap: wrap; gap: .4rem; .btn { padding: .4rem .8rem; font-size: .85rem; } }
    .vacio { padding: 1.5rem; text-align: center; color: var(--tinta-suave); border: 1px dashed var(--linea) !important; border-left-width: 1px !important; }
  `,
})
export class ReportesTianguis {
  private readonly api = inject(TianguisAdminApi);
  readonly reportes = rxResource({ stream: () => this.api.reportesSinAtender() });
  protected readonly grupos = computed(() => agrupar((this.reportes.hasValue() ? this.reportes.value() : []) ?? []));
  protected readonly estados = ESTADOS;
  protected readonly hace = haceCuanto;
  protected readonly ocupado = signal(false);
  protected readonly mensaje = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  protected publicar(g: GrupoReportes): void {
    this.hacer(this.api.estado(g.anuncioId, 'PUBLICADO'), `«${g.titulo}» publicado de nuevo; reportes atendidos.`);
  }

  protected retirar(g: GrupoReportes): void {
    this.hacer(this.api.estado(g.anuncioId, 'RECHAZADO', 'Retirado tras revisar reportes de los compradores'), `«${g.titulo}» retirado.`);
  }

  protected atender(g: GrupoReportes): void {
    this.hacer(this.api.atenderReportes(g.anuncioId), `Reportes de «${g.titulo}» atendidos.`);
  }

  private hacer(o: ReturnType<TianguisAdminApi['atenderReportes']>, ok: string): void {
    this.ocupado.set(true);
    this.error.set(null);
    o.subscribe({
      next: () => {
        this.ocupado.set(false);
        this.mensaje.set(ok);
        this.reportes.reload();
      },
      error: (e) => {
        this.ocupado.set(false);
        this.error.set(mensajeDeError(e));
      },
    });
  }
}
