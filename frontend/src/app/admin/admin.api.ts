import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Platillo, Restaurante, TipoEncargo } from '../catalogo/catalogo.model';
import {
  CategoriaAdmin, CategoriaEdicion, ClienteAdmin, FotosNegocio, PaginaHistorial, Tablero, NegocioAdmin, NegocioEdicion, ProductoAdmin, ProductoEdicion, Usuario,
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

  cambiarEstado(slug: string, estado: 'PUBLICO' | 'PRUEBAS' | 'OCULTO'): Observable<NegocioAdmin> {
    return this.http.put<NegocioAdmin>(`${this.base}/negocios/${encodeURIComponent(slug)}/estado`, { estado });
  }

  cambiarProbador(id: number, probador: boolean): Observable<ClienteAdmin> {
    return this.http.put<ClienteAdmin>(`${this.base}/clientes/${id}/probador`, { probador });
  }

  cambiarVisible(slug: string, visible: boolean): Observable<NegocioAdmin> {
    return this.http.put<NegocioAdmin>(`${this.base}/negocios/${encodeURIComponent(slug)}/visible`, { visible });
  }

  cambiarVisibleApp(slug: string, visible: boolean): Observable<NegocioAdmin> {
    return this.http.put<NegocioAdmin>(`${this.base}/negocios/${encodeURIComponent(slug)}/visible-app`, { visible });
  }

  tablero(dias: number, negocio = ''): Observable<Tablero> {
    const params: Record<string, string> = { dias: String(dias) };
    if (negocio) params['negocio'] = negocio;
    return this.http.get<Tablero>(`${this.base}/tablero`, { params });
  }

  historial(filtro: { entidad?: string; negocio?: string; q?: string; pagina?: number }): Observable<PaginaHistorial> {
    const params: Record<string, string> = {};
    for (const [k, v] of Object.entries(filtro)) if (v !== undefined && v !== '') params[k] = String(v);
    return this.http.get<PaginaHistorial>(`${this.base}/historial`, { params });
  }

  fotos(slug: string): Observable<FotosNegocio> {
    return this.http.get<FotosNegocio>(`${this.base}/negocios/${encodeURIComponent(slug)}/fotos`);
  }

  borrarFoto(slug: string, id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/negocios/${encodeURIComponent(slug)}/fotos/${id}`);
  }

  clientes(q = ''): Observable<ClienteAdmin[]> {
    return this.http.get<ClienteAdmin[]>(`${this.base}/clientes`, { params: q ? { q } : {} });
  }

  reiniciarContrasenaCliente(id: number, nueva: string): Observable<void> {
    return this.http.put<void>(`${this.base}/clientes/${id}/contrasena`, { nueva });
  }

  cambiarAccesoCliente(id: number, activo: boolean): Observable<ClienteAdmin> {
    return this.http.put<ClienteAdmin>(`${this.base}/clientes/${id}/activo`, { activo });
  }

  usuarios(): Observable<Usuario[]> {
    return this.http.get<Usuario[]>(`${this.base}/usuarios`);
  }

  crearEncargado(datos: {
    nombre: string;
    telefono: string;
    correo: string | null;
    contrasena: string;
    negocioSlug: string | null;
    rol?: string;
  }): Observable<Usuario> {
    return this.http.post<Usuario>(`${this.base}/usuarios`, datos);
  }

  editarUsuario(
    id: number,
    datos: { nombre: string; negocioSlug?: string | null; activo?: boolean; telefono?: string; correo?: string },
  ): Observable<Usuario> {
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

  // ---- Comida a domicilio (Encarguitos)

  restaurantes(slug: string): Observable<Restaurante[]> {
    return this.http.get<Restaurante[]>(`${this.de(slug)}/restaurantes`);
  }

  guardarRestaurante(slug: string, r: Partial<Restaurante>): Observable<Restaurante> {
    const { id, platillos: _platillos, ...datos } = r;
    return id
      ? this.http.put<Restaurante>(`${this.de(slug)}/restaurantes/${id}`, datos)
      : this.http.post<Restaurante>(`${this.de(slug)}/restaurantes`, datos);
  }

  guardarPlatillo(slug: string, restauranteId: number, p: Partial<Platillo>): Observable<Platillo> {
    const { id, ...datos } = p;
    const base = `${this.de(slug)}/restaurantes/${restauranteId}/platillos`;
    return id ? this.http.put<Platillo>(`${base}/${id}`, datos) : this.http.post<Platillo>(base, datos);
  }

  private de(slug: string): string {
    return `${this.base}/negocios/${encodeURIComponent(slug)}`;
  }
}
