import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { SwPush } from '@angular/service-worker';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

const CLAVE = 'ssl:avisos-cliente';

export type EstadoAvisos = 'activos' | 'apagados' | 'bloqueados' | 'no-disponibles';

/**
 * Avisos push para el cliente: le llega una notificación cuando el negocio acepta su
 * pedido, cuando va en camino (o está listo para recoger) y cuando se entrega.
 */
@Injectable({ providedIn: 'root' })
export class AvisosCliente {
  private readonly http = inject(HttpClient);
  private readonly swPush = inject(SwPush);
  private readonly base = `${environment.apiUrl}/clientes/push`;

  readonly estado = signal<EstadoAvisos>(this.calcular());

  /** Vuelve a leer el permiso (p. ej. al regresar de los ajustes del navegador). */
  revisar(): void {
    this.estado.set(this.calcular());
  }

  async activar(): Promise<void> {
    const { clave } = await firstValueFrom(this.http.get<{ clave: string }>(`${this.base}/clave`));
    try {
      const sub = await this.swPush.requestSubscription({ serverPublicKey: clave });
      const json = sub.toJSON();
      await firstValueFrom(
        this.http.post(this.base, { endpoint: json.endpoint, p256dh: json.keys?.['p256dh'], auth: json.keys?.['auth'] }),
      );
      guardar(json.endpoint ?? '1');
    } finally {
      this.revisar();
    }
  }

  /** Al cerrar sesión, este celular deja de recibir los avisos de esa cuenta. */
  async apagar(): Promise<void> {
    const endpoint = leer();
    guardar(null);
    this.revisar();
    if (!endpoint || !this.swPush.isEnabled) return;
    const sub = await firstValueFrom(this.swPush.subscription);
    if (!sub) return;
    const json = sub.toJSON();
    await firstValueFrom(
      this.http.delete(this.base, { body: { endpoint: json.endpoint, p256dh: json.keys?.['p256dh'], auth: json.keys?.['auth'] } }),
    ).catch(() => undefined);
  }

  private calcular(): EstadoAvisos {
    if (!this.swPush.isEnabled || typeof Notification === 'undefined') return 'no-disponibles';
    if (Notification.permission === 'denied') return 'bloqueados';
    return Notification.permission === 'granted' && leer() ? 'activos' : 'apagados';
  }
}

function leer(): string | null {
  try {
    return localStorage.getItem(CLAVE);
  } catch {
    return null;
  }
}

function guardar(valor: string | null): void {
  try {
    if (valor) localStorage.setItem(CLAVE, valor);
    else localStorage.removeItem(CLAVE);
  } catch {
    /* sin almacenamiento */
  }
}
