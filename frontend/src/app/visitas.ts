import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { environment } from '../environments/environment';
import { ClienteSesionService } from './cuenta/cliente-sesion';

/**
 * Contador de visitas por página. Cada página se cuenta una vez por sesión del
 * navegador; el total se muestra camuflado como "folio" en el pie de página.
 */
@Injectable({ providedIn: 'root' })
export class VisitasService {
  private readonly http = inject(HttpClient);
  private readonly cliente = inject(ClienteSesionService);

  /** Total de la página (o null si no se pudo obtener). Nunca falla: el contador no debe estorbar. */
  registrar(ruta: string): Observable<number | null> {
    // Las visitas de los probadores no se cuentan (solo se consulta el total).
    const contar = !yaContada(ruta) && !this.cliente.cliente()?.probador;
    return this.http
      .post<{ total: number }>(`${environment.apiUrl}/visitas`, { ruta, contar })
      .pipe(
        map((r) => {
          if (contar) marcarContada(ruta);
          return r.total;
        }),
        catchError(() => of(null)),
      );
  }
}

/** Ruta de la página a partir de la URL del router: sin query, sin # y sin "/" final. */
export function rutaDeUrl(url: string): string {
  const limpia = url.split(/[?#]/)[0].replace(/\/+$/, '').toLowerCase();
  return limpia === '' ? '/' : limpia;
}

/** /admin y sus pantallas: no se cuentan como visitas. */
export function esRutaDelPanel(ruta: string): boolean {
  return ruta === '/admin' || ruta.startsWith('/admin/');
}

/** El total con apariencia de número de folio interno: SSL-000184. */
export function folio(total: number): string {
  return `SSL-${String(total).padStart(6, '0')}`;
}

// sessionStorage puede no estar disponible (modo privado, vista previa): se ignora.
const clave = (ruta: string) => `ssl:v:${ruta}`;

function yaContada(ruta: string): boolean {
  try {
    return sessionStorage.getItem(clave(ruta)) === '1';
  } catch {
    return false;
  }
}

function marcarContada(ruta: string): void {
  try {
    sessionStorage.setItem(clave(ruta), '1');
  } catch {
    /* sin almacenamiento: se contará en cada carga, no pasa nada */
  }
}
