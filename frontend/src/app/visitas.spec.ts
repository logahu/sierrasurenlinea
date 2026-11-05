import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { VisitasService, folio, rutaDeUrl } from './visitas';
import { environment } from '../environments/environment';

describe('visitas', () => {
  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  });

  it('normaliza la ruta de la página', () => {
    expect(rutaDeUrl('/')).toBe('/');
    expect(rutaDeUrl('')).toBe('/');
    expect(rutaDeUrl('/turamohoy?categoria=ramos')).toBe('/turamohoy');
    expect(rutaDeUrl('/Inflables/producto/23/')).toBe('/inflables/producto/23');
    expect(rutaDeUrl('/vinateria#contacto')).toBe('/vinateria');
  });

  it('muestra el total como folio', () => {
    expect(folio(184)).toBe('SSL-000184');
    expect(folio(1234567)).toBe('SSL-1234567');
  });

  it('cuenta la página una sola vez por sesión', () => {
    const api = TestBed.inject(VisitasService);
    const http = TestBed.inject(HttpTestingController);
    const totales: (number | null)[] = [];

    api.registrar('/turamohoy').subscribe((t) => totales.push(t));
    const primera = http.expectOne(`${environment.apiUrl}/visitas`);
    expect(primera.request.body).toEqual({ ruta: '/turamohoy', contar: true });
    primera.flush({ ruta: '/turamohoy', total: 7 });

    api.registrar('/turamohoy').subscribe((t) => totales.push(t));
    const segunda = http.expectOne(`${environment.apiUrl}/visitas`);
    expect(segunda.request.body).toEqual({ ruta: '/turamohoy', contar: false });
    segunda.flush({ ruta: '/turamohoy', total: 7 });

    expect(totales).toEqual([7, 7]);
    http.verify();
  });

  it('si el servidor falla no rompe nada y devuelve null', () => {
    const api = TestBed.inject(VisitasService);
    const http = TestBed.inject(HttpTestingController);
    let total: number | null | undefined;
    api.registrar('/').subscribe((t) => (total = t));
    http.expectOne(`${environment.apiUrl}/visitas`).flush('error', { status: 500, statusText: 'Error' });
    expect(total).toBeNull();
    // Como falló, no queda marcada: la próxima vez se vuelve a intentar contar.
    api.registrar('/').subscribe();
    expect(http.expectOne(`${environment.apiUrl}/visitas`).request.body.contar).toBe(true);
  });
});
