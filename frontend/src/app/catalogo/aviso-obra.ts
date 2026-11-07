import { Component } from '@angular/core';

/**
 * Letrero de "Sitio en construcción" de la portada: una valla de obra pintada a mano,
 * con su lámpara que parpadea, al estilo de la calle de los rótulos.
 * Para quitarlo cuando el sitio esté completo: borrar <app-aviso-obra /> de inicio-page.html.
 */
@Component({
  selector: 'app-aviso-obra',
  template: `
    <aside class="obra" aria-labelledby="titulo-obra">
      <svg class="valla" viewBox="0 0 160 120" aria-hidden="true">
        <defs>
          <pattern id="franjas" width="22" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="22" height="22" fill="#fffaf0" />
            <rect width="11" height="22" fill="#e8590c" />
          </pattern>
          <radialGradient id="brillo">
            <stop offset="0" stop-color="#ffd43b" stop-opacity=".9" />
            <stop offset="1" stop-color="#ffd43b" stop-opacity="0" />
          </radialGradient>
        </defs>
        <!-- patas -->
        <path d="M30 52 18 116 M130 52l12 64 M30 52l-10 64 M130 52l10 64" stroke="#5c4a3a" stroke-width="5" stroke-linecap="round" />
        <!-- tablas -->
        <rect x="8" y="40" width="144" height="26" rx="3" fill="url(#franjas)" stroke="#3b2f25" stroke-width="2.5" />
        <rect x="8" y="78" width="144" height="18" rx="3" fill="url(#franjas)" stroke="#3b2f25" stroke-width="2.5" />
        <!-- lámpara -->
        <rect x="74" y="28" width="12" height="12" rx="2" fill="#3b2f25" />
        <circle class="halo" cx="80" cy="22" r="20" fill="url(#brillo)" />
        <circle class="foco" cx="80" cy="22" r="8" fill="#fab005" stroke="#3b2f25" stroke-width="2.5" />
      </svg>
      <div>
        <p class="etiqueta">Aviso</p>
        <h2 id="titulo-obra">Sitio en construcción</h2>
        <p>
          Estamos estrenando: algunos negocios todavía muestran imágenes de ejemplo y cada semana sumamos más.
          <strong>Pronto podrás pedir por WhatsApp.</strong>
        </p>
      </div>
    </aside>
  `,
  styles: `
    :host { display: block; }
    .obra {
      display: grid;
      grid-template-columns: clamp(5.25rem, 14vw, 10rem) 1fr;
      gap: clamp(.75rem, 2.5vw, 1.75rem);
      align-items: center;
      padding: 1rem 1.25rem 1rem 1rem;
      background: color-mix(in srgb, #fab005 12%, var(--cal, #fbfbf8));
      border: 2px solid #3b2f25;
      border-radius: .4rem;
      box-shadow: .35rem .35rem 0 #3b2f25;
      color: var(--anil, #1e2a5a);
      animation: colgar .7s cubic-bezier(.3, 1.6, .5, 1) both .2s;
      transform-origin: 50% 0;
    }
    .valla { width: 100%; height: auto; }
    .etiqueta {
      margin: 0;
      font-size: .72rem;
      font-weight: 700;
      letter-spacing: .12em;
      text-transform: uppercase;
      color: #c2410c;
    }
    h2 {
      font-family: var(--rotulo, Georgia, serif);
      font-weight: 400;
      font-size: clamp(1.35rem, 3.4vw, 1.7rem);
      line-height: 1.05;
      margin: .15rem 0 .4rem;
    }
    p { margin: 0; line-height: 1.45; font-size: .95rem; color: var(--anil-suave, #4a5585); }
    strong { color: var(--anil, #1e2a5a); }
    .foco { animation: parpadeo 1.6s steps(1) infinite; }
    .halo { animation: halo 1.6s steps(1) infinite; }
    @keyframes parpadeo { 50% { fill: #8a6d1f; } }
    @keyframes halo { 50% { opacity: 0; } }
    @keyframes colgar { from { opacity: 0; transform: rotate(-4deg) translateY(-.75rem); } }
    @media (max-width: 480px) {
      .obra { grid-template-columns: 5.25rem 1fr; gap: .75rem; padding: .85rem; }
    }
    @media (prefers-reduced-motion: reduce) {
      .obra, .foco, .halo { animation: none; }
    }
  `,
})
export class AvisoObra {}
