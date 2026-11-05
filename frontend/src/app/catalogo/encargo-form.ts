import { Component, computed, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Negocio, Producto } from './catalogo.model';
import { enlaceWhatsapp, precioConUnidad } from './contacto';
import {
  DatosEncargo, ENCARGO_VACIO, TIPOS_ENCARGO, TOPE_ADELANTO, armarMensajeEncargo,
  camposFaltantes, opcionDe, textoPagoCompra, zonasDeEntrega,
} from './encargo';

/**
 * Página de un negocio de tipo SERVICIO (Encarguitos): la "lista del mandado".
 * El cliente llena el encargo y se abre WhatsApp con el mensaje ya armado.
 * No se guarda nada en la base; el negocio confirma por WhatsApp.
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

  protected readonly tipos = TIPOS_ENCARGO;
  protected readonly tope = TOPE_ADELANTO;
  protected readonly precio = precioConUnidad;
  protected readonly textoPago = textoPagoCompra;

  protected readonly form = inject(FormBuilder).nonNullable.group({ ...ENCARGO_VACIO });
  private readonly valores = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  protected readonly datos = computed(() => ({ ...ENCARGO_VACIO, ...this.valores() }) as DatosEncargo);

  protected readonly opcion = computed(() => opcionDe(this.datos().tipo));
  protected readonly zonas = computed(() => zonasDeEntrega(this.tarifas()));
  protected readonly extras = computed(() => this.tarifas().filter((t) => t.unidadPrecio === 'extra'));
  protected readonly faltan = computed(() => camposFaltantes(this.datos()));
  /** Solo se muestran los errores después del primer intento de enviar. */
  protected readonly intentado = signal(false);

  protected readonly mensaje = computed(() =>
    armarMensajeEncargo(this.datos(), this.tarifas().find((t) => String(t.id) === this.datos().zona)),
  );

  protected enviar(): void {
    this.intentado.set(true);
    if (this.faltan().length) return;
    const url = enlaceWhatsapp(this.negocio().whatsapp, this.mensaje());
    window.open(url, '_blank', 'noopener');
  }

  protected falta(campo: string): boolean {
    return this.intentado() && this.faltan().includes(campo);
  }
}
