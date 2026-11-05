import { TestBed } from '@angular/core/testing';
import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../environments/environment';
import { autorizacionInterceptor, esPeticionDelPanel, mensajeDeError } from './autorizacion';
import { SesionService } from './sesion';

const api = environment.apiUrl;
const enUnaHora = () => new Date(Date.now() + 3600_000).toISOString();
const usuario = {
  id: 1, correo: 'dueno@x.mx', nombre: 'Hugo', rol: 'DUENO' as const,
  negocioSlug: null, negocioNombre: null, activo: true, bloqueado: false,
};

describe('autorización del panel', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '**', children: [] }]),
        provideHttpClient(withInterceptors([autorizacionInterceptor])),
        provideHttpClientTesting(),
      ],
    });
  });

  it('distingue las peticiones del panel de las del sitio', () => {
    expect(esPeticionDelPanel('GET', `${api}/admin/negocios`)).toBe(true);
    expect(esPeticionDelPanel('PUT', `${api}/auth/contrasena`)).toBe(true);
    expect(esPeticionDelPanel('GET', `${api}/visitas`)).toBe(true);
    expect(esPeticionDelPanel('POST', `${api}/visitas`)).toBe(false);
    expect(esPeticionDelPanel('POST', `${api}/auth/entrar`)).toBe(false);
    expect(esPeticionDelPanel('GET', `${api}/negocios`)).toBe(false);
    expect(esPeticionDelPanel('GET', `https://otro.com/api/admin/x`)).toBe(false);
  });

  function entrar(): void {
    const sesion = TestBed.inject(SesionService);
    const http = TestBed.inject(HttpTestingController);
    sesion.entrar('dueno@x.mx', 'clave-larga-1').subscribe();
    http.expectOne(`${api}/auth/entrar`).flush({ token: 'tok', expira: enUnaHora(), usuario });
  }

  it('manda el token solo al panel y lo saca del caché del service worker', () => {
    entrar();
    const http = TestBed.inject(HttpTestingController);
    const cliente = TestBed.inject(HttpClient);

    cliente.get(`${api}/admin/negocios`).subscribe();
    const panel = http.expectOne((r) => r.url === `${api}/admin/negocios`);
    expect(panel.request.headers.get('Authorization')).toBe('Bearer tok');
    expect(panel.request.params.get('ngsw-bypass')).toBe('true');
    panel.flush([]);

    cliente.get(`${api}/negocios`).subscribe();
    const sitio = http.expectOne(`${api}/negocios`);
    expect(sitio.request.headers.has('Authorization')).toBe(false);
    sitio.flush([]);
    http.verify();
  });

  it('si el backend dice 401 cierra la sesión', () => {
    entrar();
    const sesion = TestBed.inject(SesionService);
    expect(sesion.activa()).toBe(true);
    TestBed.inject(HttpClient).get(`${api}/admin/negocios`).subscribe({ error: () => undefined });
    TestBed.inject(HttpTestingController)
      .expectOne((r) => r.url === `${api}/admin/negocios`)
      .flush({ mensaje: 'x' }, { status: 401, statusText: 'Unauthorized' });
    expect(sesion.activa()).toBe(false);
    expect(localStorage.getItem('ssl:sesion')).toBeNull();
  });

  it('ignora una sesión guardada que ya venció', () => {
    localStorage.setItem('ssl:sesion', JSON.stringify({ token: 't', expira: '2020-01-01T00:00:00Z', usuario }));
    expect(TestBed.inject(SesionService).activa()).toBe(false);
  });

  it('recupera la sesión guardada vigente', () => {
    localStorage.setItem('ssl:sesion', JSON.stringify({ token: 't', expira: enUnaHora(), usuario }));
    const s = TestBed.inject(SesionService);
    expect(s.activa()).toBe(true);
    expect(s.esDueno()).toBe(true);
  });

  it('arma mensajes de error legibles', () => {
    const conMensaje = new HttpErrorResponse({ status: 409, error: { mensaje: 'Ya tiene encargado.' } });
    expect(mensajeDeError(conMensaje)).toBe('Ya tiene encargado.');
    const validacion = new HttpErrorResponse({ status: 400, error: { violations: [{ message: 'El nombre es obligatorio.' }] } });
    expect(mensajeDeError(validacion)).toBe('El nombre es obligatorio.');
    expect(mensajeDeError(new HttpErrorResponse({ status: 0 }))).toContain('despertando');
  });
});
