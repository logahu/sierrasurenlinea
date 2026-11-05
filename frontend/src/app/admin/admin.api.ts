import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { NegocioAdmin, NegocioEdicion, Usuario } from './admin.model';

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
}
