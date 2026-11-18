import { Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { combineLatest } from 'rxjs';
import { AvisoObra } from './aviso-obra';
import { BannerPublicidad } from './banner-publicidad';
import { CatalogoService } from './catalogo.service';
import { precioConUnidad } from './contacto';
import { ORDENES, OrdenDirectorio, chipsDeGiro, filtrar, filtrosDeUrl, ordenar, urlDeFiltros } from './directorio';
import { IconoGiro } from './icono-giro';
import { TarjetaNegocio } from './tarjeta-negocio';

/** Espera al escribir antes de buscar. */
const PAUSA_BUSQUEDA_MS = 200;

/**
 * Portada de Sierra Sur en Línea: directorio de negocios con buscador, orden y chips por giro.
 * Los filtros viven en la URL (/?giro=flores&q=rosas&orden=nuevos) para poder compartirlos.
 */
@Component({
  selector: 'app-inicio-page',
  imports: [RouterLink, AvisoObra, BannerPublicidad, IconoGiro, TarjetaNegocio],
  templateUrl: './inicio-page.html',
  styleUrl: './inicio-page.scss',
})
export class InicioPage {
  private readonly api = inject(CatalogoService);
  private readonly router = inject(Router);

  /** Parámetros de la URL. */
  readonly giro = input<string>();
  readonly q = input<string>();
  readonly orden = input<string>();

  readonly negocios = rxResource({
    stream: () => combineLatest({ giros: this.api.giros(), negocios: this.api.negocios() }),
  });
  readonly destacados = rxResource({ stream: () => this.api.destacados() });

  protected readonly ordenes = ORDENES;
  protected readonly precio = precioConUnidad;

  private readonly datos = computed(() => (this.negocios.hasValue() ? this.negocios.value() : undefined));
  protected readonly filtros = computed(() =>
    filtrosDeUrl({ giro: this.giro(), q: this.q(), orden: this.orden() }),
  );
  protected readonly chips = computed(() => {
    const d = this.datos();
    return d ? chipsDeGiro(d.giros, d.negocios) : [];
  });
  protected readonly total = computed(() => this.datos()?.negocios.length ?? 0);
  /** El giro de la URL, si existe entre los chips. */
  protected readonly elegido = computed(() => {
    const g = this.filtros().giro;
    return this.chips().find((c) => c.giro.slug === g)?.giro ?? null;
  });
  protected readonly lista = computed(() => {
    const d = this.datos();
    if (!d) return [];
    const f = this.filtros();
    return ordenar(filtrar(d.negocios, { giro: this.elegido()?.slug ?? null, q: f.q }), f.orden);
  });
  protected readonly hayFiltros = computed(() => !!this.elegido() || !!this.filtros().q.trim());

  /** Lo que está escrito en el buscador (la URL se actualiza al dejar de escribir). */
  protected readonly texto = signal('');
  private espera: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    // Si la URL cambia desde fuera (atrás, un enlace, «Limpiar»), el buscador la sigue.
    effect(() => {
      const q = this.filtros().q;
      if (this.espera === undefined) untracked(() => this.texto.set(q));
    });
    inject(DestroyRef).onDestroy(() => clearTimeout(this.espera));
  }

  /** Color de cada negocio, para pintar la etiqueta de los productos destacados. */
  colorDe(slug: string): string | null {
    return this.datos()?.negocios.find((n) => n.slug === slug)?.colorPrimario ?? null;
  }

  protected escribir(valor: string): void {
    this.texto.set(valor);
    clearTimeout(this.espera);
    this.espera = setTimeout(() => {
      this.espera = undefined;
      this.ir({ q: valor });
    }, PAUSA_BUSQUEDA_MS);
  }

  protected elegirGiro(giro: string | null): void {
    this.ir({ giro });
  }

  protected elegirOrden(orden: string): void {
    this.ir({ orden: orden as OrdenDirectorio });
  }

  protected limpiar(): void {
    clearTimeout(this.espera);
    this.espera = undefined;
    this.texto.set('');
    this.ir({ giro: null, q: '' });
  }

  /** Cambia los filtros sin llenar el historial; el enlace queda listo para compartir. */
  private ir(cambio: Partial<{ giro: string | null; q: string; orden: OrdenDirectorio }>): void {
    const f = { ...this.filtros(), ...cambio };
    void this.router.navigate([], { queryParams: urlDeFiltros(f), replaceUrl: true });
  }
}
