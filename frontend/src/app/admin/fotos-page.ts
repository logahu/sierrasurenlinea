import { DatePipe } from '@angular/common';
import { Component, computed, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { FotoAdmin } from './admin.model';
import { AdminApi } from './admin.api';
import { mensajeDeError } from './autorizacion';
import { NegocioTabs } from './negocio-tabs';

/** "1.2 MB", "350 KB". */
export function tamano(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1000))} KB`;
}

/**
 * Fotos del negocio: dónde se usa cada una y borrar las que ya no se usan para liberar
 * espacio. Las que están en uso no se pueden borrar (dejarían productos sin imagen).
 */
@Component({
  selector: 'app-fotos-page',
  imports: [NegocioTabs, DatePipe],
  template: `
    <app-negocio-tabs [slug]="slug()" [negocio]="negocio.value()" seccion="fotos" />

    @if (fotos.value(); as f) {
      <p class="ayuda resumen-fotos">
        {{ f.fotos.length }} {{ f.fotos.length === 1 ? 'foto' : 'fotos' }} ·
        {{ tamano(f.bytesEnUso) }} en uso ·
        <strong>{{ tamano(f.bytesSinUsar) }} sin usar</strong>
        @if (f.borradas) { · {{ f.borradas }} borradas ({{ tamano(f.bytesLiberados) }} liberados) }
      </p>
      <div class="chips" role="group" aria-label="Mostrar">
        <button type="button" [class.activo]="!soloSinUsar()" (click)="soloSinUsar.set(false)">Todas</button>
        <button type="button" [class.activo]="soloSinUsar()" (click)="soloSinUsar.set(true)">Sin usar ({{ sinUsar() }})</button>
      </div>
    }
    <p class="ayuda">
      Cuando cambias o quitas la foto de un producto, la anterior queda aquí como "sin usar". Bórrala para liberar
      espacio; el registro queda en el historial.
    </p>
    @if (aviso(); as a) { <p class="exito" role="status">{{ a }}</p> }
    @if (error(); as e) { <p class="error" role="alert">{{ e }}</p> }
    @if (fotos.error(); as e) { <p class="error" role="alert">{{ mensaje(e) }}</p> }

    <ul class="rejilla-fotos">
      @for (f of visibles(); track f.id) {
        <li [class.sin-usar]="!f.usos.length">
          <img [src]="f.url" alt="" loading="lazy" width="160" height="160" />
          <div class="datos-foto">
            <small>{{ tamano(f.bytes) }} · {{ f.subida | date: 'd MMM y' }}@if (f.subidaPor) { · {{ f.subidaPor }} }</small>
            @if (f.usos.length) {
              <ul class="usos">@for (u of f.usos; track u) { <li>{{ u }}</li> }</ul>
            } @else {
              <span class="etiqueta-sin-usar">Sin usar</span>
              @if (confirmando() === f.id) {
                <div class="confirmar">
                  <button type="button" class="btn peligro" (click)="borrar(f)" [disabled]="ocupado()">Sí, borrar</button>
                  <button type="button" class="btn secundario" (click)="confirmando.set(null)">Cancelar</button>
                </div>
              } @else {
                <button type="button" class="btn secundario" (click)="confirmando.set(f.id)">Borrar</button>
              }
            }
          </div>
        </li>
      } @empty {
        @if (!fotos.isLoading()) {
          <li class="ayuda vacio">{{ soloSinUsar() ? 'No hay fotos sin usar. 👍' : 'Todavía no hay fotos subidas desde el panel.' }}</li>
        }
      }
    </ul>
  `,
  styles: `
    .resumen-fotos { margin-top: 0; }
    .rejilla-fotos { list-style: none; margin: 1rem 0 0; padding: 0; display: grid; gap: .8rem; grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr)); }
    .rejilla-fotos > li { border: 1px solid var(--linea); border-radius: .75rem; overflow: hidden; background: var(--superficie); display: flex; flex-direction: column; }
    .rejilla-fotos > li.sin-usar { border-color: var(--cempasuchil); }
    .rejilla-fotos img { width: 100%; aspect-ratio: 1; object-fit: cover; background: var(--fondo-alt); }
    .datos-foto { padding: .55rem .65rem .7rem; display: grid; gap: .4rem; font-size: .85rem; }
    .datos-foto small { color: var(--tinta-suave); }
    .usos { margin: 0; padding-left: 1rem; }
    .etiqueta-sin-usar { justify-self: start; font-size: .75rem; font-weight: 700; padding: .1rem .5rem; border-radius: 999px; background: color-mix(in srgb, var(--cempasuchil) 25%, transparent); }
    .confirmar { display: flex; gap: .4rem; flex-wrap: wrap; }
    .btn.peligro { background: #c92a2a; color: #fff; border-color: #c92a2a; }
    .vacio { grid-column: 1 / -1; padding: 1.5rem 0; }
  `,
})
export class FotosPage {
  readonly slug = input.required<string>();

  private readonly api = inject(AdminApi);
  protected readonly tamano = tamano;
  protected readonly mensaje = mensajeDeError;
  protected readonly negocio = rxResource({ params: () => this.slug(), stream: ({ params }) => this.api.negocio(params) });
  protected readonly fotos = rxResource({ params: () => this.slug(), stream: ({ params }) => this.api.fotos(params) });
  protected readonly soloSinUsar = signal(false);
  protected readonly sinUsar = computed(() => (this.fotos.value()?.fotos ?? []).filter((f) => !f.usos.length).length);
  protected readonly visibles = computed(() =>
    (this.fotos.value()?.fotos ?? []).filter((f) => !this.soloSinUsar() || !f.usos.length),
  );
  protected readonly confirmando = signal<number | null>(null);
  protected readonly ocupado = signal(false);
  protected readonly aviso = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  protected borrar(f: FotoAdmin): void {
    this.ocupado.set(true);
    this.aviso.set(null);
    this.error.set(null);
    this.api
      .borrarFoto(this.slug(), f.id)
      .pipe(finalize(() => this.ocupado.set(false)))
      .subscribe({
        next: () => {
          this.confirmando.set(null);
          this.aviso.set(`Foto borrada: se liberaron ${tamano(f.bytes)}.`);
          this.fotos.reload();
        },
        error: (e) => this.error.set(mensajeDeError(e)),
      });
  }
}
