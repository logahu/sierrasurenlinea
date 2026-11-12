import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, computed, inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable, combineLatest, distinctUntilChanged, map, shareReplay, switchMap } from 'rxjs';
import { ClienteSesionService } from '../cuenta/cliente-sesion';
import { visiblesAqui } from '../modo-app';
import { Negocio, Producto, Restaurante } from './catalogo.model';
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

  /** Los probadores ven además los negocios en pruebas: la lista cambia si entra o sale uno. */
  private readonly sesionCliente = inject(ClienteSesionService);
  private readonly probador = computed(() => this.sesionCliente.cliente()?.probador ?? false);

  /** La lista de negocios se usa en el encabezado y la portada: se pide una vez por tipo de sesión. */
  private readonly negocios$ = toObservable(this.probador).pipe(
    distinctUntilChanged(),
    switchMap(() => this.http.get<Negocio[]>(`${this.base}/negocios`)),
    map((lista) => visiblesAqui(lista)), // en la app, sin los negocios "solo web"
    shareReplay({ bufferSize: 1, refCount: false }),
  );

  negocios(): Observable<Negocio[]> {
    return this.negocios$;
  }

  /** Productos marcados como favoritos en todos los negocios (para la portada). */
  destacados(): Observable<Producto[]> {
    return combineLatest([this.http.get<Producto[]>(`${this.base}/productos`), this.negocios$]).pipe(
      map(([lista, negocios]) => {
        const aqui = new Set(negocios.map((n) => n.slug));
        return lista.filter((p) => p.destacado && aqui.has(p.negocioSlug));
      }),
    );
  }

  negocio(slug: string): Observable<Negocio> {
    return this.http.get<Negocio>(`${this.base}/negocios/${encodeURIComponent(slug)}`);
  }

  productos(negocio: string, categoria?: string | null): Observable<Producto[]> {
    let params = new HttpParams();
    if (categoria) {
      params = params.set('categoria', categoria);
    }
    return this.http.get<Producto[]>(
      `${this.base}/negocios/${encodeURIComponent(negocio)}/productos`,
      { params },
    );
  }

  producto(id: number): Observable<Producto> {
    return this.http.get<Producto>(`${this.base}/productos/${id}`);
  }

  /** Encarguitos: lugares de comida con sus platillos disponibles. */
  restaurantes(negocio: string): Observable<Restaurante[]> {
    return this.http.get<Restaurante[]>(`${this.base}/negocios/${encodeURIComponent(negocio)}/restaurantes`);
  }
}
