import { Injectable, signal } from '@angular/core';

/** Evento de Chrome/Android para ofrecer instalar la app (no está en los tipos de TS). */
interface EventoInstalar extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * "Instalar la app": cuando el navegador permite instalar el sitio (Android/Chrome,
 * Edge...), guarda el aviso para mostrarlo con nuestro propio botón.
 */
@Injectable({ providedIn: 'root' })
export class InstalarApp {
  private aviso: EventoInstalar | null = null;
  readonly disponible = signal(false);

  constructor() {
    if (typeof window === 'undefined') return;
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.aviso = e as EventoInstalar;
      this.disponible.set(true);
    });
    window.addEventListener('appinstalled', () => {
      this.aviso = null;
      this.disponible.set(false);
    });
  }

  async instalar(): Promise<void> {
    if (!this.aviso) return;
    await this.aviso.prompt();
    await this.aviso.userChoice;
    this.aviso = null;
    this.disponible.set(false);
  }
}
