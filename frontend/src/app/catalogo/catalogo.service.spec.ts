import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CatalogoService } from './catalogo.service';
import { environment } from '../../environments/environment';

const api = environment.apiUrl;

describe('CatalogoService', () => {
  let service: CatalogoService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CatalogoService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('pide la lista de negocios una sola vez aunque se use en varios lugares', () => {
    service.negocios().subscribe();
    service.negocios().subscribe();
    TestBed.tick(); // la lista depende de la sesión (probador o no): se pide al correr los efectos
    http.expectOne(`${api}/negocios`).flush([]);
  });

  it('pide el detalle de un negocio', () => {
    service.negocio('inflables').subscribe();
    http.expectOne(`${api}/negocios/inflables`).flush({});
  });

  it('pide los productos de un negocio sin filtro', () => {
    service.productos('turamohoy').subscribe();
    const req = http.expectOne(`${api}/negocios/turamohoy/productos`);
    expect(req.request.params.has('categoria')).toBe(false);
    req.flush([]);
  });

  it('envía la categoría como query param', () => {
    service.productos('turamohoy', 'ramos').subscribe();
    const req = http.expectOne((r) => r.url === `${api}/negocios/turamohoy/productos`);
    expect(req.request.params.get('categoria')).toBe('ramos');
    req.flush([]);
  });

  it('pide un producto por id', () => {
    service.producto(7).subscribe();
    http.expectOne(`${api}/productos/7`).flush({});
  });
});
