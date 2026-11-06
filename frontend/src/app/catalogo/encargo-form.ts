import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Negocio, Producto } from './catalogo.model';
import { enlaceWhatsapp, precioConUnidad } from './contacto';
import {
  DatosEncargo, ENCARGO_VACIO, TIPOS_ENCARGO, TOPE_ADELANTO, UNIDAD_VIAJE, armarMensajeEncargo,
  camposFaltantes, enlaceMapa, esViaje, etiquetas, opcionDe, textoPagoCompra, zonasPara,
} from './encargo';

/**
 * Página de un negocio de tipo SERVICIO (Encarguitos): la "lista del mandado" y los
 * viajes en moto. El cliente llena el formulario y se abre WhatsApp con el mensaje ya
 * armado. No se guarda nada en la base; el negocio confirma por WhatsApp.
 */
@Component({
  selector: 'app-encargo-form',
  imports: [ReactiveFormsModule],
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
  protected readonly datos = computed(() => ({ ...ENCARGO_VACIO, ...this.valores() }) as DatosEncargo);

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
  protected readonly faltan = computed(() => camposFaltantes(this.datos(), this.opcion()));
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
    ),
  );

  constructor() {
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

  protected enviar(): void {
    this.intentado.set(true);
    if (this.faltan().length) return;
    const url = enlaceWhatsapp(this.negocio().whatsapp, this.mensaje());
    window.open(url, '_blank', 'noopener');
  }

  protected falta(...campos: string[]): boolean {
    return this.intentado() && campos.some((c) => this.faltan().includes(c));
  }
}
