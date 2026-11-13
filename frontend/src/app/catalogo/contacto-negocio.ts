import { Component, computed, input } from '@angular/core';
import { Negocio } from './catalogo.model';
import { enlaceTelefono, enlaceWhatsapp, mensajeNegocio } from './contacto';
import { MapaUbicacion } from '../mapa/mapa-ubicacion';
import { LEYENDA_EN_LINEA, direccionCorta, enlaceLlegarNegocio, puntoNegocio } from './ubicacion-negocio';

/**
 * «Datos del negocio»: si tiene local, mapa, dirección y «Cómo llegar»; si no, la leyenda
 * «Atención solo en línea». Siempre WhatsApp, teléfono y horario.
 */
@Component({
  selector: 'app-contacto-negocio',
  imports: [MapaUbicacion],
  host: { id: 'datos-negocio' },
  template: `
    @let n = negocio();
    <h2>Datos del negocio</h2>
    @if (!n.atencionEnLocal) {
      <div class="en-linea" role="note">
        <span aria-hidden="true">💻</span>
        <span><strong>Atención solo en línea</strong>{{ leyenda }}</span>
      </div>
    } @else if (punto(); as p) {
      @defer (on viewport) {
        <app-mapa-ubicacion [punto]="p" [soloLectura]="true" para="negocio" />
      } @placeholder {
        <div class="mapa-espera">Cargando mapa…</div>
      }
    }
    <dl>
      @if (n.atencionEnLocal && direccion()) {
        <dt>Dirección</dt>
        <dd>{{ direccion() }}@if (n.referencias) { <small>{{ n.referencias }}</small> }</dd>
      }
      @if (n.horario) { <dt>Horario</dt><dd>{{ n.horario }}</dd> }
      @if (n.telefono) { <dt>Teléfono</dt><dd>{{ n.telefono }}</dd> }
    </dl>
    <div class="acciones">
      @if (llegar(); as url) {
        <a class="btn llegar" [href]="url" target="_blank" rel="noopener">🧭 Cómo llegar</a>
      }
      <a class="btn whatsapp" [href]="whatsapp()" target="_blank" rel="noopener">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4a.5.5 0 0 0 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.4-.3Z"/></svg>
        Escribir por WhatsApp
      </a>
      @if (telefono(); as tel) {
        <a class="btn secundario" [href]="tel">📞 Llamar</a>
      }
    </div>
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
    .acciones { display: flex; flex-wrap: wrap; gap: .6rem; margin-top: 1rem; }
    .btn.llegar { background: var(--acento, var(--rosa)); color: #fff; border-color: transparent; }
    .en-linea {
      display: flex; gap: .7rem; align-items: flex-start; margin-bottom: 1rem; padding: .8rem 1rem;
      border-radius: .75rem; background: #eef4fb; color: #1c3d63; font-size: .95rem; line-height: 1.45;
    }
    .en-linea strong { display: block; font-size: 1rem; }
    .en-linea > span:first-child { font-size: 1.4rem; line-height: 1; }
    app-mapa-ubicacion { display: block; margin-bottom: 1rem; }
    .mapa-espera { height: 14rem; border-radius: .75rem; background: var(--t-linea, var(--linea)); display: grid; place-items: center; color: var(--tinta-suave); margin-bottom: 1rem; }
    dd small { display: block; color: var(--t-tinta-suave, var(--tinta-suave)); font-size: .88rem; }
    .btn.secundario { color: var(--t-tinta, var(--tinta)); border-color: var(--t-linea, var(--linea)); }
    dl { display: grid; grid-template-columns: auto 1fr; gap: .35rem 1rem; margin: 0; font-size: .95rem; }
    dt { color: var(--t-tinta-suave, var(--tinta-suave)); }
    dd { margin: 0; }
  `,
})
export class ContactoNegocio {
  readonly negocio = input.required<Negocio>();

  readonly whatsapp = computed(() => enlaceWhatsapp(this.negocio().whatsapp, mensajeNegocio(this.negocio())));
  protected readonly leyenda = LEYENDA_EN_LINEA;
  protected readonly punto = computed(() => puntoNegocio(this.negocio()));
  protected readonly direccion = computed(() => direccionCorta(this.negocio()));
  protected readonly llegar = computed(() => enlaceLlegarNegocio(this.negocio()));

  readonly telefono = computed(() => {
    const tel = this.negocio().telefono;
    return tel ? enlaceTelefono(tel) : null;
  });
}
