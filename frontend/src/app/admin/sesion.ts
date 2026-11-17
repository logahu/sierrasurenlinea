import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { Sesion, Usuario } from './admin.model';

const CLAVE = 'ssl:sesion';

/**
 * Sesión del panel. El token se guarda en este navegador (localStorage) hasta que
 * vence o hasta "Salir". El backend revisa cada petición: guardar el token aquí
 * solo sirve para no pedir la contraseña en cada visita.
 */
@Injectable({ providedIn: 'root' })
export class SesionService {
  private readonly http = inject(HttpClient);
  private readonly actual = signal<Sesion | null>(leer());

  readonly usuario = computed(() => this.actual()?.usuario ?? null);
  readonly esDueno = computed(() => this.usuario()?.rol === 'DUENO');
  readonly esRepartidor = computed(() => this.usuario()?.rol === 'REPARTIDOR');
  /** Solo ve su agenda. */
  readonly esEmpleado = computed(() => this.usuario()?.rol === 'EMPLEADO');
  /** Agenda: el administrador, los empleados y el encargado de un negocio de citas. */
  readonly veAgenda = computed(() => {
    const u = this.usuario();
    if (!u || u.rol === 'REPARTIDOR') return false;
    // Sesiones guardadas antes de que existiera el dato: se sigue mostrando.
    return u.rol !== 'ENCARGADO' || u.negocioConAgenda !== false;
  });
  /** A dónde llega cada quien al entrar (y al abrir la app del panel). */
  readonly inicio = computed(() => {
    const u = this.usuario();
    if (u?.rol === 'REPARTIDOR') return '/admin/pedidos';
    if (u?.rol === 'EMPLEADO' || (u?.rol === 'ENCARGADO' && u.negocioConAgenda)) return '/admin/agenda';
    return '/admin';
  });

  /** Token vigente, o null si no hay sesión o ya venció. */
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

  entrar(correo: string, contrasena: string): Observable<Sesion> {
    return this.http
      .post<Sesion>(`${environment.apiUrl}/auth/entrar`, { correo, contrasena })
      .pipe(tap((s) => this.guardar(s)));
  }

  /** Vuelve a pedir mis datos (p. ej. si el dueño me cambió el nombre). */
  refrescar(): Observable<Usuario> {
    return this.http.get<Usuario>(`${environment.apiUrl}/auth/yo`).pipe(
      tap((usuario) => {
        const s = this.actual();
        if (s) this.guardar({ ...s, usuario });
      }),
    );
  }

  cambiarContrasena(actual: string, nueva: string): Observable<void> {
    return this.http.put<void>(`${environment.apiUrl}/auth/contrasena`, { actual, nueva });
  }

  salir(): void {
    this.actual.set(null);
    try {
      localStorage.removeItem(CLAVE);
    } catch {
      /* sin almacenamiento */
    }
  }

  private guardar(s: Sesion): void {
    this.actual.set(s);
    try {
      localStorage.setItem(CLAVE, JSON.stringify(s));
    } catch {
      /* sin almacenamiento: la sesión dura mientras la pestaña esté abierta */
    }
  }
}

function leer(): Sesion | null {
  try {
    const crudo = localStorage.getItem(CLAVE);
    const s = crudo ? (JSON.parse(crudo) as Sesion) : null;
    return s?.token && s.expira && Date.parse(s.expira) > Date.now() ? s : null;
  } catch {
    return null;
  }
}
