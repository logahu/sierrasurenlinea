import { Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { CatalogoService } from '../catalogo/catalogo.service';
import { enlaceWhatsapp } from '../catalogo/contacto';
import { visiblesAqui } from '../modo-app';

/** WhatsApp de Sierra Sur en Línea para negocios que quieren sumarse y para contacto general. */
const WHATSAPP_SITIO = '525540485363';

/**
 * Conócenos: quiénes somos, qué hacemos y cómo sumar un negocio.
 * Los textos están aquí mismo para editarlos con facilidad.
 */
@Component({
  selector: 'app-conocenos-page',
  imports: [RouterLink],
  templateUrl: './conocenos-page.html',
  styleUrl: './conocenos-page.scss',
})
export class ConocenosPage {
  private readonly api = inject(CatalogoService);
  protected readonly negocios = rxResource({ stream: () => this.api.negocios() });
  protected readonly visibles = computed(() => visiblesAqui(this.negocios.value() ?? []));

  protected readonly sumarNegocio = enlaceWhatsapp(
    WHATSAPP_SITIO,
    'Hola, me interesa sumar mi negocio a Sierra Sur en Línea. ¿Me pueden dar informes?',
  );
  protected readonly contacto = enlaceWhatsapp(WHATSAPP_SITIO, 'Hola, tengo una pregunta sobre Sierra Sur en Línea.');

  protected readonly queHacemos = [
    {
      icono: '🛍️',
      titulo: 'Los negocios, en tu celular',
      texto: 'Cada negocio tiene su propio catálogo con fotos, precios y descripciones, disponible a cualquier hora.',
    },
    {
      icono: '💬',
      titulo: 'Pedir es sencillo',
      texto: 'Eliges, confirmas y tu pedido llega al negocio con folio por WhatsApp. Sin aplicaciones complicadas ni pagos en línea.',
    },
    {
      icono: '🛵',
      titulo: 'Entregas en Miahuatlán',
      texto: 'Recibe a domicilio o pasa a recoger. Con Encarguitos te hacemos mandados, compras y pagos en moto.',
    },
    {
      icono: '📍',
      titulo: 'Seguimiento de tu pedido',
      texto: 'Consulta en tu cuenta en qué va cada pedido y recibe avisos cuando está en camino o listo.',
    },
  ];

  protected readonly valores = [
    { titulo: 'Cercanía', texto: 'Detrás de cada pedido hay personas de aquí que te atienden con nombre y apellido.' },
    { titulo: 'Confianza', texto: 'Cuentas verificadas, folios para cada pedido y cuidado de tus datos personales.' },
    { titulo: 'Lo local primero', texto: 'Cada compra se queda en la Sierra Sur y fortalece a los negocios de la región.' },
    { titulo: 'Sencillez', texto: 'Pensado para usarse fácil desde cualquier celular, con o sin experiencia.' },
  ];
}
