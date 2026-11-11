import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ClienteSesionService } from '../cuenta/cliente-sesion';
import { MapaUbicacion } from '../mapa/mapa-ubicacion';
import { Punto, puntoDe } from '../mapa/ubicacion';
import { UltimoPedido } from '../cuenta/ultimo-pedido';
import { rxResource } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { firstValueFrom, of } from 'rxjs';
import { CatalogoService } from './catalogo.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Negocio, Platillo, Producto, Restaurante } from './catalogo.model';
import { enlaceWhatsapp, precioConUnidad } from './contacto';
import {
  DatosEncargo, ENCARGO_VACIO, TIPOS_ENCARGO, TOPE_ADELANTO, UNIDAD_VIAJE, armarMensajeEncargo,
  PedidoComida, camposFaltantes, datosDelPedido, enlaceMapa, esComida, esViaje, etiquetas, opcionDe, subtotalComida, textoPagoCompra,
  zonasPara,
} from './encargo';

/**
 * Página de un negocio de tipo SERVICIO (Encarguitos): la "lista del mandado" y los
 * viajes en moto. Para enviar se necesita la cuenta del cliente: el pedido se registra
 * (panel y repartidores) y se abre WhatsApp con el mensaje y el folio.
 */
@Component({
  selector: 'app-encargo-form',
  imports: [ReactiveFormsModule, RouterLink, MapaUbicacion],
  templateUrl: './encargo-form.html',
  styleUrl: './encargo-form.scss',
})
export class EncargoForm {
  readonly negocio = input.required<Negocio>();
  /** Tarifas del negocio (sus "productos"). */
  readonly tarifas = input<Producto[]>([]);

  /** Opciones de ¿Qué necesitas? que el negocio tiene visibles (o las de respaldo). */
  protected readonly tipos = computed(() => {
    const delNegocio = this.negocio().tiposEncargo ?? [];
    return delNegocio.length ? delNegocio : TIPOS_ENCARGO;
  });
  /** Cuánto adelanta el repartidor: lo define el negocio desde el panel. */
  protected readonly tope = computed(() => this.negocio().topeAdelanto ?? TOPE_ADELANTO);
  protected readonly precio = precioConUnidad;
  protected readonly textoPago = textoPagoCompra;

  protected readonly form = inject(FormBuilder).nonNullable.group({ ...ENCARGO_VACIO });
  private readonly valores = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  /** Punto de entrega en el mapa (se llena con la ubicación habitual de la cuenta). */
  protected readonly puntoEntrega = signal<Punto | null>(null);
  protected readonly datos = computed(
    () => ({ ...ENCARGO_VACIO, ...this.valores(), puntoEntrega: this.puntoEntrega() }) as DatosEncargo,
  );

  protected readonly opcion = computed(() => opcionDe(this.tipos(), this.datos().tipo));
  protected readonly viaje = computed(() => esViaje(this.opcion()));
  protected readonly textos = computed(() => etiquetas(this.opcion()));
  protected readonly zonas = computed(() => zonasPara(this.tarifas(), this.opcion()));
  /** Hay viajes si alguna opción visible es de viaje. */
  protected readonly hayViajes = computed(() => this.tipos().some(esViaje));
  protected readonly zonasMandado = computed(() =>
    this.tarifas().filter((t) => t.unidadPrecio !== 'extra' && t.unidadPrecio !== UNIDAD_VIAJE).sort((a, b) => a.precio - b.precio),
  );
  protected readonly zonasViaje = computed(() =>
    this.tarifas().filter((t) => t.unidadPrecio === UNIDAD_VIAJE).sort((a, b) => a.precio - b.precio),
  );
  protected readonly extras = computed(() => this.tarifas().filter((t) => t.unidadPrecio === 'extra'));
  // --- Comida a domicilio ---------------------------------------------------------
  private readonly catalogo = inject(CatalogoService);
  protected readonly comida = computed(() => esComida(this.opcion()));
  /** Lugares de comida: solo se piden si el negocio ofrece esa opción. */
  protected readonly lugares = rxResource({
    params: () => (this.tipos().some(esComida) ? this.negocio().slug : undefined),
    stream: ({ params }) => (params ? this.catalogo.restaurantes(params) : of([] as Restaurante[])),
  });
  protected readonly lugarId = signal<number | null>(null);
  protected readonly lugar = computed(() => (this.lugares.value() ?? []).find((r) => r.id === this.lugarId()));
  /** Cantidad por platillo (id → cantidad). */
  protected readonly cantidades = signal<Record<number, number>>({});
  protected readonly pedidoComida = computed<PedidoComida | undefined>(() => {
    const r = this.lugar();
    if (!r) return undefined;
    const c = this.cantidades();
    return { restaurante: r, lineas: r.platillos.filter((p) => (c[p.id] ?? 0) > 0).map((p) => ({ platillo: p, cantidad: c[p.id] })) };
  });
  protected readonly subtotal = computed(() => subtotalComida(this.pedidoComida()));
  protected readonly piezas = computed(() => (this.pedidoComida()?.lineas ?? []).reduce((s, l) => s + l.cantidad, 0));

