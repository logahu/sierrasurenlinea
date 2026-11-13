import { computed, inject, signal } from '@angular/core';
import { ColoniasService, SeleccionColonia, agrupar, nombreParaPedido } from './colonias';

/** Valor del combo para «Otra (no está en la lista)». */
export const OTRA = 'otra';

/**
 * Estado del combo «Colonia o comunidad» que comparten el carrito y Encarguitos. Cada
 * formulario pone su propio HTML (para respetar su estilo); esto lleva la lógica.
 * Debe crearse dentro de un componente (usa inject).
 */
export class ControlColonia {
  private readonly servicio = inject(ColoniasService);
  readonly seleccion = signal<SeleccionColonia | null>(null);
  readonly cargando = computed(() => this.servicio.lista.isLoading());
  private readonly colonias = computed(() => this.servicio.lista.value() ?? []);
  readonly grupos = computed(() => agrupar(this.colonias()));
  /** Valor del select. */
  readonly valor = computed(() => {
    const s = this.seleccion();
    return !s ? '' : s.otra ? OTRA : String(s.id ?? '');
  });
  readonly esOtra = computed(() => !!this.seleccion()?.otra);
  readonly falta = computed(() => faltaColonia(this.seleccion()));

  elegir(valor: string): void {
    if (valor === OTRA) {
      this.seleccion.set({ id: null, nombre: '', zona: null, otra: true });
      return;
    }
    const c = this.colonias().find((x) => String(x.id) === valor);
    this.seleccion.set(c ? { id: c.id, nombre: nombreParaPedido(c, this.colonias()), zona: c.zona, otra: false } : null);
  }

  escribir(texto: string): void {
    this.seleccion.set({ id: null, nombre: texto.slice(0, 100), zona: null, otra: true });
  }

  /** Para el pedido: { colonia, coloniaOtra }. */
  datos(): { colonia: string | null; coloniaOtra: boolean } {
    const s = this.seleccion();
    return { colonia: s?.nombre.trim() || null, coloniaOtra: !!s?.otra };
  }
}

/** ¿Falta la colonia? (elegida, o escrita si es «Otra»). */
export function faltaColonia(s: SeleccionColonia | null | undefined): boolean {
  return !s || !s.nombre.trim();
}
