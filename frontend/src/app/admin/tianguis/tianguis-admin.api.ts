import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CampoAtributo, CategoriaCorta, CategoriaTianguis, Condicion, EstadoAnuncio, Pagina } from '../../tianguis/tianguis.model';

export interface VendedorAdmin {
  id: number;
  nombre: string;
  whatsapp: string;
  verificado: boolean;
  bloqueado: boolean;
  fechaRegistro: string;
  notasInternas: string | null;
  activos: number;
  total: number;
}

export interface AnuncioAdmin {
  id: number;
  idSlug: string;
  titulo: string;
  descripcion: string;
  precio: number;
  negociable: boolean;
  condicion: Condicion;
  estado: EstadoAnuncio;
  modalidad: 'CLASIFICADO' | 'CONSIGNACION' | 'PROPIO';
  fotos: string[];
  categoria: CategoriaCorta;
  atributos: Record<string, string>;
  ubicacion: string;
  destacado: boolean;
  motivoRechazo: string | null;
  pausadoPor: string | null;
  renovaciones: number;
  vendedor: VendedorAdmin;
  fechaCreacion: string;
  actualizado: string;
  fechaPublicacion: string | null;
  fechaVencimiento: string | null;
  fechaVendido: string | null;
  vistas: number;
  reportesSinAtender: number;
  /** Lo envió el público (tiene enlace de gestión). */
  delPublico: boolean;
}

export interface AnuncioEdicion {
  categoria: string;
  titulo: string;
  descripcion: string;
  precio: number;
  negociable: boolean;
  condicion: Condicion;
  modalidad: string;
  atributos: Record<string, string>;
  ubicacion: string;
  fotos: string[];
  destacado: boolean;
  vendedorId: number | null;
  vendedorNombre: string | null;
  vendedorWhatsapp: string | null;
  publicar: boolean;
}

export interface ReporteAdmin {
  id: number;
  anuncioId: number;
  anuncioTitulo: string;
  anuncioEstado: EstadoAnuncio;
  motivo: string;
  motivoTexto: string;
  comentario: string | null;
  fecha: string;
  atendido: boolean;
}

export interface CategoriaEdicion {
  nombre: string;
  slug: string;
  icono: string | null;
  orden: number;
  activa: boolean;
  campos: CampoAtributo[];
}

/** Panel del tianguis. Lleva el contador de pendientes y reportes del menú. */
@Injectable({ providedIn: 'root' })
export class TianguisAdminApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/admin/tianguis`;

  /** Pendientes + reportes sin atender (el número del menú). */
  readonly porAtender = signal(0);
  readonly pendientes = signal(0);
  readonly reportes = signal(0);

  actualizarResumen(): void {
    this.http.get<{ pendientes: number; reportes: number }>(`${this.base}/resumen`).subscribe({
      next: (r) => {
        this.pendientes.set(r.pendientes);
        this.reportes.set(r.reportes);
        this.porAtender.set(r.pendientes + r.reportes);
      },
      error: () => undefined,
    });
  }

  anuncios(f: { estado?: string | null; categoria?: string | null; q?: string | null; vendedor?: number | null; page?: number }): Observable<Pagina<AnuncioAdmin>> {
    let p = new HttpParams().set('page', f.page ?? 0);
    if (f.estado) p = p.set('estado', f.estado);
    if (f.categoria) p = p.set('categoria', f.categoria);
    if (f.q?.trim()) p = p.set('q', f.q.trim());
    if (f.vendedor) p = p.set('vendedor', f.vendedor);
    return this.http.get<Pagina<AnuncioAdmin>>(`${this.base}/anuncios`, { params: p });
  }

  anuncio(id: number): Observable<AnuncioAdmin> {
    return this.http.get<AnuncioAdmin>(`${this.base}/anuncios/${id}`);
  }

  crear(e: AnuncioEdicion): Observable<AnuncioAdmin> {
    return this.http.post<AnuncioAdmin>(`${this.base}/anuncios`, e).pipe(tap(() => this.actualizarResumen()));
  }

  editar(id: number, e: AnuncioEdicion): Observable<AnuncioAdmin> {
    return this.http.put<AnuncioAdmin>(`${this.base}/anuncios/${id}`, e);
  }

  estado(id: number, estado: EstadoAnuncio, motivo?: string | null): Observable<AnuncioAdmin> {
    return this.http.patch<AnuncioAdmin>(`${this.base}/anuncios/${id}/estado`, { estado, motivo: motivo ?? null })
      .pipe(tap(() => this.actualizarResumen()));
  }

  borrar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/anuncios/${id}`).pipe(tap(() => this.actualizarResumen()));
  }

  atenderReportes(id: number): Observable<AnuncioAdmin> {
    return this.http.put<AnuncioAdmin>(`${this.base}/anuncios/${id}/reportes/atendidos`, {}).pipe(tap(() => this.actualizarResumen()));
  }

  reportesSinAtender(): Observable<ReporteAdmin[]> {
    return this.http.get<ReporteAdmin[]>(`${this.base}/reportes`);
  }

  categorias(): Observable<CategoriaTianguis[]> {
    return this.http.get<CategoriaTianguis[]>(`${this.base}/categorias`);
  }

  crearCategoria(c: CategoriaEdicion): Observable<CategoriaTianguis> {
    return this.http.post<CategoriaTianguis>(`${this.base}/categorias`, c);
  }

  editarCategoria(id: number, c: CategoriaEdicion): Observable<CategoriaTianguis> {
    return this.http.put<CategoriaTianguis>(`${this.base}/categorias/${id}`, c);
  }

  vendedores(q: string): Observable<VendedorAdmin[]> {
    return this.http.get<VendedorAdmin[]>(`${this.base}/vendedores`, { params: q.trim() ? { q: q.trim() } : {} });
  }

  crearVendedor(v: { nombre: string; whatsapp: string; notasInternas: string | null }): Observable<VendedorAdmin> {
    return this.http.post<VendedorAdmin>(`${this.base}/vendedores`, v);
  }

  editarVendedor(id: number, v: { nombre: string; whatsapp: string; notasInternas: string | null }): Observable<VendedorAdmin> {
    return this.http.put<VendedorAdmin>(`${this.base}/vendedores/${id}`, v);
  }

  verificar(id: number, valor: boolean): Observable<VendedorAdmin> {
    return this.http.put<VendedorAdmin>(`${this.base}/vendedores/${id}/verificado`, { valor });
  }

  bloquear(id: number, valor: boolean): Observable<VendedorAdmin> {
    return this.http.put<VendedorAdmin>(`${this.base}/vendedores/${id}/bloqueado`, { valor }).pipe(tap(() => this.actualizarResumen()));
  }
}

/** Motivos frecuentes de rechazo (más texto libre). */
export const MOTIVOS_RECHAZO = [
  'Las fotos no son del artículo o no se ve bien',
  'Artículo prohibido por las reglas',
  'Precio irreal o sin precio',
  'Más de un artículo en el anuncio',
  'Es un servicio, no un artículo',
  'Información incompleta o confusa',
];
