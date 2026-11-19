import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { prepararFotoGrande } from '../admin/fotos';
import {
  AnuncioDetalle, AnuncioResumen, CategoriaTianguis, Gestion, MotivoReporte, Pagina, Publicacion, Publicado,
} from './tianguis.model';
import { FiltrosTianguis } from './tianguis';

/** API pública del tianguis (catálogo, publicar sin cuenta, enlace de gestión y reportes). */
@Injectable({ providedIn: 'root' })
export class TianguisService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/tianguis`;

  categorias(): Observable<CategoriaTianguis[]> {
    return this.http.get<CategoriaTianguis[]>(`${this.base}/categorias`);
  }

  anuncios(categoria: string | null, f: FiltrosTianguis, pagina: number, tamano = 24): Observable<Pagina<AnuncioResumen>> {
    let p = new HttpParams().set('orden', f.orden).set('page', pagina).set('size', tamano);
    if (categoria) p = p.set('categoria', categoria);
    if (f.q.trim()) p = p.set('q', f.q.trim());
    if (f.condicion) p = p.set('condicion', f.condicion);
    if (f.precioMin !== null) p = p.set('precioMin', f.precioMin);
    if (f.precioMax !== null) p = p.set('precioMax', f.precioMax);
    return this.http.get<Pagina<AnuncioResumen>>(`${this.base}/anuncios`, { params: p });
  }

  anuncio(id: number): Observable<AnuncioDetalle> {
    return this.http.get<AnuncioDetalle>(`${this.base}/anuncios/${id}`);
  }

  publicar(p: Publicacion): Observable<Publicado> {
    return this.http.post<Publicado>(`${this.base}/anuncios`, p);
  }

  gestion(token: string): Observable<Gestion> {
    return this.http.get<Gestion>(`${this.base}/gestion/${encodeURIComponent(token)}`);
  }

  editar(token: string, p: Publicacion): Observable<Gestion> {
    return this.http.put<Gestion>(`${this.base}/gestion/${encodeURIComponent(token)}`, p);
  }

  accion(token: string, accion: 'vendido' | 'pausar' | 'reanudar' | 'renovar'): Observable<Gestion> {
    return this.http.post<Gestion>(`${this.base}/gestion/${encodeURIComponent(token)}/${accion}`, {});
  }

  reportar(id: number, motivo: MotivoReporte, comentario: string): Observable<void> {
    return this.http.post<void>(`${this.base}/anuncios/${id}/reportes`, { motivo, comentario: comentario.trim() || null });
  }

  /** Sube una foto sin cuenta: se reduce a 1600 px, se pide permiso y va directo a R2. */
  async subirFoto(archivo: File): Promise<string> {
    if (!archivo.type.startsWith('image/')) throw new Error('Elige una imagen (foto JPG, PNG, HEIC…).');
    const foto = await prepararFotoGrande(archivo);
    const permiso = await firstValueFrom(
      this.http.post<{ subirUrl: string; url: string }>(`${this.base}/fotos`, { tipo: foto.type, bytes: foto.size }),
    );
    let r: Response;
    try {
      r = await fetch(permiso.subirUrl, { method: 'PUT', body: foto, headers: { 'Content-Type': foto.type } });
    } catch {
      throw new Error('No se pudo subir la foto. Revisa tu conexión e inténtalo de nuevo.');
    }
    if (!r.ok) throw new Error(`No se pudo guardar la foto (${r.status}). Inténtalo de nuevo.`);
    return permiso.url;
  }
}
