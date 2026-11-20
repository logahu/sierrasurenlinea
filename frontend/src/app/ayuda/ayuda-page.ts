import { Component, ElementRef, afterRenderEffect, computed, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { CatalogoService } from '../catalogo/catalogo.service';
import { visiblesAqui } from '../modo-app';
import { PREGUNTAS, guiaDe, partesDe } from './ayuda';
import { acentoLegible } from '../color';

/**
 * Ayuda: preguntas frecuentes y una guía para pedir en cada negocio.
 * /ayuda?negocio=turamohoy abre directamente la guía de ese negocio.
 */
@Component({
  selector: 'app-ayuda-page',
  imports: [RouterLink],
  templateUrl: './ayuda-page.html',
  styleUrl: './ayuda-page.scss',
})
export class AyudaPage {
  protected readonly acento = acentoLegible;

  /** ?negocio=slug : guía que se abre al entrar. */
  readonly negocio = input<string>();

  private readonly api = inject(CatalogoService);
  private readonly elemento = inject(ElementRef<HTMLElement>);

  protected readonly temas = PREGUNTAS;
  protected readonly partes = partesDe;
  protected readonly negocios = rxResource({ stream: () => this.api.negocios() });
  protected readonly guias = computed(() => visiblesAqui(this.negocios.value() ?? []).map(guiaDe));

  /** Salta a una sección sin cambiar de página. */
  protected ir(id: string): void {
    (this.elemento.nativeElement as HTMLElement).querySelector(`#${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  constructor() {
    // Lleva a la guía pedida en cuanto aparece.
    afterRenderEffect(() => {
      const slug = this.negocio();
      if (!slug || !this.guias().length) return;
      const guia = (this.elemento.nativeElement as HTMLElement).querySelector<HTMLElement>(`#guia-${CSS.escape(slug)}`);
      guia?.scrollIntoView({ block: 'start' });
    });
  }
}