  protected elegirLugar(r: Restaurante): void {
    if (this.lugarId() !== r.id) this.cantidades.set({});
    this.lugarId.set(r.id);
  }

  protected cantidad(p: Platillo): number {
    return this.cantidades()[p.id] ?? 0;
  }

  protected cambiarCantidad(p: Platillo, paso: number): void {
    this.cantidades.update((c) => ({ ...c, [p.id]: Math.max(0, Math.min(20, (c[p.id] ?? 0) + paso)) }));
  }

  protected readonly faltan = computed(() => camposFaltantes(this.datos(), this.opcion(), this.pedidoComida()));
  /** Solo se muestran los errores después del primer intento de enviar. */
  protected readonly intentado = signal(false);
  protected readonly ubicando = signal(false);
  protected readonly errorUbicacion = signal<string | null>(null);
  protected readonly hoy = new Date().toISOString().slice(0, 10);

  protected readonly mensaje = computed(() =>
    armarMensajeEncargo(
      this.datos(),
      this.tarifas().find((t) => String(t.id) === this.datos().zona),
      this.tope(),
      this.opcion(),
      this.pedidoComida(),
    ),
  );

  protected readonly cliente = inject(ClienteSesionService);
  private readonly ultimoPedido = inject(UltimoPedido);
  private readonly router = inject(Router);
  /** Ruta de esta página, para volver aquí después de iniciar sesión. */
  protected readonly aqui = computed(() => '/' + this.negocio().slug);

  constructor() {
    // Si el cliente salió a iniciar sesión, recupera lo que llevaba escrito.
    const borrador = leerBorrador();
    if (borrador) {
      this.form.patchValue(borrador.datos);
      if (borrador.lugarId !== null) this.lugarId.set(borrador.lugarId);
      this.cantidades.set(borrador.cantidades);
    }
    // Con sesión, los datos de la cuenta se llenan solos (sin pisar lo que ya escribió).
    effect(() => {
      const c = this.cliente.cliente();
      if (!c) return;
      untracked(() => {
        const f = this.form.controls;
        if (!f.nombre.value.trim()) f.nombre.setValue(c.nombre);
        if (!f.telefono.value.trim()) f.telefono.setValue(c.telefono);
        if (!f.entregar.value.trim() && c.direccion) f.entregar.setValue(c.direccion);
        const habitual = puntoDe(c.lat, c.lng);
        if (habitual && !this.puntoEntrega()) this.puntoEntrega.set(habitual);
      });
    });
    // Elige la primera opción en cuanto llegan; al cambiar de opción se limpia la zona
    // (las de viaje y las de mandado son distintas) y se respeta "solo con reservación".
    effect(() => {
      const tipos = this.tipos();
      const actual = this.form.controls.tipo.value;
      if (!tipos.some((t) => String(t.id) === actual)) this.form.controls.tipo.setValue(String(tipos[0].id));
    });
    let anterior = '';
    effect(() => {
      const o = this.opcion();
      const id = String(o.id);
      if (anterior && anterior !== id) this.form.controls.zona.setValue('');
      anterior = id;
      if (o.soloProgramado && this.form.controls.cuando.value !== 'programado') {
        this.form.controls.cuando.setValue('programado');
      }
    });
  }

