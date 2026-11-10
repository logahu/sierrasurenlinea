import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { SwPush } from '@angular/service-worker';
import { Observable, firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { EstadoPedido, Pedido } from './admin.model';

/** Pedidos del panel y notificaciones push del celular. */
@Injectable({ providedIn: 'root' })
export class PedidosService {
  private readonly http = inject(HttpClient);
  private readonly swPush = inject(SwPush);
  private readonly base = `${environment.apiUrl}/admin`;

  /** Cuántos pedidos nuevos hay (para la marca en la barra del panel). */
  readonly nuevos = signal(0);

  listar(activos = true): Observable<Pedido[]> {
    return this.http.get<Pedido[]>(`${this.base}/pedidos`, { params: { activos } });
  }

  cambiarEstado(id: number, estado: EstadoPedido): Observable<Pedido> {
    return this.http.put<Pedido>(`${this.base}/pedidos/${id}/estado`, { estado });
  }

  // ---- Notificaciones push

  /** El navegador sabe recibir push (requiere la app publicada, no el modo desarrollo). */
  get pushDisponible(): boolean {
    return this.swPush.isEnabled && typeof Notification !== 'undefined';
  }

  get permiso(): NotificationPermission | 'no-disponible' {
    return typeof Notification === 'undefined' ? 'no-disponible' : Notification.permission;
  }

  async activarNotificaciones(): Promise<void> {
    const { clave } = await firstValueFrom(this.http.get<{ clave: string }>(`${this.base}/push/clave`));
    const sub = await this.swPush.requestSubscription({ serverPublicKey: clave });
    const json = sub.toJSON();
    await firstValueFrom(
      this.http.post(`${this.base}/push`, { endpoint: json.endpoint, p256dh: json.keys?.['p256dh'], auth: json.keys?.['auth'] }),
    );
  }

  /** ¿Este celular ya está suscrito? */
  suscrito(): Observable<PushSubscription | null> {
    return this.swPush.subscription;
  }
}

/** Siguiente paso de un pedido, con el texto del botón. */
export function siguientePaso(p: Pedido): { estado: EstadoPedido; texto: string } | null {
  switch (p.estado) {
    case 'NUEVO':
      return { estado: 'ACEPTADO', texto: 'Aceptar' };
    case 'ACEPTADO':
      return { estado: 'EN_CAMINO', texto: p.modo === 'VIAJE' ? 'Voy por el pasajero' : 'Voy en camino' };
    case 'EN_CAMINO':
      return { estado: 'ENTREGADO', texto: p.modo === 'VIAJE' ? 'Viaje terminado' : 'Entregado' };
    default:
      return null;
  }
}

export const NOMBRE_ESTADO: Record<EstadoPedido, string> = {
  NUEVO: 'Nuevo',
  ACEPTADO: 'Aceptado',
  EN_CAMINO: 'En camino',
  ENTREGADO: 'Entregado',
  CANCELADO: 'Cancelado',
};

/** "hace 3 min", "hace 2 h". */
export function hace(iso: string, ahora = Date.now()): string {
  const min = Math.max(0, Math.round((ahora - Date.parse(iso)) / 60000));
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  return h < 24 ? `hace ${h} h` : `hace ${Math.floor(h / 24)} d`;
}

/** Pitido corto para avisar de un pedido nuevo con la pantalla abierta. */
export function sonar(): void {
  try {
    const ctx = new AudioContext();
    [0, 0.25, 0.5].forEach((t) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.25, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.2);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.2);
    });
  } catch {
    /* sin audio */
  }
}
