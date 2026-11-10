import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Pedido } from './admin.model';
import { mensajeDeError } from './autorizacion';
import { PedidosService, hace, nombreEstado, siguientePaso, sonar } from './pedidos';
import { SesionService } from './sesion';

const CADA_MS = 15000;

/**
 * Pedidos en tiempo real: se actualiza solo cada 15 segundos (y al volver a la app),
 * suena cuando llega uno nuevo y, con las notificaciones activadas, avisa aunque el
 * celular esté bloqueado.
 */
@Component({
  selector: 'app-pedidos-page',
  template: `
    <header class="panel-titulo">
      <h1>Pedidos</h1>
      <p class="ayuda">
        @if (cargando() && !pedidos().length) { Cargando… }
        @else { {{ activos() ? 'En curso' : 'Terminados' }} · se actualiza solo · {{ actualizado() }} }
      </p>
    </header>

    @if (avisoPush(); as a) {
      <div class="aviso-push" role="note">
        <span>{{ a }}</span>
        @if (puedeActivar()) {
          <button type="button" class="btn primario" (click)="activar()" [disabled]="activando()">
            {{ activando() ? 'Activando…' : '🔔 Activar notificaciones' }}
          </button>
        }
      </div>
    }
    @if (error(); as e) { <p class="error" role="alert">{{ e }}</p> }

    <div class="chips" role="group" aria-label="Ver">
      <button type="button" [class.activo]="activos()" (click)="ver(true)">En curso</button>
      <button type="button" [class.activo]="!activos()" (click)="ver(false)">Terminados</button>
    </div>

    <ul class="lista pedidos">
      @for (p of pedidos(); track p.id) {
        <li class="pedido" [attr.data-estado]="p.estado">
          <div class="pedido-cabeza">
            <span class="estado-pedido">{{ nombreEstado(p) }}</span>
            <strong>{{ p.tipo }}</strong>
            <span class="ayuda">{{ p.folio }} · {{ hace(p.creado) }}</span>
          </div>
          <p class="pedido-cliente">
            <strong>{{ p.clienteNombre }}</strong> · {{ p.entregar }}
            @if (p.zona) { <span class="ayuda"> · {{ p.zona }}</span> }
            @if (p.totalEstimado !== null) { <span class="ayuda"> · aprox. {{ pesos(p.totalEstimado) }}</span> }
          </p>
          @if (p.cuando) { <p class="pedido-cuando">🗓️ {{ p.cuando }}@if (p.entrega === 'RECOGER' && p.modo !== 'CITA') { · pasa a recogerlo } </p> }
          @if (p.lineas.length) {
            <ul class="pedido-lineas">
              @for (l of p.lineas; track $index) {
                <li><span>{{ l.cantidad }} × {{ l.nombre }}</span> <span>{{ pesos(l.subtotal) }}</span></li>
              }
            </ul>
          }
          @if (p.notas) { <p class="pedido-notas">📝 {{ p.notas }}</p> }
          @if (!esDeUnNegocio()) { <p class="ayuda">{{ p.negocioNombre }}</p> }
          @if (p.repartidorNombre) { <p class="ayuda">🛵 {{ p.repartidorNombre }}</p> }

          <details>
            <summary>Ver el pedido completo</summary>
            <pre class="mensaje-pedido">{{ p.mensaje }}</pre>
          </details>

          <div class="acciones-fila">
            @if (siguiente(p); as s) {
              <button type="button" class="btn primario" (click)="mover(p, s.estado)" [disabled]="ocupado() === p.id">{{ s.texto }}</button>
            }
            <a class="btn secundario" [href]="'tel:' + p.clienteTelefono">📞 Llamar</a>
            <a class="btn secundario" [href]="whatsapp(p)" target="_blank" rel="noopener">💬 WhatsApp</a>
            @if (!sesion.esRepartidor() && (p.estado === 'NUEVO' || p.estado === 'ACEPTADO' || p.estado === 'EN_CAMINO')) {
              <button type="button" class="btn secundario peligro" (click)="cancelar(p)" [disabled]="ocupado() === p.id">Cancelar</button>
            }
          </div>
        </li>
      } @empty {
        @if (!cargando()) {
          <li class="ayuda vacio">{{ activos() ? 'No hay pedidos en curso. Te avisamos cuando llegue uno.' : 'Todavía no hay pedidos terminados.' }}</li>
        }
      }
    </ul>
  `,
})
export class PedidosPage {
  protected readonly sesion = inject(SesionService);
  private readonly servicio = inject(PedidosService);
  protected readonly nombreEstado = nombreEstado;
  protected readonly hace = hace;
  protected readonly siguiente = siguientePaso;
  /** Encargados y repartidores de un solo negocio no necesitan ver de qué negocio es cada pedido. */
  protected readonly esDeUnNegocio = computed(() => !!this.sesion.usuario()?.negocioSlug);

