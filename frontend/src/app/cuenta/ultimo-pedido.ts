import { Injectable, signal } from '@angular/core';

/** El pedido que el cliente acaba de hacer, para recordarle dónde darle seguimiento. */
export interface PedidoReciente {
  folio: string | null;
  negocio: string;
  /** Milisegundos (Date.now()) en que se hizo. */
  cuando: number;
}

const CLAVE = 'ssl:ultimo-pedido';
/** El aviso se muestra durante 6 horas o hasta que el cliente lo cierre. */
const VIGENCIA = 6 * 60 * 60 * 1000;

/**
 * Aviso que aparece en todo el sitio después de hacer un pedido: "Tu pedido TUR-00015 se
 * registró. Síguelo en Mi cuenta". Se guarda en este navegador para que siga visible al
 * volver de WhatsApp.
 */
@Injectable({ providedIn: 'root' })
export class UltimoPedido {
  readonly actual = signal<PedidoReciente | null>(leer());

  registrar(folio: string | null | undefined, negocio: string): void {
    const p: PedidoReciente = { folio: folio ?? null, negocio, cuando: Date.now() };
    this.actual.set(p);
    try {
      localStorage.setItem(CLAVE, JSON.stringify(p));
    } catch {
      /* sin almacenamiento: el aviso dura mientras la pestaña esté abierta */
    }
  }

  cerrar(): void {
    this.actual.set(null);
    try {
      localStorage.removeItem(CLAVE);
    } catch {
      /* nada */
    }
  }
}

function leer(): PedidoReciente | null {
  try {
    const p = JSON.parse(localStorage.getItem(CLAVE) ?? 'null') as PedidoReciente | null;
    return p && Date.now() - p.cuando < VIGENCIA ? p : null;
  } catch {
    return null;
  }
}
