import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { TipoEncargo } from '../catalogo/catalogo.model';
import {
  CategoriaAdmin, CategoriaEdicion, NegocioAdmin, NegocioEdicion, ProductoAdmin, ProductoEdicion, Usuario,
} from './admin.model';

/** Endpoints del panel (/api/admin/...). El token lo agrega autorizacionInterceptor. */
@Injectable({ providedIn: 'root' })
export class AdminApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/admin`;

  negocios(): Observable<NegocioAdmin[]> {
    return this.http.get<NegocioAdmin[]>(`${this.base}/negocios`);
  }

  negocio(slug: string): Observable<NegocioAdmin> {
    return this.http.get<NegocioAdmin>(`${this.base}/negocios/${encodeURIComponent(slug)}`);
  }

  guardarNegocio(slug: string, datos: NegocioEdicion): Observable<NegocioAdmin> {
    return this.http.put<NegocioAdmin>(`${this.base}/negocios/${encodeURIComponent(slug)}`, datos);
  }

  cambiarVisible(slug: string, visible: boolean): Observable<NegocioAdmin> {
    return this.http.put<NegocioAdmin>(`${this.base}/negocios/${encodeURIComponent(slug)}/visible`, { visible });
  }

  usuarios(): Observable<Usuario[]> {
    return this.http.get<Usuario[]>(`${this.base}/usuarios`);
  }

  crearEncargado(datos: { nombre: string; correo: string; contrasena: string; negocioSlug: string }): Observable<Usuario> {
    return this.http.post<Usuario>(`${this.base}/usuarios`, datos);
  }

  editarUsuario(id: number, datos: { nombre: string; negocioSlug?: string | null; activo?: boolean }): Observable<Usuario> {
    return this.http.put<Usuario>(`${this.base}/usuarios/${id}`, datos);
  }

  reiniciarContrasena(id: number, nueva: string): Observable<void> {
    return this.http.put<void>(`${this.base}/usuarios/${id}/contrasena`, { nueva });
  }

  // ---- Catálogo de un negocio

  categorias(slug: string): Observable<CategoriaAdmin[]> {
    return this.http.get<CategoriaAdmin[]>(`${this.de(slug)}/categorias`);
  }

  crearCategoria(slug: string, datos: CategoriaEdicion): Observable<CategoriaAdmin> {
    return this.http.post<CategoriaAdmin>(`${this.de(slug)}/categorias`, datos);
  }

  editarCategoria(slug: string, id: number, datos: CategoriaEdicion): Observable<CategoriaAdmin> {
    return this.http.put<CategoriaAdmin>(`${this.de(slug)}/categorias/${id}`, datos);
  }

  productos(slug: string): Observable<ProductoAdmin[]> {
    return this.http.get<ProductoAdmin[]>(`${this.de(slug)}/productos`);
  }

  producto(slug: string, id: number): Observable<ProductoAdmin> {
    return this.http.get<ProductoAdmin>(`${this.de(slug)}/productos/${id}`);
  }

  crearProducto(slug: string, datos: ProductoEdicion): Observable<ProductoAdmin> {
    return this.http.post<ProductoAdmin>(`${this.de(slug)}/productos`, datos);
  }

  editarProducto(slug: string, id: number, datos: ProductoEdicion): Observable<ProductoAdmin> {
    return this.http.put<ProductoAdmin>(`${this.de(slug)}/productos/${id}`, datos);
  }

  cambiarDisponible(slug: string, id: number, disponible: boolean): Observable<ProductoAdmin> {
    return this.http.put<ProductoAdmin>(`${this.de(slug)}/productos/${id}/disponible`, { disponible });
  }

  // ---- Lista del mandado (Encarguitos)

  tiposEncargo(slug: string): Observable<TipoEncargo[]> {
    return this.http.get<TipoEncargo[]>(`${this.de(slug)}/tipos-encargo`);
  }

  crearTipoEncargo(slug: string, datos: Omit<TipoEncargo, 'id'>): Observable<TipoEncargo> {
    return this.http.post<TipoEncargo>(`${this.de(slug)}/tipos-encargo`, datos);
  }

  editarTipoEncargo(slug: string, id: number | string, datos: Omit<TipoEncargo, 'id'>): Observable<TipoEncargo> {
    return this.http.put<TipoEncargo>(`${this.de(slug)}/tipos-encargo/${id}`, datos);
  }

  private de(slug: string): string {
    return `${this.base}/negocios/${encodeURIComponent(slug)}`;
  }
}
