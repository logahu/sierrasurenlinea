import { Component, DestroyRef, computed, effect, inject, input, linkedSignal, signal, untracked } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { IconoGiro } from '../catalogo/icono-giro';
import { TarjetaAnuncio } from './tarjeta-anuncio';
import { usarSeo } from './seo';
import { AnuncioResumen, OrdenTianguis } from './tianguis.model';
import { TianguisService } from './tianguis.service';
import {
  CONDICIONES, FiltrosTianguis, NOMBRE_TIANGUIS, ORDENES_TIANGUIS, SUBTITULO_TIANGUIS, filtrosDeUrl, hayFiltros, urlDeFiltros,
} from './tianguis';

const PAUSA_BUSQUEDA_MS = 250;

/** /tianguis y /tianguis/c/:categoria: buscador, categorías, filtros y cuadrícula con «Ver más». */
@Component({
  selector: 'app-tianguis-page',
  imports: [RouterLink, IconoGiro, TarjetaAnuncio],
  templateUrl: './tianguis-page.html',
  styleUrls: ['./tianguis.scss', './tianguis-page.scss'],
})
export class TianguisPage {
  private readonly api = inject(TianguisService);
  private readonly router = inject(Router);

  /** De la URL. */
  readonly categoria = input<string>();
  readonly q = input<string>();
  readonly condicion = input<string>();
  readonly min = input<string>();
  readonly max = input<string>();
  readonly orden = input<string>();

  protected readonly nombre = NOMBRE_TIANGUIS;
  protected readonly subtitulo = SUBTITULO_TIANGUIS;
  protected readonly condiciones = CONDICIONES;
  protected readonly ordenes = ORDENES_TIANGUIS;

  protected readonly filtros = computed<FiltrosTianguis>(() =>
    filtrosDeUrl({ q: this.q(), condicion: this.condicion(), min: this.min(), max: this.max(), orden: this.orden() }),
  );
  protected readonly conFiltros = computed(() => hayFiltros(this.filtros()));

  readonly categorias = rxResource({ stream: () => this.api.categorias() });
  protected readonly listaCategorias = computed(() => (this.categorias.hasValue() ? this.categorias.value() : []) ?? []);
  protected readonly elegida = computed(() => this.listaCategorias().find((c) => c.slug === this.categoria()) ?? null);
  /** Antes del primer servicio va el separador «Servicios». */
  protected readonly primerServicio = computed(() => this.listaCategorias().find((c) => c.tipo === 'SERVICIO')?.slug ?? null);
  protected readonly totalCategorias = computed(() => this.listaCategorias().reduce((s, c) => s + c.anuncios, 0));

  /** Primera página según categoría y filtros; «Ver más» agrega las siguientes. */
  readonly pagina0 = rxResource({
    params: () => ({ categoria: this.categoria() ?? null, f: this.filtros() }),
    stream: ({ params }) => this.api.anuncios(params.categoria, params.f, 0),
  });
  private readonly mas = linkedSignal<unknown, { anuncios: AnuncioResumen[]; pagina: number }>({
    source: () => this.pagina0.value(),
    computation: () => ({ anuncios: [], pagina: 0 }),
  });
  protected readonly anuncios = computed(() => [
    ...((this.pagina0.hasValue() ? this.pagina0.value()?.anuncios : []) ?? []),
    ...this.mas().anuncios,
  ]);
  protected readonly total = computed(() => (this.pagina0.hasValue() ? (this.pagina0.value()?.total ?? 0) : 0));
  protected readonly hayMas = computed(() => this.anuncios().length < this.total());
  protected readonly cargandoMas = signal(false);
  protected readonly errorMas = signal(false);

  protected readonly texto = signal('');
  private espera: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    effect(() => {
      const q = this.filtros().q;
      if (this.espera === undefined) untracked(() => this.texto.set(q));
    });
    inject(DestroyRef).onDestroy(() => clearTimeout(this.espera));
    const seo = usarSeo();
    effect(() => {
      const c = this.elegida();
      seo({
        titulo: c ? `${c.nombre} en Miahuatlán · ${NOMBRE_TIANGUIS}` : `${NOMBRE_TIANGUIS} · Compra, vende y ofrece servicios en Miahuatlán`,
        descripcion: c
          ? c.tipo === 'SERVICIO'
            ? `${c.nombre} en Miahuatlán y la Sierra Sur: servicios de particulares. Pide informes directo por WhatsApp.`
            : `${c.nombre} nuevos y usados en Miahuatlán y la Sierra Sur. Contacta directo al vendedor por WhatsApp.`
          : 'Compra y vende artículos nuevos y usados, y encuentra servicios de particulares en Miahuatlán y la Sierra Sur: vehículos, celulares, muebles, oficios, fletes, clases y más.',
        ruta: c ? `/tianguis/c/${c.slug}` : '/tianguis',
      });
    });
  }

  protected escribir(valor: string): void {
    this.texto.set(valor);
    clearTimeout(this.espera);
    this.espera = setTimeout(() => {
      this.espera = undefined;
      this.ir({ q: valor });
    }, PAUSA_BUSQUEDA_MS);
  }

  protected cambiar(campo: 'condicion' | 'orden' | 'precioMin' | 'precioMax', valor: string): void {
    if (campo === 'condicion') this.ir({ condicion: (valor || null) as FiltrosTianguis['condicion'] });
    else if (campo === 'orden') this.ir({ orden: valor as OrdenTianguis });
    else {
      const n = valor.trim() === '' ? null : Number(valor);
      this.ir({ [campo]: n !== null && Number.isFinite(n) && n >= 0 ? n : null });
    }
  }

  protected limpiar(): void {
    clearTimeout(this.espera);
    this.espera = undefined;
    this.texto.set('');
    void this.router.navigate(['/tianguis'], { queryParams: {} });
  }

  protected rutaCategoria(slug: string | null): string[] {
    return slug ? ['/tianguis', 'c', slug] : ['/tianguis'];
  }

  protected verMas(): void {
    const siguiente = this.mas().pagina + 1;
    this.cargandoMas.set(true);
    this.errorMas.set(false);
    this.api.anuncios(this.categoria() ?? null, this.filtros(), siguiente).subscribe({
      next: (p) => {
        this.mas.update((m) => ({ anuncios: [...m.anuncios, ...p.anuncios], pagina: siguiente }));
        this.cargandoMas.set(false);
      },
      error: () => {
        this.cargandoMas.set(false);
        this.errorMas.set(true);
      },
    });
  }

  private ir(cambio: Partial<FiltrosTianguis>): void {
    const f = { ...this.filtros(), ...cambio };
    void this.router.navigate([], { queryParams: urlDeFiltros(f), replaceUrl: true });
  }
}
