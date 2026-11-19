import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { usarSeo } from './seo';
import { NOMBRE_TIANGUIS } from './tianguis';

/** /tianguis/reglas: qué se puede y qué no se puede publicar. */
@Component({
  selector: 'app-reglas-page',
  imports: [RouterLink],
  template: `
    <nav class="migas" aria-label="Ruta"><a routerLink="/tianguis">Tianguis</a> › Reglas de publicación</nav>
    <article>
      <h1>Reglas de publicación</h1>
      <p class="intro">El {{ nombre }} es para comprar y vender artículos de segunda mano entre vecinos de Miahuatlán y la Sierra Sur.
        Revisamos cada anuncio antes de publicarlo.</p>

      <h2>No se permite publicar</h2>
      <ul>
        <li>Artículos robados o sin procedencia comprobable.</li>
        <li>Armas, municiones, réplicas o partes de armas.</li>
        <li>Animales.</li>
        <li>Medicamentos, suplementos o productos de salud.</li>
        <li>Bebidas alcohólicas, tabaco o vapeadores.</li>
        <li>Contenido o artículos para adultos.</li>
        <li>Servicios (solo artículos).</li>
        <li>Celulares con IMEI reportado o bloqueado.</li>
      </ul>

      <h2>Cómo debe ser tu anuncio</h2>
      <ul>
        <li>Fotos reales del artículo (nada de imágenes de internet).</li>
        <li>Precio real en pesos mexicanos.</li>
        <li>Un artículo por anuncio.</li>
        <li>Tu localidad o colonia, nunca tu dirección exacta.</li>
      </ul>

      <h2>Moderación</h2>
      <ul>
        <li>Los anuncios se publican cuando los aprobamos y duran 30 días; puedes renovarlos hasta 3 veces.</li>
        <li>Podemos rechazar o retirar cualquier anuncio sin previo aviso.</li>
        <li>Si un anuncio recibe varios reportes, se pausa mientras lo revisamos.</li>
        <li>Podemos bloquear a quien no respete estas reglas.</li>
      </ul>

      <h2>Para comprar con seguridad</h2>
      <ul>
        <li>Revisa el artículo en persona antes de pagar.</li>
        <li>Reúnete en un lugar público y de día.</li>
        <li>No des anticipos a personas que no conoces.</li>
      </ul>
      <p>El trato es directo entre comprador y vendedor; Sierra Sur en Línea no participa en el pago ni en la entrega.</p>
      <a class="btn primario" routerLink="/tianguis/publicar">＋ Vender un artículo</a>
    </article>
  `,
  styleUrls: ['./tianguis.scss'],
  styles: `article { max-width: 46rem; } .intro { color: var(--tinta-suave); line-height: 1.55; }
    h2 { margin-top: 1.6rem; } ul { padding-left: 1.2rem; line-height: 1.6; } .btn { margin-top: 1rem; }`,
})
export class ReglasPage {
  protected readonly nombre = NOMBRE_TIANGUIS;

  constructor() {
    usarSeo()({
      titulo: `Reglas de publicación · ${NOMBRE_TIANGUIS}`,
      descripcion: 'Qué se puede y qué no se puede vender en el Tianguis Sierra Sur, el espacio de compra-venta de segunda mano de Miahuatlán.',
      ruta: '/tianguis/reglas',
    });
  }
}
