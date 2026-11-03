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

  it('pide todos los productos sin filtro', () => {
    service.productos().subscribe();
    const req = http.expectOne(`${api}/productos`);
    expect(req.request.params.has('categoria')).toBe(false);
    req.flush([]);
  });

  it('envía la categoría como query param', () => {
    service.productos('ramos').subscribe();
    const req = http.expectOne((r) => r.url === `${api}/productos`);
    expect(req.request.params.get('categoria')).toBe('ramos');
    req.flush([]);
  });

  it('pide un producto por id', () => {
    service.producto(7).subscribe();
    http.expectOne(`${api}/productos/7`).flush({});
  });
});
