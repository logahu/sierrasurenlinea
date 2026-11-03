import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Categoria, Producto } from './catalogo.model';
import { environment } from '../../environments/environment';

/**
 * Acceso a la API del catálogo. La URL base viene de environment:
 * en desarrollo es /api (proxy a Quarkus :8080) y en producción la URL
 * pública del backend en Render.
 */
@Injectable({ providedIn: 'root' })
export class CatalogoService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  categorias(): Observable<Categoria[]> {
    return this.http.get<Categoria[]>(`${this.base}/categorias`);
  }

  productos(categoria?: string | null): Observable<Producto[]> {
    let params = new HttpParams();
    if (categoria) {
      params = params.set('categoria', categoria);
    }
    return this.http.get<Producto[]>(`${this.base}/productos`, { params });
  }

  producto(id: number): Observable<Producto> {
    return this.http.get<Producto>(`${this.base}/productos/${id}`);
  }
}
