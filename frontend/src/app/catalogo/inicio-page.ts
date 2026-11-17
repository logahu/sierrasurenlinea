import { Component, computed, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { combineLatest } from 'rxjs';
import { AvisoObra } from './aviso-obra';
import { BannerPublicidad } from './banner-publicidad';
import { CatalogoService } from './catalogo.service';
import { Calle, callesPorGiro, fachadasDe, filtrarCalles, indiceBannerEntreCalles } from './calles';
import { precioConUnidad } from './contacto';
import { Fachada } from './fachada';
import { IconoGiro } from './icono-giro';

/**
 * Portada de Sierra Sur en Línea: una «calle» de fachadas por giro (Flores y regalos,
 * Belleza…), con chips para ver solo una calle (?giro=flores) y banners de publicidad.
 */
@Component({
  selector: 'app-inicio-page',
  imports: [RouterLink, AvisoObra, BannerPublicidad, Fachada, IconoGiro],
  templateUrl: './inicio-page.html',
  styleUrl: './inicio-page.scss',
})
export class InicioPage {
  private readonly api = inject(CatalogoService);
  private readonly router = inject(Router);

  /** ?giro=flores: solo esa calle. */
  readonly giro = input<string>();

  readonly negocios = rxResource({
    stream: () => combineLatest({ giros: this.api.giros(), negocios: this.api.negocios() }),
  });
  readonly destacados = rxResource({ stream: () => this.api.destacados() });

  protected readonly calles = computed<Calle[]>(() => {
    const v = this.negocios.hasValue() ? this.negocios.value() : undefined;
    return v ? callesPorGiro(v.giros, v.negocios) : [];
  });
  /** El giro elegido, si existe entre las calles. */
  protected readonly elegido = computed(() => {
    const g = this.giro();
    return g && this.calles().some((c) => c.giro.slug === g) ? g : null;
  });
  protected readonly visibles = computed(() => filtrarCalles(this.calles(), this.elegido()));
  protected readonly total = computed(() => this.calles().reduce((s, c) => s + c.negocios.length, 0));
  protected readonly bannerDespuesDe = computed(() => indiceBannerEntreCalles(this.visibles().length));
  protected readonly fachadas = fachadasDe;
  protected readonly precio = precioConUnidad;

  /** Color de cada negocio, para pintar la etiqueta de los productos destacados. */
  colorDe(slug: string): string | null {
    const v = this.negocios.hasValue() ? this.negocios.value() : undefined;
    return v?.negocios.find((n) => n.slug === slug)?.colorPrimario ?? null;
  }

  /** Cambia de calle sin llenar el historial (el enlace queda listo para compartir). */
  protected elegir(giro: string | null): void {
    void this.router.navigate([], { queryParams: { giro: giro ?? null }, replaceUrl: true });
  }
}
