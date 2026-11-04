import { Component, computed, input } from '@angular/core';
import { Negocio } from './catalogo.model';
import { enlaceTelefono, enlaceWhatsapp, mensajeNegocio } from './contacto';

/** Tarjeta con los datos de contacto de un negocio: WhatsApp, teléfono, dirección y horario. */
@Component({
  selector: 'app-contacto-negocio',
  template: `
    @let n = negocio();
    <h2>Contacto de {{ n.nombre }}</h2>
    <div class="acciones">
      <a class="btn whatsapp" [href]="whatsapp()" target="_blank" rel="noopener">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4a.5.5 0 0 0 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.4-.3Z"/></svg>
        Escribir por WhatsApp
      </a>
      @if (telefono(); as tel) {
        <a class="btn secundario" [href]="tel">Llamar al {{ n.telefono }}</a>
      }
    </div>
    <dl>
      @if (n.direccion) { <dt>Dirección</dt><dd>{{ n.direccion }}</dd> }
      @if (n.horario) { <dt>Horario</dt><dd>{{ n.horario }}</dd> }
    </dl>
  `,
  styles: `
    /* Toma los tokens --t-* del tema del negocio (src/temas/). */
    :host {
      display: block;
      margin-top: 2.5rem;
      padding: 1.25rem;
      border-radius: var(--t-radio-contacto, 1rem);
      background: var(--t-superficie, var(--superficie));
      color: var(--t-tinta, var(--tinta));
      border: 1px solid var(--t-linea, var(--linea));
      border-top: 4px solid var(--acento, var(--rosa));
    }
    h2 {
      font-family: var(--t-fuente-titulo, var(--font-display));
      font-weight: var(--t-peso-titulo, 600);
      font-size: 1.3rem;
      margin: 0 0 1rem;
    }
    .acciones { display: flex; flex-wrap: wrap; gap: .6rem; margin-bottom: 1rem; }
    .btn.secundario { color: var(--t-tinta, var(--tinta)); border-color: var(--t-linea, var(--linea)); }
    dl { display: grid; grid-template-columns: auto 1fr; gap: .35rem 1rem; margin: 0; font-size: .95rem; }
    dt { color: var(--t-tinta-suave, var(--tinta-suave)); }
    dd { margin: 0; }
  `,
})
export class ContactoNegocio {
  readonly negocio = input.required<Negocio>();

  readonly whatsapp = computed(() => enlaceWhatsapp(this.negocio().whatsapp, mensajeNegocio(this.negocio())));
  readonly telefono = computed(() => {
    const tel = this.negocio().telefono;
    return tel ? enlaceTelefono(tel) : null;
  });
}
