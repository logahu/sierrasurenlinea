import { Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Meta } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { mensajeDeError } from '../admin/autorizacion';
import { FormularioAnuncio } from './formulario-anuncio';
import { Gestion, Publicacion } from './tianguis.model';
import { TianguisService } from './tianguis.service';
import { ESTADOS, textoPrecio } from './tianguis';

/** Explicación de cada estado para el vendedor. */
export function explicacion(g: Gestion): string {
  switch (g.estado) {
    case 'PENDIENTE': return 'Lo estamos revisando. Cuando lo aprobemos aparecerá en el tianguis.';
    case 'PUBLICADO': return 'Está publicado: los interesados lo ven y te escriben por WhatsApp.';
    case 'PAUSADO':
      if (g.pausadoPor === 'REPORTES') return 'Lo pausamos porque varias personas lo reportaron. Lo estamos revisando.';
      if (g.pausadoPor === 'BLOQUEO') return 'Está pausado porque tu WhatsApp no puede publicar en el tianguis.';
      if (g.pausadoPor === 'ADMIN') return 'Lo pausó el equipo del tianguis.';
      return 'Lo pausaste: no se ve en el tianguis hasta que lo reanudes.';
    case 'VENDIDO': return '¡Felicidades por tu venta! Se muestra como vendido unos días y luego desaparece.';
    case 'VENCIDO': return 'Pasaron 30 días y dejó de mostrarse. Renuévalo para que vuelva a aparecer.';
    case 'RECHAZADO': return 'No lo pudimos publicar. Revisa el motivo, corrígelo y envíalo otra vez.';
  }
}

/** /tianguis/mi-anuncio/:token: el vendedor ve el estado y gestiona su anuncio sin cuenta. */
@Component({
  selector: 'app-mi-anuncio-page',
  imports: [RouterLink, FormularioAnuncio],
  templateUrl: './mi-anuncio-page.html',
  styleUrls: ['./tianguis.scss', './mi-anuncio-page.scss'],
})
export class MiAnuncioPage {
  private readonly api = inject(TianguisService);
  readonly token = input.required<string>();

  readonly gestion = rxResource({ params: () => this.token(), stream: ({ params }) => this.api.gestion(params) });
  readonly categorias = rxResource({ stream: () => this.api.categorias() });
  protected readonly g = computed(() => (this.gestion.hasValue() ? this.gestion.value() : null));
  protected readonly estados = ESTADOS;
  protected readonly explicacion = computed(() => (this.g() ? explicacion(this.g()!) : ''));
  protected readonly precio = computed(() => (this.g() ? textoPrecio(this.g()!.precio, this.g()!.tipoPrecio) : ''));
  protected readonly editando = signal(false);
  protected readonly ocupado = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly aviso = signal<string | null>(null);
  protected readonly subirFoto = (f: File) => this.api.subirFoto(f);

  /** Para el formulario de corrección. */
  protected readonly inicial = computed<Publicacion | null>(() => {
    const g = this.g();
    return g ? {
      categoria: g.categoria.slug, titulo: g.titulo, descripcion: g.descripcion, precio: g.precio ?? NaN, tipoPrecio: g.tipoPrecio, negociable: g.negociable,
      condicion: g.condicion, atributos: g.atributos, ubicacion: g.ubicacion, fotos: g.fotos, vendedorNombre: g.vendedorNombre,
      vendedorWhatsapp: g.vendedorWhatsapp.slice(-10), aceptaReglas: false, sitioWeb: '',
    } : null;
  });

  constructor() {
    // Página privada: que no la indexen los buscadores.
    const meta = inject(Meta);
    meta.updateTag({ name: 'robots', content: 'noindex, nofollow' });
    inject(DestroyRef).onDestroy(() => meta.removeTag('name="robots"'));
  }

  protected fecha(f: string | null): string {
    return f ? new Date(f).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  }

  protected hacer(accion: 'vendido' | 'pausar' | 'reanudar' | 'renovar', mensaje: string): void {
    this.ocupado.set(true);
    this.error.set(null);
    this.aviso.set(null);
    this.api.accion(this.token(), accion).subscribe({
      next: (g) => {
        this.ocupado.set(false);
        this.gestion.set(g);
        this.aviso.set(mensaje);
      },
      error: (e) => {
        this.ocupado.set(false);
        this.error.set(mensajeDeError(e));
      },
    });
  }

  protected guardar(p: Publicacion): void {
    this.ocupado.set(true);
    this.error.set(null);
    this.api.editar(this.token(), p).subscribe({
      next: (g) => {
        this.ocupado.set(false);
        this.editando.set(false);
        this.gestion.set(g);
        this.aviso.set('Guardado. Tu anuncio volvió a revisión.');
      },
      error: (e) => {
        this.ocupado.set(false);
        this.error.set(mensajeDeError(e));
      },
    });
  }
}
