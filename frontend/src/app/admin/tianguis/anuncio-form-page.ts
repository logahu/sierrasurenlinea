import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { of } from 'rxjs';
import { FotosAnuncio } from '../../tianguis/fotos-anuncio';
import { Condicion, TipoPrecio } from '../../tianguis/tianguis.model';
import { CONDICIONES, ESTADOS, TIPOS_PRECIO, precioMxn, whatsappValido } from '../../tianguis/tianguis';
import { mensajeDeError } from '../autorizacion';
import { FotosService } from '../fotos';
import { AnuncioEdicion, TianguisAdminApi } from './tianguis-admin.api';

function vacio(): AnuncioEdicion {
  return {
    categoria: '', titulo: '', descripcion: '', precio: NaN, tipoPrecio: 'FIJO', negociable: false, condicion: 'USADO', modalidad: 'CLASIFICADO',
    atributos: {}, ubicacion: '', fotos: [], destacado: false, vendedorId: null, vendedorNombre: null, vendedorWhatsapp: null, publicar: false,
  };
}

/** Qué falta para guardar (vacío = listo). En servicios la foto es opcional y el precio puede ser «a cotizar». */
export function faltanEnPanel(
  e: AnuncioEdicion, requeridos: { nombre: string; etiqueta: string }[], vendedorNuevo: boolean, servicio = false,
): string[] {
  const f: string[] = [];
  if (!e.categoria) f.push('la categoría');
  if (!e.titulo.trim()) f.push('el título');
  if (e.tipoPrecio !== 'COTIZAR' && !((e.precio ?? NaN) >= 0)) f.push('el precio');
  if (!e.descripcion.trim()) f.push('la descripción');
  if (!e.ubicacion.trim()) f.push('la localidad');
  if (!servicio && !e.fotos.length) f.push('al menos una foto');
  for (const c of requeridos) if (!(e.atributos[c.nombre] ?? '').trim()) f.push(c.etiqueta.toLowerCase());
  if (vendedorNuevo ? !(e.vendedorNombre ?? '').trim() || !whatsappValido(e.vendedorWhatsapp ?? '') : !e.vendedorId) f.push('el vendedor');
  return f;
}

/** /admin/tianguis/nuevo y /admin/tianguis/:id: alta y edición con atributos según la categoría y fotos de 1600 px. */
@Component({
  selector: 'app-anuncio-form-page',
  imports: [RouterLink, FotosAnuncio],
  templateUrl: './anuncio-form-page.html',
  styles: `
    .estado-actual { margin: .3rem 0 0; }
    .dos { display: grid; grid-template-columns: 1fr 1fr; gap: .8rem; @media (max-width: 34rem) { grid-template-columns: 1fr; } }
    fieldset { border: 1px solid var(--linea); border-radius: var(--panel-radio); padding: .8rem; display: grid; gap: .7rem; }
    legend { font-weight: 700; padding: 0 .3rem; }
    .resultados { list-style: none; margin: 0; padding: 0; display: grid; gap: .3rem; }
    .resultados button { width: 100%; text-align: left; padding: .5rem .7rem; border: 1px solid var(--linea); border-radius: .5rem; background: var(--superficie); color: var(--tinta); font: inherit; cursor: pointer; }
    .resultados button[aria-pressed='true'] { border: 2px solid var(--follaje); }
    .acciones { display: flex; flex-wrap: wrap; gap: .5rem; }
  `,
})
export class AnuncioFormPage {
  private readonly api = inject(TianguisAdminApi);
  private readonly fotos = inject(FotosService);
  private readonly router = inject(Router);

  /** «nuevo» o el id. */
  readonly id = input<string>();
  protected readonly numero = computed(() => (this.id() && this.id() !== 'nuevo' ? Number(this.id()) : null));

  readonly categorias = rxResource({ stream: () => this.api.categorias() });
  readonly actual = rxResource({
    params: () => this.numero(),
    stream: ({ params }) => (params ? this.api.anuncio(params) : of(null)),
  });

  protected readonly datos = signal<AnuncioEdicion>(vacio());
  protected readonly vendedorNuevo = signal(false);
  protected readonly buscarVendedor = signal('');
  readonly vendedores = rxResource({ params: () => this.buscarVendedor(), stream: ({ params }) => this.api.vendedores(params) });

