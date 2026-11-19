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
      <p class="intro">El {{ nombre }} es para que los vecinos de Miahuatlán y la Sierra Sur compren y vendan artículos nuevos
        o usados, y ofrezcan los servicios que hacen por su cuenta. Revisamos cada anuncio antes de publicarlo.</p>

      <h2>No se permite publicar</h2>
      <ul>
        <li>Artículos robados o sin procedencia comprobable.</li>
        <li>Armas, municiones, réplicas o partes de armas.</li>
        <li>Animales.</li>
        <li>Medicamentos, suplementos o productos de salud.</li>
        <li>Bebidas alcohólicas, tabaco o vapeadores.</li>
        <li>Contenido o artículos para adultos.</li>
        <li>Celulares con IMEI reportado o bloqueado.</li>
        <li>Servicios ilegales, de salud (consultas, tratamientos) o financieros (préstamos, inversiones, tandas).</li>
      </ul>

      <h2>Cómo debe ser tu anuncio</h2>
      <ul>
        <li>Fotos reales del artículo o de tus trabajos (nada de imágenes de internet). En servicios, las fotos son opcionales.</li>
        <li>Precio real en pesos mexicanos. Un servicio puede decir «desde» o «a cotizar».</li>
        <li>Un artículo o un servicio por anuncio.</li>
        <li>Tu localidad o colonia, nunca tu dirección exacta.</li>
      </ul>

      <h2>Servicios</h2>
      <ul>
        <li>Son para personas que trabajan por su cuenta: oficios, belleza, clases, fletes y similares.</li>
        <li>Si tienes local o negocio establecido, <a routerLink="/conocenos" fragment="titulo-sumate">suma tu negocio al directorio</a> en lugar del tianguis.</li>
        <li>Describe qué incluye tu servicio y la zona que cubres.</li>
      </ul>

      <h2>Moderación</h2>
      <ul>
        <li>Los anuncios se publican cuando los aprobamos y duran 30 días; puedes renovarlos hasta 3 veces.</li>
        <li>Podemos rechazar o retirar cualquier anuncio sin previo aviso.</li>
        <li>Si un anuncio recibe varios reportes, se pausa mientras lo revisamos.</li>
        <li>Podemos bloquear a quien no respete estas reglas.</li>
      </ul>

      <h2>Para comprar y contratar con seguridad</h2>
      <ul>
        <li>Revisa el artículo en persona antes de pagar.</li>
        <li>Reúnete en un lugar público y de día.</li>
        <li>En servicios, acuerda el precio total antes de empezar y no pagues todo por adelantado.</li>
        <li>No des anticipos a personas que no conoces.</li>
      </ul>
      <p>El trato es directo entre las personas; Sierra Sur en Línea no participa en el pago, la entrega ni el trabajo.</p>
      <a class="btn primario" routerLink="/tianguis/publicar">＋ Publicar anuncio</a>
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
      descripcion: 'Qué se puede y qué no se puede publicar en el Tianguis Sierra Sur: compra-venta de artículos nuevos y usados, y servicios de particulares en Miahuatlán.',
      ruta: '/tianguis/reglas',
    });
  }
}
