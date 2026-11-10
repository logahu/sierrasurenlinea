import { HttpClient } from '@angular/common/http';
import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { mensajeDeError } from '../admin/autorizacion';
import { ClienteSesionService } from '../cuenta/cliente-sesion';
import { soloEnWeb } from '../modo-app';
import { CatalogoService } from './catalogo.service';
import { ModoPedido } from './catalogo.model';
import {
  CarritoService, DatosPedido, Entrega, LineaCarrito, TEXTOS_PEDIDO, armarMensajeCarrito, faltantesPedido, modoDe,
  piezasDe, textoCuando, textoPiezas, totalDe,
} from './carrito';
import { enlaceWhatsapp, precioConUnidad } from './contacto';

interface Enviado {
  folio: string | null;
  modo: ModoPedido;
}

/**
 * Confirmar el pedido de un negocio: /turamohoy/pedido. Igual para todos los negocios que
 * venden o rentan; cambian los textos y lo que se pregunta (domicilio, fecha del evento,
 * día de la visita). Se registra en el sistema y se abre WhatsApp con el folio.
 */
@Component({
  selector: 'app-pedido-page',
  imports: [RouterLink],
  templateUrl: './pedido-page.html',
  styleUrl: './pedido-page.scss',
  host: {
    '[style.--acento]': 'negocio.value()?.colorPrimario',
    '[attr.data-tema]': 'negocio.value()?.slug',
  },
})
export class PedidoPage {
  readonly slug = input.required<string>({ alias: 'negocio' });

  private readonly api = inject(CatalogoService);
  private readonly carrito = inject(CarritoService);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  protected readonly cliente = inject(ClienteSesionService);

  protected readonly negocio = rxResource({ params: () => this.slug(), stream: ({ params }) => this.api.negocio(params) });
  protected readonly soloWeb = computed(() => soloEnWeb(this.negocio.value()));
  protected readonly modo = computed(() => modoDe(this.negocio.value()));
  protected readonly textos = computed(() => TEXTOS_PEDIDO[this.modo() ?? 'COMPRA']);

  protected readonly lineas = this.carrito.de(() => this.slug());
  protected readonly total = computed(() => totalDe(this.lineas()));
  protected readonly cuantos = computed(() => {
    const m = this.modo() ?? 'COMPRA';
    return textoPiezas(m, m === 'CITA' ? this.lineas().length : piezasDe(this.lineas()));
  });
  protected readonly precio = precioConUnidad;
  protected readonly pesos = (n: number) => precioConUnidad({ precio: n, unidadPrecio: null });
  protected readonly hoy = new Date().toISOString().slice(0, 10);

  // --- Datos de entrega ---------------------------------------------------------------
  protected readonly entrega = signal<Entrega>('DOMICILIO');
  protected readonly entregar = signal('');
  protected readonly programado = signal(false);
  protected readonly fecha = signal('');
  protected readonly hora = signal('');
  protected readonly notas = signal('');
  protected readonly mayorDeEdad = signal(false);

  protected readonly datos = computed<DatosPedido>(() => ({
    entrega: this.modo() === 'COMPRA' ? this.entrega() : this.modo() === 'CITA' ? 'RECOGER' : 'DOMICILIO',
    entregar: this.entregar(),
    cuando: textoCuando(this.modo() ?? 'COMPRA', this.programado(), this.fecha(), this.hora()),
    notas: this.notas(),
  }));
  protected readonly faltan = computed(() =>
    faltantesPedido(this.modo() ?? 'COMPRA', this.lineas(), this.datos(), !!this.negocio.value()?.soloMayoresEdad, this.mayorDeEdad()),
  );
  protected readonly intentado = signal(false);
  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly enviado = signal<Enviado | null>(null);

  constructor() {
    const titulo = inject(Title);
    effect(() => {
      const n = this.negocio.value();
      titulo.setTitle(n ? `${TEXTOS_PEDIDO[modoDe(n) ?? 'COMPRA'].titulo} · ${n.nombre}` : 'Sierra Sur en Línea');
    });
    // La dirección de la cuenta se llena sola (sin pisar lo que ya escribió).
    effect(() => {
      const c = this.cliente.cliente();
      if (c?.direccion && !untracked(this.entregar).trim()) this.entregar.set(c.direccion);
    });
    // Encarguitos tiene su propio formulario.
    effect(() => {
      const n = this.negocio.value();
      if (n && !modoDe(n)) void this.router.navigate(['/', n.slug]);
    });
  }

  protected texto(e: Event): string {
    return (e.target as HTMLInputElement).value;
  }

  protected cambiar(l: LineaCarrito, paso: number): void {
    this.carrito.cambiarCantidad(this.slug(), l.productoId, l.cantidad + paso);
  }

  protected quitar(l: LineaCarrito): void {
    this.carrito.quitar(this.slug(), l.productoId);
  }

  protected falta(...que: string[]): boolean {
    return this.intentado() && que.some((q) => this.faltan().includes(q));
  }

  /**
   * Registra el pedido (panel y avisos) y abre WhatsApp con el folio. Si el servidor
   * tarda (Render dormido), WhatsApp se abre sin folio y el registro termina después.
   */
  protected async enviar(): Promise<void> {
    const n = this.negocio.value();
    const modo = this.modo();
    if (!n || !modo || this.enviando()) return;
    if (!this.cliente.activa()) {
      void this.router.navigate(['/cuenta/entrar'], { queryParams: { volver: `/${n.slug}/pedido`, pedido: 1 } });
      return;
    }
    this.intentado.set(true);
    this.error.set(null);
    if (this.faltan().length) return;

    const c = this.cliente.cliente()!;
    const lineas = this.lineas();
    const datos = this.datos();
    const quien = { nombre: c.nombre, telefono: c.telefono };
    const cuerpo = {
      negocio: n.slug,
      lineas: lineas.map((l) => ({ productoId: l.productoId, cantidad: l.cantidad })),
      entrega: datos.entrega,
      entregar: datos.entrega === 'DOMICILIO' ? datos.entregar.trim() : null,
      cuando: datos.cuando,
      notas: datos.notas.trim() || null,
      mayorDeEdad: this.mayorDeEdad(),
      mensaje: armarMensajeCarrito(n, modo, lineas, datos, quien),
    };

    // La ventana se abre ya (con el clic) para que el navegador no la bloquee.
    const ventana = window.open('', '_blank');
    this.enviando.set(true);
    const registro = firstValueFrom(this.http.post<{ folio: string }>(`${environment.apiUrl}/pedidos/carrito`, cuerpo));
    let rechazo: unknown = null;
    const folio = await Promise.race([
      registro.then((r) => r.folio).catch((e: unknown) => {
        rechazo = e;
        return undefined;
      }),
      new Promise<undefined>((ok) => setTimeout(() => ok(undefined), 6000)),
    ]);
    this.enviando.set(false);

    // Si el sistema lo rechazó (p. ej. un producto ya no está), no se manda nada.
    if (rechazo) {
      ventana?.close();
      this.error.set(mensajeDeError(rechazo));
      return;
    }
    const url = enlaceWhatsapp(n.whatsapp, armarMensajeCarrito(n, modo, lineas, datos, quien, folio));
    this.carrito.vaciar(n.slug);
    this.enviado.set({ folio: folio ?? null, modo });
    if (ventana) {
      ventana.location.href = url;
    } else {
      window.location.href = url;
    }
  }
}