  protected readonly condiciones = CONDICIONES;
  protected readonly tiposPrecio = TIPOS_PRECIO;
  protected readonly estados = ESTADOS;
  protected readonly isNaN = Number.isNaN;
  protected readonly NaN = Number.NaN;
  protected readonly precio = precioMxn;
  protected readonly subir = (f: File) => this.fotos.subir('tianguis', f, true);

  /** El vendedor actual, si no salió en la búsqueda (para no perderlo de vista). */
  protected readonly vendedorFuera = computed(() => {
    const a = this.actual.hasValue() ? this.actual.value() : null;
    return !!a && !(this.vendedores.value() ?? []).some((v) => v.id === a.vendedor.id);
  });
  protected readonly categoria = computed(() => (this.categorias.value() ?? []).find((c) => c.slug === this.datos().categoria) ?? null);
  protected readonly servicio = computed(() => this.categoria()?.tipo === 'SERVICIO');
  protected readonly falta = computed(() =>
    faltanEnPanel(this.datos(), (this.categoria()?.campos ?? []).filter((c) => c.requerido), this.vendedorNuevo(), this.servicio()),
  );
  protected readonly intento = signal(false);
  protected readonly ocupado = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly mensaje = signal<string | null>(null);

  constructor() {
    effect(() => {
      const a = this.actual.hasValue() ? this.actual.value() : null;
      if (!a) return;
      this.datos.set({
        categoria: a.categoria.slug, titulo: a.titulo, descripcion: a.descripcion, precio: a.precio ?? NaN, tipoPrecio: a.tipoPrecio,
        negociable: a.negociable,
        condicion: a.condicion, modalidad: a.modalidad, atributos: { ...a.atributos }, ubicacion: a.ubicacion, fotos: [...a.fotos],
        destacado: a.destacado, vendedorId: a.vendedor.id, vendedorNombre: null, vendedorWhatsapp: null, publicar: false,
      });
    });
  }

  protected poner<K extends keyof AnuncioEdicion>(k: K, v: AnuncioEdicion[K]): void {
    this.datos.update((d) => ({ ...d, [k]: v }));
  }

  protected ponerAtributo(nombre: string, valor: string): void {
    this.datos.update((d) => ({ ...d, atributos: { ...d.atributos, [nombre]: valor } }));
  }

  protected elegirCategoria(slug: string): void {
    const servicio = (this.categorias.value() ?? []).find((c) => c.slug === slug)?.tipo === 'SERVICIO';
    this.datos.update((d) => ({
      ...d,
      categoria: slug,
      atributos: d.categoria === slug ? d.atributos : {},
      condicion: servicio ? null : (d.condicion ?? 'USADO'),
      tipoPrecio: servicio ? d.tipoPrecio : 'FIJO',
    }));
  }

  protected tipoPrecio(v: string): TipoPrecio {
    return v as TipoPrecio;
  }

  protected condicion(v: string): Condicion {
    return v as Condicion;
  }

  protected guardar(publicar: boolean): void {
    this.intento.set(true);
    if (this.falta().length) return;
    const d = this.datos();
    const e: AnuncioEdicion = {
      ...d, publicar,
      precio: d.tipoPrecio === 'COTIZAR' ? null : Number(d.precio),
      negociable: d.tipoPrecio !== 'COTIZAR' && d.negociable,
      condicion: this.servicio() ? null : d.condicion,
      vendedorId: this.vendedorNuevo() ? null : d.vendedorId,
      vendedorNombre: this.vendedorNuevo() ? d.vendedorNombre : null,
      vendedorWhatsapp: this.vendedorNuevo() ? d.vendedorWhatsapp : null,
    };
    const id = this.numero();
    this.ocupado.set(true);
    this.error.set(null);
    (id ? this.api.editar(id, e) : this.api.crear(e)).subscribe({
      next: (a) => {
        this.ocupado.set(false);
        if (id) {
          this.actual.set(a);
          this.mensaje.set('Cambios guardados.');
        } else {
          void this.router.navigate(['/admin/tianguis'], { queryParams: { ver: a.estado === 'PENDIENTE' ? null : 'anuncios' } });
        }
      },
      error: (err) => {
        this.ocupado.set(false);
        this.error.set(mensajeDeError(err));
      },
    });
  }
}
