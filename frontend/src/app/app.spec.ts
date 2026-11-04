import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { environment } from '../environments/environment';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  it('muestra la marca en el encabezado', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    TestBed.inject(HttpTestingController).expectOne(`${environment.apiUrl}/negocios`).flush([]);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.marca')?.textContent).toContain('Sierra Sur');
  });

  it('arma el menú con los negocios de la API', async () => {
    const fixture = TestBed.createComponent(App);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne(`${environment.apiUrl}/negocios`).flush([
      { id: 1, slug: 'turamohoy', nombre: 'TuRamoHoy', colorPrimario: '#d6336c' },
      { id: 3, slug: 'inflables', nombre: 'Renta de Inflables', colorPrimario: '#1c7ed6' },
    ]);
    await fixture.whenStable();
    const enlaces = [...(fixture.nativeElement as HTMLElement).querySelectorAll('.menu a')];
    expect(enlaces.map((a) => a.textContent?.trim())).toEqual(['TuRamoHoy', 'Renta de Inflables']);
    expect(enlaces[1].getAttribute('href')).toBe('/inflables');
  });
});
