import { DOCUMENT } from '@angular/common';
import { Component, computed, effect, inject, input, signal, viewChild, ElementRef } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { of } from 'rxjs';
import { mensajeDeError } from '../admin/autorizacion';
import { usarSeo } from './seo';
import { MotivoReporte } from './tianguis.model';
import { TianguisService } from './tianguis.service';
import {
  MOTIVOS_REPORTE, NOMBRE_TIANGUIS, enlaceWhatsapp, valorAtributo, haceCuanto, idDe, mensajeContacto, precioMxn, textoCondicion,
} from './tianguis';

/** Ficha /tianguis/:idSlug: galería, precio, condición, atributos, contacto por WhatsApp, seguridad y reportes. */
@Component({
  selector: 'app-anuncio-page',
  imports: [RouterLink],
  templateUrl: './anuncio-page.html',
  styleUrls: ['./tianguis.scss', './anuncio-page.scss'],
})
export class AnuncioPage {
  private readonly api = inject(TianguisService);
  private readonly router = inject(Router);
  private readonly doc = inject(DOCUMENT);

  readonly idSlug = input<string>();

  readonly anuncio = rxResource({
    params: () => idDe(this.idSlug()),
    stream: ({ params }) => (params === null ? of(null) : this.api.anuncio(params)),
  });
  protected readonly a = computed(() => (this.anuncio.hasValue() ? this.anuncio.value() : null));

  protected readonly precio = computed(() => (this.a() ? precioMxn(this.a()!.precio) : ''));
  protected readonly condicion = computed(() => (this.a() ? textoCondicion(this.a()!.condicion) : ''));
  protected readonly hace = computed(() => haceCuanto(this.a()?.fechaPublicacion));
  protected readonly url = computed(() => `${this.doc.location?.origin ?? 'https://sierrasurenlinea.com.mx'}/tianguis/${this.a()?.idSlug ?? ''}`);
  protected readonly whatsapp = computed(() => {
    const a = this.a();
    return a ? enlaceWhatsapp(a.vendedor.whatsapp, mensajeContacto(a.titulo, this.url())) : '';
  });

  protected readonly valor = valorAtributo;

  // Galería
  private readonly carrusel = viewChild<ElementRef<HTMLElement>>('carrusel');
  protected readonly actual = signal(0);

  // Reporte
  protected readonly motivos = MOTIVOS_REPORTE;
  protected readonly motivo = signal<MotivoReporte | null>(null);
  protected readonly comentario = signal('');
  protected readonly enviandoReporte = signal(false);
  protected readonly reporteEnviado = signal(false);
  protected readonly errorReporte = signal<string | null>(null);

  constructor() {
    const seo = usarSeo();
    effect(() => {
      const a = this.a();
      if (!a) return;
      // La URL con el título correcto (por si cambió o llegó solo con el número).
      if (this.idSlug() !== a.idSlug) void this.router.navigate(['/tianguis', a.idSlug], { replaceUrl: true });
      seo({
        titulo: `${a.titulo} · ${precioMxn(a.precio)} · ${NOMBRE_TIANGUIS}`,
        descripcion: `${a.titulo} de segunda mano en ${a.ubicacion}, Sierra Sur. ${textoCondicion(a.condicion)}, ${precioMxn(a.precio)}${a.negociable ? ' negociable' : ''}. Contacta al vendedor por WhatsApp.`,
        ruta: `/tianguis/${a.idSlug}`,
        imagen: a.fotos[0] ?? null,
      });
    });
  }

  protected alDesplazar(): void {
    const el = this.carrusel()?.nativeElement;
    if (el) this.actual.set(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
  }

  protected irA(i: number): void {
    const el = this.carrusel()?.nativeElement;
    const total = this.a()?.fotos.length ?? 0;
    if (!el || !total) return;
    const n = (i + total) % total;
    el.scrollTo({ left: n * el.clientWidth, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    this.actual.set(n);
  }

  protected reportar(): void {
    const a = this.a();
    const m = this.motivo();
    if (!a || !m) {
      this.errorReporte.set('Elige el motivo.');
      return;
    }
    this.enviandoReporte.set(true);
    this.errorReporte.set(null);
    this.api.reportar(a.id, m, this.comentario()).subscribe({
      next: () => {
        this.enviandoReporte.set(false);
        this.reporteEnviado.set(true);
      },
      error: (e) => {
        this.enviandoReporte.set(false);
        this.errorReporte.set(mensajeDeError(e));
      },
    });
  }
}