  protected readonly pedidos = signal<Pedido[]>([]);
  protected readonly activos = signal(true);
  protected readonly cargando = signal(true);
  protected readonly ocupado = signal<number | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly activando = signal(false);
  protected readonly actualizado = signal('');
  private conocidos: Set<number> | null = null;

  private readonly suscripcion = toSignal(this.servicio.suscrito(), { initialValue: null });
  protected readonly puedeActivar = computed(() => this.servicio.pushDisponible && this.servicio.permiso !== 'denied');
  protected readonly avisoPush = computed(() => {
    if (this.suscripcion()) return null;
    if (!this.servicio.pushDisponible) {
      return 'Para recibir avisos con el celular bloqueado, instala la app del panel (menú del navegador → "Instalar app" o "Agregar a pantalla de inicio").';
    }
    if (this.servicio.permiso === 'denied') {
      return 'Las notificaciones están bloqueadas para este sitio. Actívalas en los ajustes del navegador.';
    }
    return 'Activa las notificaciones para enterarte de cada pedido aunque tengas el celular bloqueado.';
  });

  constructor() {
    this.cargar();
    const intervalo = setInterval(() => document.visibilityState === 'visible' && this.cargar(), CADA_MS);
    const alVolver = () => document.visibilityState === 'visible' && this.cargar();
    document.addEventListener('visibilitychange', alVolver);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(intervalo);
      document.removeEventListener('visibilitychange', alVolver);
    });
  }

  protected ver(activos: boolean): void {
    this.activos.set(activos);
    this.cargando.set(true);
    this.pedidos.set([]);
    this.cargar();
  }

  private cargar(): void {
    const activos = this.activos();
    this.servicio.listar(activos).subscribe({
      next: (lista) => {
        if (activos !== this.activos()) return;
        if (activos) {
          const nuevos = lista.filter((p) => p.estado === 'NUEVO');
          if (this.conocidos && nuevos.some((p) => !this.conocidos!.has(p.id))) sonar();
          this.conocidos = new Set(lista.map((p) => p.id));
          this.servicio.nuevos.set(nuevos.length);
        }
        this.pedidos.set(lista);
        this.cargando.set(false);
        this.error.set(null);
        this.actualizado.set(new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }));
      },
      error: (e) => {
        this.cargando.set(false);
        this.error.set(mensajeDeError(e));
      },
    });
  }

  protected mover(p: Pedido, estado: Pedido['estado']): void {
    this.ocupado.set(p.id);
    this.servicio.cambiarEstado(p.id, estado).subscribe({
      next: () => {
        this.ocupado.set(null);
        this.cargar();
      },
      error: (e) => {
        this.ocupado.set(null);
        this.error.set(mensajeDeError(e));
        this.cargar();
      },
    });
  }

  protected cancelar(p: Pedido): void {
    if (confirm(`¿Cancelar el pedido ${p.folio} de ${p.clienteNombre}?`)) this.mover(p, 'CANCELADO');
  }

  protected async activar(): Promise<void> {
    this.activando.set(true);
    this.error.set(null);
    try {
      await this.servicio.activarNotificaciones();
    } catch (e) {
      this.error.set(e instanceof Error ? `No se pudieron activar: ${e.message}` : mensajeDeError(e));
    } finally {
      this.activando.set(false);
    }
  }

  protected whatsapp(p: Pedido): string {
    return `https://wa.me/52${p.clienteTelefono}?text=${encodeURIComponent(`Hola ${p.clienteNombre}, te escribimos de ${p.negocioNombre} por tu pedido ${p.folio}.`)}`;
  }

  protected pesos(n: number): string {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);
  }
}
