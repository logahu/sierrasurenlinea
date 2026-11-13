import { HttpClient, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, tap, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ActividadCuenta, Cliente, FiltroHistorial, HistorialPedidos, MiPedido, Registro, SesionCliente,
} from './cuenta.model';

const CLAVE = 'ssl:cliente';

/**
 * Sesión del cliente del sitio (distinta de la del panel). El token se guarda en este
 * navegador por 30 días para no pedir la contraseña en cada visita; el backend revisa
 * cada petición.
 */
@Injectable({ providedIn: 'root' })
export class ClienteSesionService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/clientes`;
  private readonly actual = signal<SesionCliente | null>(leer());

  readonly cliente = computed(() => this.actual()?.cliente ?? null);
  /** Primer nombre, para saludar. */
  readonly primerNombre = computed(() => this.cliente()?.nombre.trim().split(/\s+/)[0] ?? '');

  token(): string | null {
    const s = this.actual();
    if (!s) return null;
    if (Date.parse(s.expira) <= Date.now()) {
      this.salir();
      return null;
    }
    return s.token;
  }

  activa(): boolean {
    return this.token() !== null;
  }

  registrar(datos: Registro): Observable<SesionCliente> {
    return this.http.post<SesionCliente>(`${this.base}/registro`, datos).pipe(tap((s) => this.guardar(s)));
  }

  entrar(telefono: string, contrasena: string): Observable<SesionCliente> {
    return this.http
      .post<SesionCliente>(`${this.base}/entrar`, { telefono, contrasena })
      .pipe(tap((s) => this.guardar(s)));
  }

  refrescar(): Observable<Cliente> {
    return this.http.get<Cliente>(`${this.base}/yo`).pipe(tap((c) => this.actualizar(c)));
  }

  editar(datos: {
    nombre: string;
    correo: string | null;
    direccion: string | null;
    lat: number | null;
    lng: number | null;
  }): Observable<Cliente> {
    return this.http.put<Cliente>(`${this.base}/yo`, datos).pipe(tap((c) => this.actualizar(c)));
  }

  cambiarContrasena(actual: string, nueva: string): Observable<void> {
    return this.http.put<void>(`${this.base}/contrasena`, { actual, nueva });
  }

  pedidos(): Observable<MiPedido[]> {
    return this.http.get<MiPedido[]>(`${this.base}/pedidos`);
  }

  /** Todos sus pedidos con filtro, de 20 en 20. */
  historial(estado: FiltroHistorial, pagina: number): Observable<HistorialPedidos> {
    const params: Record<string, string> = { pagina: String(pagina) };
    if (estado !== 'todos') params['estado'] = estado;
    return this.http.get<HistorialPedidos>(`${this.base}/historial`, { params });
  }

  /** Lo que pasó en su cuenta y en sus pedidos. */
  actividad(pagina: number): Observable<ActividadCuenta> {
    return this.http.get<ActividadCuenta>(`${this.base}/actividad`, { params: { pagina: String(pagina) } });
  }

  salir(): void {
    this.actual.set(null);
    try {
      localStorage.removeItem(CLAVE);
    } catch {
      /* sin almacenamiento */
    }
  }

  private actualizar(cliente: Cliente): void {
    const s = this.actual();
    if (s) this.guardar({ ...s, cliente });
  }

  private guardar(s: SesionCliente): void {
    this.actual.set(s);
    try {
      localStorage.setItem(CLAVE, JSON.stringify(s));
    } catch {
      /* sin almacenamiento: la sesión dura mientras la pestaña esté abierta */
    }
  }
}

function leer(): SesionCliente | null {
  try {
    const crudo = localStorage.getItem(CLAVE);
    const s = crudo ? (JSON.parse(crudo) as SesionCliente) : null;
    return s?.token && s.expira && Date.parse(s.expira) > Date.now() ? s : null;
  } catch {
    return null;
  }
}

/** Lecturas del catálogo público (negocios y productos). */
export function esCatalogo(metodo: string, url: string): boolean {
  const api = environment.apiUrl;
  if (metodo !== 'GET' || !url.startsWith(api + '/')) return false;
  const ruta = url.slice(api.length).split('?')[0];
  return ruta === '/negocios' || ruta.startsWith('/negocios/') || ruta === '/productos' || ruta.startsWith('/productos/');
}

/** Peticiones que van con la sesión del cliente: su cuenta y el envío de pedidos. */
export function esPeticionDelCliente(metodo: string, url: string): boolean {
  const api = environment.apiUrl;
  if (!url.startsWith(api + '/')) return false;
  const ruta = url.slice(api.length).split('?')[0];
  if (ruta === '/clientes/registro' || ruta === '/clientes/entrar') return false;
  return ruta.startsWith('/clientes/') || (metodo === 'POST' && (ruta === '/pedidos' || ruta === '/pedidos/carrito'));
}

/**
 * Agrega el token del cliente y saca la petición del caché del service worker. Si el
 * backend responde 401, la sesión ya no sirve (venció o se dio de baja) y se cierra.
 */
export const clienteInterceptor: HttpInterceptorFn = (req, next) => {
  const sesion = inject(ClienteSesionService);
  // Los probadores mandan su sesión también al catálogo, para ver los negocios en pruebas.
  const probador = sesion.cliente()?.probador === true && esCatalogo(req.method, req.url);
  if (!probador && !esPeticionDelCliente(req.method, req.url)) return next(req);
  const token = sesion.token();
  const conToken = req.clone({
    setParams: { 'ngsw-bypass': 'true' },
    setHeaders: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return next(conToken).pipe(
    catchError((e: unknown) => {
      if (e instanceof HttpErrorResponse && e.status === 401) sesion.salir();
      return throwError(() => e);
    }),
  );
};
