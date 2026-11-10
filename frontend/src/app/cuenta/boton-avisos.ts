import { Component, DestroyRef, inject, input, signal } from '@angular/core';
import { AvisosCliente } from './avisos-cliente';

/** Tarjeta para activar los avisos de "en qué va mi pedido" en este celular. */
@Component({
  selector: 'app-boton-avisos',
  template: `
    @switch (avisos.estado()) {
      @case ('activos') {
        <p class="avisos activos" role="status">🔔 Te avisaremos en este dispositivo cuando cambie el estado de tus pedidos.</p>
      }
      @case ('apagados') {
        <div class="avisos">
          <p>
            <strong>{{ titulo() }}</strong>
            Recibe una notificación cuando el negocio acepte tu pedido, cuando vaya en camino y cuando se entregue.
          </p>
          <button type="button" (click)="activar()" [disabled]="activando()">
            {{ activando() ? 'Activando…' : '🔔 Activar avisos' }}
          </button>
          @if (error(); as e) { <p class="error" role="alert">{{ e }}</p> }
        </div>
      }
      @case ('bloqueados') {
        <div class="avisos">
          <p><strong>Las notificaciones están bloqueadas para este sitio.</strong> Para recibir avisos de tus pedidos:</p>
          <ol>
            <li>Toca el ícono a la izquierda de la dirección (candado o ajustes) y entra a <strong>Permisos</strong>.</li>
            <li>En <strong>Notificaciones</strong>, elige <strong>Permitir</strong>.</li>
            <li>Regresa aquí y toca "Activar avisos".</li>
          </ol>
          <button type="button" (click)="avisos.revisar()">Ya las permití</button>
        </div>
      }
      @case ('no-disponibles') {
        <p class="avisos nota">
          Puedes consultar el estado de tus pedidos aquí en cualquier momento. Para recibir avisos en el celular, instala el
          sitio como app (menú del navegador → "Instalar app" o "Agregar a pantalla de inicio").
        </p>
      }
    }
  `,
  styles: `
    .avisos {
      margin: 0;
      padding: .9rem 1rem;
      border-radius: .85rem;
      background: var(--fondo-alt);
      line-height: 1.5;
      font-size: .92rem;
      color: var(--tinta);
      p { margin: 0 0 .6rem; }
      ol { margin: 0 0 .6rem; padding-left: 1.2rem; }
      button {
        font: inherit;
        font-weight: 700;
        padding: .55rem 1rem;
        border-radius: 999px;
        border: 0;
        background: var(--follaje);
        color: #fff;
        cursor: pointer;
        &:disabled { opacity: .6; }
      }
      &.activos, &.nota { color: var(--tinta-suave); }
    }
    .error { color: #c92a2a; margin: .5rem 0 0 !important; }
  `,
})
export class BotonAvisos {
  readonly titulo = input('¿Quieres saber en qué va tu pedido?');

  protected readonly avisos = inject(AvisosCliente);
  protected readonly activando = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    const alVolver = () => this.avisos.revisar();
    document.addEventListener('visibilitychange', alVolver);
    inject(DestroyRef).onDestroy(() => document.removeEventListener('visibilitychange', alVolver));
  }

  protected async activar(): Promise<void> {
    this.activando.set(true);
    this.error.set(null);
    try {
      await this.avisos.activar();
    } catch {
      if (this.avisos.estado() !== 'bloqueados') {
        this.error.set('No se pudieron activar los avisos. Revisa tu conexión e inténtalo de nuevo.');
      }
    } finally {
      this.activando.set(false);
    }
  }
}