  protected usarUbicacion(): void {
    this.errorUbicacion.set(null);
    if (!('geolocation' in navigator)) {
      this.errorUbicacion.set('Tu navegador no comparte la ubicación; escribe la dirección.');
      return;
    }
    this.ubicando.set(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        this.form.controls.ubicacion.setValue(enlaceMapa(p.coords.latitude, p.coords.longitude));
        this.ubicando.set(false);
      },
      () => {
        this.errorUbicacion.set('No pudimos obtener tu ubicación; revisa el permiso o escribe la dirección.');
        this.ubicando.set(false);
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  protected quitarUbicacion(): void {
    this.form.controls.ubicacion.setValue('');
  }

  protected readonly enviando = signal(false);
  private readonly http = inject(HttpClient);

  /**
   * Registra el pedido (para el panel y los repartidores) y abre WhatsApp con el folio.
   * Si el servidor tarda (Render dormido) no se hace esperar al cliente: WhatsApp se abre
   * sin folio y el registro se completa en segundo plano.
   */
  protected async enviar(): Promise<void> {
    if (!this.cliente.activa()) {
      guardarBorrador({ datos: this.form.getRawValue(), lugarId: this.lugarId(), cantidades: this.cantidades() });
      void this.router.navigate(['/cuenta/entrar'], { queryParams: { volver: this.aqui(), pedido: 1 } });
      return;
    }
    this.intentado.set(true);
    if (this.faltan().length || this.enviando()) return;
    // La ventana se abre ya (con el clic) para que el navegador no la bloquee.
    const ventana = window.open('', '_blank');
    this.enviando.set(true);
    const zona = this.tarifas().find((t) => String(t.id) === this.datos().zona);
    const datos = datosDelPedido(this.datos(), this.opcion(), this.negocio().slug, this.mensaje(), zona, this.pedidoComida());
    const registro = firstValueFrom(this.http.post<{ folio: string }>(`${environment.apiUrl}/pedidos`, datos));
    const folio = await Promise.race([
      registro.then((r) => r.folio).catch(() => undefined),
      new Promise<undefined>((ok) => setTimeout(() => ok(undefined), 6000)),
    ]);
    this.ultimoPedido.registrar(folio, this.negocio().nombre);
    const mensaje = armarMensajeEncargo(this.datos(), zona, this.tope(), this.opcion(), this.pedidoComida(), folio);
    const url = enlaceWhatsapp(this.negocio().whatsapp, mensaje);
    this.enviando.set(false);
    if (ventana) {
      ventana.location.href = url;
    } else {
      window.location.href = url;
    }
  }

  protected falta(...campos: string[]): boolean {
    return this.intentado() && campos.some((c) => this.faltan().includes(c));
  }
}

const CLAVE_BORRADOR = 'ssl:borrador-encargo';

interface Borrador {
  datos: Partial<DatosEncargo>;
  lugarId: number | null;
  cantidades: Record<number, number>;
}

/** Guarda el pedido a medio llenar mientras el cliente inicia sesión (solo esta pestaña). */
function guardarBorrador(b: Borrador): void {
  try {
    sessionStorage.setItem(CLAVE_BORRADOR, JSON.stringify(b));
  } catch {
    /* sin almacenamiento: se vuelve a llenar */
  }
}

/** Lo lee una sola vez y lo borra. */
function leerBorrador(): Borrador | null {
  try {
    const crudo = sessionStorage.getItem(CLAVE_BORRADOR);
    sessionStorage.removeItem(CLAVE_BORRADOR);
    return crudo ? (JSON.parse(crudo) as Borrador) : null;
  } catch {
    return null;
  }
}
