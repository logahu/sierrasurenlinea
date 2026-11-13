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
import { ControlColonia, OTRA } from '../colonias/elegir-colonia';
import { SeleccionColonia, clave } from '../colonias/colonias';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { GrupoOpciones, Negocio, Platillo, Producto, Restaurante } from './catalogo.model';
import {
  Elegida, alternar, estaElegida, firmaOpciones, gruposFaltantes, precioUnitario, reglaDe, textoOpciones, tieneOpciones,
} from './comida';
import { enlaceWhatsapp, precioConUnidad } from './contacto';
import {
  DatosEncargo, ENCARGO_VACIO, TIPOS_ENCARGO, TOPE_ADELANTO, UNIDAD_VIAJE, armarMensajeEncargo,
  LineaComida, PedidoComida, camposFaltantes, porPersona, subtotalLinea, datosDelPedido, enlaceMapa, esComida, esViaje, etiquetas, opcionDe, subtotalComida, textoPagoCompra,
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
  /** Colonia o comunidad (combo con «Otra»). */
  protected readonly col = new ControlColonia();
  protected readonly otra = OTRA;
  protected readonly datos = computed(
    () =>
      ({
        ...ENCARGO_VACIO, ...this.valores(), puntoEntrega: this.puntoEntrega(),
        colonia: this.col.seleccion()?.nombre ?? null, coloniaOtra: this.col.esOtra(),
      }) as DatosEncargo,
  );

  protected readonly opcion = computed(() => opcionDe(this.tipos(), this.datos().tipo));
  protected readonly viaje = computed(() => esViaje(this.opcion()));
  protected readonly textos = computed(() => etiquetas(this.opcion()));
  protected readonly zonas = computed(() => zonasPara(this.tarifas(), this.opcion()));
  /** Tarifa que le toca a la colonia elegida (el administrador la asigna); si no hay, el cliente elige zona. */
  protected readonly tarifaColonia = computed(() => {
    const z = clave(this.col.seleccion()?.zona);
    return z ? this.zonas().find((t) => clave(t.nombre) === z) : undefined;
  });
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
  /** Renglones de comida (de todas las personas). */
  protected readonly lineasComida = signal<LineaComida[]>([]);
  /** Personas del pedido: '' es quien pide; las demás, con su nombre. */
  protected readonly personas = signal<string[]>(['']);
  /** Para quién se están agregando platillos. */
  protected readonly personaActiva = signal('');
  protected readonly nuevaPersona = signal<string | null>(null);
  /** Platillo que se está armando (con opciones, cantidad y nota). */
  protected readonly armando = signal<{ platillo: Platillo; opciones: Elegida[]; cantidad: number; nota: string } | null>(null);
  protected readonly intentoArmar = signal(false);
  protected readonly tieneOpciones = tieneOpciones;
  protected readonly reglaDe = reglaDe;
  protected readonly estaElegida = estaElegida;
  protected readonly textoOpciones = textoOpciones;
  protected readonly subtotalLinea = subtotalLinea;

  protected readonly pedidoComida = computed<PedidoComida | undefined>(() => {
    const r = this.lugar();
    if (!r) return undefined;
    // Solo platillos que siguen en el menú.
    const ids = new Set(r.platillos.map((p) => p.id));
    return { restaurante: r, lineas: this.lineasComida().filter((l) => ids.has(l.platillo.id)) };
  });
  protected readonly subtotal = computed(() => subtotalComida(this.pedidoComida()));
  protected readonly piezas = computed(() => (this.pedidoComida()?.lineas ?? []).reduce((s, l) => s + l.cantidad, 0));
  protected readonly ordenes = computed(() => porPersona(this.pedidoComida()?.lineas ?? []));
  protected readonly variasPersonas = computed(() => this.personas().length > 1);

  protected elegirLugar(r: Restaurante): void {
    if (this.lugarId() !== r.id) {
      this.lineasComida.set([]);
      this.armando.set(null);
    }
    this.lugarId.set(r.id);
  }

  protected nombrePersona(persona: string): string {
    return persona || 'Para ti';
  }

  /** Piezas de ese platillo sin opciones para la persona activa (para el contador del menú). */
  protected cantidad(p: Platillo): number {
    return this.lineasComida()
      .filter((l) => l.platillo.id === p.id && (l.persona ?? '') === this.personaActiva() && !l.opciones?.length && !l.nota)
      .reduce((s, l) => s + l.cantidad, 0);
  }

  /** −/+ del menú para platillos sin opciones. */
  protected cambiarCantidad(p: Platillo, paso: number): void {
    const persona = this.personaActiva();
    const lista = this.lineasComida();
    const i = lista.findIndex((l) => l.platillo.id === p.id && (l.persona ?? '') === persona && !l.opciones?.length && !l.nota);
    if (i < 0) {
      if (paso > 0) this.lineasComida.set([...lista, { platillo: p, cantidad: 1, opciones: [], nota: '', persona }]);
      return;
    }
    this.cambiarLinea(lista[i], paso);
  }

  /** −/+ en el resumen: en 0 se quita. */
  protected cambiarLinea(l: LineaComida, paso: number): void {
    const cantidad = Math.max(0, Math.min(20, l.cantidad + paso));
    this.lineasComida.update((ls) =>
      cantidad ? ls.map((x) => (x === l ? { ...x, cantidad } : x)) : ls.filter((x) => x !== l),
    );
  }

  protected quitarLinea(l: LineaComida): void {
    this.lineasComida.update((ls) => ls.filter((x) => x !== l));
  }

  protected armar(p: Platillo): void {
    this.intentoArmar.set(false);
    this.armando.set(this.armando()?.platillo.id === p.id ? null : { platillo: p, opciones: [], cantidad: 1, nota: '' });
  }

  protected elegir(g: GrupoOpciones, opcion: string): void {
    const a = this.armando();
    if (a) this.armando.set({ ...a, opciones: alternar(a.opciones, g, opcion) });
  }

  protected cantidadArmando(paso: number): void {
    const a = this.armando();
    if (a) this.armando.set({ ...a, cantidad: Math.max(1, Math.min(20, a.cantidad + paso)) });
  }

  protected notaArmando(nota: string): void {
    const a = this.armando();
    if (a) this.armando.set({ ...a, nota: nota.slice(0, 200) });
  }

  protected readonly faltanArmando = computed(() => {
    const a = this.armando();
    return a ? gruposFaltantes(a.platillo, a.opciones) : [];
  });
  protected readonly precioArmando = computed(() => {
    const a = this.armando();
    return a ? precioUnitario(a.platillo, a.opciones) * a.cantidad : 0;
  });

  /** Agrega lo armado a la orden de la persona activa (si ya hay uno igual, suma). */
  protected agregarArmado(): void {
    const a = this.armando();
    if (!a) return;
    this.intentoArmar.set(true);
    if (this.faltanArmando().length) return;
    const persona = this.personaActiva();
    const nota = a.nota.trim();
    const firma = firmaOpciones(a.opciones);
    const lista = this.lineasComida();
    const igual = lista.find(
      (l) => l.platillo.id === a.platillo.id && (l.persona ?? '') === persona && firmaOpciones(l.opciones) === firma && (l.nota ?? '') === nota,
    );
    this.lineasComida.set(
      igual
        ? lista.map((l) => (l === igual ? { ...l, cantidad: Math.min(20, l.cantidad + a.cantidad) } : l))
        : [...lista, { platillo: a.platillo, cantidad: a.cantidad, opciones: a.opciones, nota, persona }],
    );
    this.armando.set(null);
    this.intentoArmar.set(false);
  }

  protected agregarPersona(): void {
    const nombre = (this.nuevaPersona() ?? '').trim().slice(0, 60);
    if (!nombre) return;
    const existe = this.personas().find((p) => p.toLowerCase() === nombre.toLowerCase());
    if (!existe) this.personas.update((ps) => [...ps, nombre]);
    this.personaActiva.set(existe ?? nombre);
    this.nuevaPersona.set(null);
  }

  /** Quita a una persona y sus platillos. */
  protected quitarPersona(persona: string): void {
    if (!persona) return;
    this.personas.update((ps) => ps.filter((p) => p !== persona));
    this.lineasComida.update((ls) => ls.filter((l) => (l.persona ?? '') !== persona));
    if (this.personaActiva() === persona) this.personaActiva.set('');
  }

  protected platillosDe(persona: string): number {
    return this.lineasComida().filter((l) => (l.persona ?? '') === persona).reduce((s, l) => s + l.cantidad, 0);
  }

  protected readonly faltan = computed(() => {
    const f = camposFaltantes(this.datos(), this.opcion(), this.pedidoComida());
    return this.col.falta() ? [this.viaje() ? 'la colonia de destino' : 'tu colonia', ...f] : f;
  });
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
      if (borrador.lineasComida) this.lineasComida.set(borrador.lineasComida);
      if (borrador.personas?.length) this.personas.set(borrador.personas);
      if (borrador.colonia) this.col.seleccion.set(borrador.colonia);
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

  /** Con la tarifa de la colonia, la zona se elige sola; si cambia a una sin tarifa, se vuelve a pedir. */
  private readonly zonaAutomatica = effect(() => {
    const t = this.tarifaColonia();
    untracked(() => {
      const control = this.form.controls.zona;
      if (t) {
        if (control.value !== String(t.id)) control.setValue(String(t.id));
        this.zonaPuesta = String(t.id);
      } else if (this.zonaPuesta && control.value === this.zonaPuesta) {
        control.setValue('');
        this.zonaPuesta = '';
      }
    });
  });
  private zonaPuesta = '';

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
      guardarBorrador({
        datos: this.form.getRawValue(), lugarId: this.lugarId(), lineasComida: this.lineasComida(), personas: this.personas(),
        colonia: this.col.seleccion(),
      });
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
  lineasComida?: LineaComida[];
  personas?: string[];
  colonia?: SeleccionColonia | null;
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
