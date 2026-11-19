import { DOCUMENT } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { mensajeDeError } from '../admin/autorizacion';
import { FormularioAnuncio } from './formulario-anuncio';
import { usarSeo } from './seo';
import { Publicacion, Publicado } from './tianguis.model';
import { TianguisService } from './tianguis.service';
import { NOMBRE_TIANGUIS, enlaceWhatsapp } from './tianguis';

/** /tianguis/publicar: cualquier persona publica sin cuenta; queda en revisión y recibe su enlace privado. */
@Component({
  selector: 'app-publicar-page',
  imports: [RouterLink, FormularioAnuncio],
  template: `
    <nav class="migas" aria-label="Ruta"><a routerLink="/tianguis">Tianguis</a> › Vender un artículo</nav>
    @if (listo(); as l) {
      <section class="listo" aria-labelledby="titulo-listo">
        <h1 id="titulo-listo" tabindex="-1">¡Listo! Tu anuncio está en revisión</h1>
        <p>Lo revisamos en cuanto podamos; normalmente el mismo día. Cuando lo aprobemos, aparecerá en el tianguis.</p>
        <div class="enlace-privado">
          <strong>Guarda tu enlace privado</strong>
          <p>Con él ves si ya se publicó, lo corriges, lo marcas como vendido, lo pausas o lo renuevas. No lo compartas: quien lo tenga puede cambiar tu anuncio.</p>
          <input readonly [value]="enlace()" aria-label="Tu enlace privado" (focus)="$any($event.target).select()" />
          <div class="botones">
            <button type="button" class="btn secundario" (click)="copiar()">{{ copiado() ? '✓ Copiado' : 'Copiar enlace' }}</button>
            <a class="btn whatsapp" [href]="aMiWhatsapp()" target="_blank" rel="noopener">Enviármelo por WhatsApp</a>
            <a class="btn primario" [routerLink]="['/tianguis/mi-anuncio', l.token]">Ver mi anuncio</a>
          </div>
        </div>
      </section>
    } @else {
      <header>
        <h1>Vende un artículo</h1>
        <p class="sub">Gratis y sin crear cuenta. En unos minutos: categoría, datos, fotos y tu WhatsApp.</p>
      </header>
      @if (categorias.error(); as e) {
        <p class="aviso" role="alert">{{ $any(e).status === 404 ? 'El tianguis todavía no está abierto.' : 'No pudimos cargar las categorías. Intenta de nuevo.' }}</p>
      } @else if (categorias.hasValue()) {
        <app-formulario-anuncio [categorias]="categorias.value() ?? []" [ocupado]="enviando()" [error]="error()"
                                [subirFoto]="subirFoto" (enviar)="enviar($event)" />
      } @else {
        <p aria-busy="true">Cargando…</p>
      }
    }
  `,
  styleUrls: ['./tianguis.scss'],
  styles: `
    header { margin-bottom: 1rem; } .sub { color: var(--tinta-suave); margin: .4rem 0 0; }
    .listo { display: grid; gap: .8rem; max-width: 40rem; h1:focus { outline: none; } p { margin: 0; line-height: 1.55; } }
    .enlace-privado { display: grid; gap: .6rem; padding: 1rem; border-radius: 1rem; border: 2px solid var(--cempasuchil); background: var(--superficie);
      input { font: inherit; padding: .6rem .7rem; border: 1px solid var(--linea); border-radius: .6rem; background: var(--fondo); color: var(--tinta); width: 100%; box-sizing: border-box; } }
    .botones { display: flex; flex-wrap: wrap; gap: .5rem; }
  `,
})
export class PublicarPage {
  private readonly api = inject(TianguisService);
  private readonly doc = inject(DOCUMENT);
  readonly categorias = rxResource({ stream: () => this.api.categorias() });
  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly listo = signal<(Publicado & { whatsapp: string }) | null>(null);
  protected readonly copiado = signal(false);
  protected readonly subirFoto = (f: File) => this.api.subirFoto(f);

  protected readonly enlace = computed(() =>
    this.listo() ? `${this.doc.location?.origin ?? 'https://sierrasurenlinea.com.mx'}/tianguis/mi-anuncio/${this.listo()!.token}` : '',
  );
  protected readonly aMiWhatsapp = computed(() => {
    const l = this.listo();
    if (!l) return '';
    const d = l.whatsapp.replace(/\D/g, '').slice(-10);
    return enlaceWhatsapp(`52${d}`, `Mi enlace privado para administrar mi anuncio en ${NOMBRE_TIANGUIS}: ${this.enlace()}`);
  });

  constructor() {
    usarSeo()({
      titulo: `Vende tu artículo de segunda mano · ${NOMBRE_TIANGUIS}`,
      descripcion: 'Publica gratis y sin cuenta tu artículo de segunda mano en Miahuatlán y la Sierra Sur. Los compradores te escriben por WhatsApp.',
      ruta: '/tianguis/publicar',
    });
  }

  protected enviar(p: Publicacion): void {
    this.enviando.set(true);
    this.error.set(null);
    this.api.publicar(p).subscribe({
      next: (r) => {
        this.enviando.set(false);
        this.listo.set({ ...r, whatsapp: p.vendedorWhatsapp });
        queueMicrotask(() => document.getElementById('titulo-listo')?.focus());
      },
      error: (e) => {
        this.enviando.set(false);
        this.error.set(mensajeDeError(e));
      },
    });
  }

  protected async copiar(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.enlace());
      this.copiado.set(true);
    } catch {
      this.copiado.set(false);
    }
  }
}
