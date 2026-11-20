import { Component, computed, effect, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconoGiro } from '../catalogo/icono-giro';
import { FotosAnuncio } from './fotos-anuncio';
import { CampoAtributo, CategoriaTianguis, Condicion, Publicacion, TipoPrecio } from './tianguis.model';
import { CONDICIONES, TIPOS_PRECIO, whatsappValido } from './tianguis';

export const PASOS = ['Categoría', 'Datos', 'Fotos', 'Tus datos', 'Reglas'] as const;

/** Qué falta en cada paso (vacío = se puede seguir). En servicios la foto es opcional y el precio puede ser «a cotizar». */
export function faltantes(paso: number, p: Publicacion, campos: CampoAtributo[], servicio = false): string[] {
  const f: string[] = [];
  if (paso === 0 && !p.categoria) f.push('la categoría');
  if (paso === 1) {
    if (!p.titulo.trim()) f.push('el título');
    if (!p.descripcion.trim()) f.push('la descripción');
    if (p.tipoPrecio !== 'COTIZAR' && !((p.precio ?? NaN) >= 0)) f.push('el precio');
    if (!p.ubicacion.trim()) f.push('la localidad o colonia');
    for (const c of campos) if (c.requerido && !(p.atributos[c.nombre] ?? '').trim()) f.push(c.etiqueta.toLowerCase());
  }
  if (paso === 2 && !servicio && !p.fotos.length) f.push('al menos una foto');
  if (paso === 3) {
    if (!p.vendedorNombre.trim()) f.push('tu nombre');
    if (!whatsappValido(p.vendedorWhatsapp)) f.push('tu WhatsApp (10 dígitos)');
  }
  if (paso === 4 && !p.aceptaReglas) f.push('aceptar las reglas');
  return f;
}

export function publicacionVacia(): Publicacion {
  return {
    categoria: '', titulo: '', descripcion: '', precio: NaN, tipoPrecio: 'FIJO', negociable: false, condicion: 'USADO', atributos: {},
    ubicacion: '', fotos: [], vendedorNombre: '', vendedorWhatsapp: '', aceptaReglas: false, sitioWeb: '',
  };
}

/** Formulario por pasos para publicar (o corregir) un anuncio sin cuenta. */
@Component({
  selector: 'app-formulario-anuncio',
  imports: [RouterLink, IconoGiro, FotosAnuncio],
  templateUrl: './formulario-anuncio.html',
  styleUrls: ['./tianguis.scss', './formulario-anuncio.scss'],
  host: { style: 'padding: 0' },
})
export class FormularioAnuncio {
  readonly categorias = input.required<CategoriaTianguis[]>();
  readonly inicial = input<Publicacion | null>(null);
  /** Al editar no se cambia el WhatsApp (identifica al vendedor). */
  readonly editando = input(false);
  readonly ocupado = input(false);
  readonly error = input<string | null>(null);
  readonly subirFoto = input.required<(archivo: File) => Promise<string>>();
  readonly enviar = output<Publicacion>();

  protected readonly pasos = PASOS;
  protected readonly isNaN = Number.isNaN;
  protected readonly NaN = Number.NaN;
  protected readonly condiciones = CONDICIONES;
  protected readonly tiposPrecio = TIPOS_PRECIO;
  protected readonly paso = signal(0);
  protected readonly datos = signal<Publicacion>(publicacionVacia());
  protected readonly intento = signal(false);

  protected readonly categoria = computed(() => this.categorias().find((c) => c.slug === this.datos().categoria) ?? null);
  protected readonly campos = computed(() => this.categoria()?.campos ?? []);
  protected readonly servicio = computed(() => this.categoria()?.tipo === 'SERVICIO');
  protected readonly deArticulos = computed(() => this.categorias().filter((c) => c.tipo !== 'SERVICIO'));
  protected readonly deServicios = computed(() => this.categorias().filter((c) => c.tipo === 'SERVICIO'));
  protected readonly falta = computed(() => faltantes(this.paso(), this.datos(), this.campos(), this.servicio()));

  constructor() {
    effect(() => {
      const i = this.inicial();
      if (i) this.datos.set({ ...publicacionVacia(), ...i, aceptaReglas: false, sitioWeb: '' });
    });
  }

  protected poner<K extends keyof Publicacion>(campo: K, valor: Publicacion[K]): void {
    this.datos.update((d) => ({ ...d, [campo]: valor }));
  }

  protected ponerAtributo(nombre: string, valor: string): void {
    this.datos.update((d) => ({ ...d, atributos: { ...d.atributos, [nombre]: valor } }));
  }

  protected elegirCategoria(slug: string): void {
    // Los atributos son propios de cada categoría; los servicios no llevan condición y los artículos llevan precio fijo.
    const servicio = this.categorias().find((c) => c.slug === slug)?.tipo === 'SERVICIO';
    this.datos.update((d) =>
      d.categoria === slug
        ? d
        : {
            ...d,
            categoria: slug,
            atributos: {},
            condicion: servicio ? null : (d.condicion ?? 'USADO'),
            tipoPrecio: servicio ? d.tipoPrecio : 'FIJO',
          },
    );
    this.intento.set(false);
    this.paso.set(1);
    this.alInicio();
  }

  protected siguiente(): void {
    this.intento.set(true);
    if (this.falta().length) return;
    this.intento.set(false);
    if (this.paso() < this.pasos.length - 1) {
      this.paso.update((p) => p + 1);
      this.alInicio();
    } else {
      const d = this.datos();
      const cotizar = d.tipoPrecio === 'COTIZAR';
      this.enviar.emit({
        ...d,
        precio: cotizar ? null : Number(d.precio),
        negociable: !cotizar && d.negociable,
        condicion: this.servicio() ? null : d.condicion,
        titulo: d.titulo.trim(),
        descripcion: d.descripcion.trim(),
      });
    }
  }

  protected atras(): void {
    this.intento.set(false);
    this.paso.update((p) => Math.max(0, p - 1));
    this.alInicio();
  }

  protected ir(i: number): void {
    if (i < this.paso()) {
      this.paso.set(i);
      this.alInicio();
    }
  }

  protected condicion(valor: string): Condicion {
    return valor as Condicion;
  }

  protected tipoPrecio(valor: string): TipoPrecio {
    return valor as TipoPrecio;
  }

  private alInicio(): void {
    queueMicrotask(() => document.getElementById('paso-actual')?.focus());
  }
}
