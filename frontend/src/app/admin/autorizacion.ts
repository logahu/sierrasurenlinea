import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { SesionService } from './sesion';

/** Peticiones que necesitan la sesión del panel. El resto del sitio va sin token. */
export function esPeticionDelPanel(metodo: string, url: string): boolean {
  const api = environment.apiUrl;
  if (!url.startsWith(api + '/')) return false;
  const ruta = url.slice(api.length).split('?')[0];
  return (
    ruta.startsWith('/admin/') ||
    ruta === '/auth/yo' ||
    ruta === '/auth/contrasena' ||
    (metodo === 'GET' && ruta === '/visitas')
  );
}

/**
 * Agrega el token a las peticiones del panel y las saca del caché del service worker
 * (ngsw-bypass), para no mostrar datos viejos ni guardar datos privados. Si el
 * backend dice 401, la sesión ya no sirve: se cierra y se vuelve a la entrada.
 */
export const autorizacionInterceptor: HttpInterceptorFn = (req, next) => {
  if (!esPeticionDelPanel(req.method, req.url)) return next(req);
  const sesion = inject(SesionService);
  const router = inject(Router);
  const token = sesion.token();
  const conToken = req.clone({
    setParams: { 'ngsw-bypass': 'true' },
    setHeaders: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return next(conToken).pipe(
    catchError((e: unknown) => {
      if (e instanceof HttpErrorResponse && e.status === 401) {
        sesion.salir();
        void router.navigate(['/admin/entrar'], { queryParams: { vencida: 1 } });
      }
      return throwError(() => e);
    }),
  );
};

/** Pantallas del panel: sin sesión, a la entrada (y luego de vuelta a donde iba). */
export const conSesion: CanActivateFn = (_route, state) => {
  if (inject(SesionService).activa()) return true;
  return inject(Router).createUrlTree(['/admin/entrar'], { queryParams: { volver: state.url } });
};

/** Pantallas solo del dueño. */
export const soloDueno: CanActivateFn = () =>
  inject(SesionService).esDueno() ? true : inject(Router).createUrlTree(['/admin']);

/** Mensaje de error para mostrar en pantalla, a partir de la respuesta del backend. */
export function mensajeDeError(e: unknown): string {
  if (e instanceof HttpErrorResponse) {
    if (e.status === 0) {
      return 'No hubo respuesta del servidor. Si llevaba rato sin uso puede estar despertando: intenta de nuevo en un minuto.';
    }
    const cuerpo = e.error as { mensaje?: string; violations?: { message?: string }[] } | null;
    if (cuerpo?.mensaje) return cuerpo.mensaje;
    const violacion = cuerpo?.violations?.find((v) => v.message)?.message;
    if (violacion) return violacion;
    if (e.status === 403) return 'No tienes permiso para hacer esto.';
    if (e.status === 404) return 'No se encontró lo que buscas.';
  }
  return 'Algo salió mal. Intenta de nuevo.';
}
