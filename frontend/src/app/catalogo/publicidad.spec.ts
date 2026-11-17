import { TestBed } from '@angular/core/testing';
import { DIAS_OCULTA, PublicidadService, esEnlaceInterno, ocultaHasta, sigueOculta, textoSobre } from './publicidad';

const DIA = 24 * 60 * 60 * 1000;

describe('publicidad', () => {
  beforeEach(() => localStorage.clear());

  it('la × la oculta 7 días y luego vuelve sola', () => {
    const ahora = Date.UTC(2026, 10, 17, 12);
    const hasta = ocultaHasta(ahora);
    expect(DIAS_OCULTA).toBe(7);
    expect(hasta - ahora).toBe(7 * DIA);
    expect(sigueOculta(String(hasta), ahora + 6 * DIA)).toBe(true);
    expect(sigueOculta(String(hasta), ahora + 7 * DIA)).toBe(false);
    expect(sigueOculta(null, ahora)).toBe(false);
    expect(sigueOculta('basura', ahora)).toBe(false);
  });

  it('el servicio guarda la preferencia y «Mostrar publicidad» la quita', () => {
    const p = TestBed.inject(PublicidadService);
    expect(p.oculta()).toBe(false);
    p.ocultar();
    expect(p.oculta()).toBe(true);
    expect(sigueOculta(localStorage.getItem('ssl:publicidad-oculta'), Date.now())).toBe(true);
    p.mostrar();
    expect(p.oculta()).toBe(false);
    expect(localStorage.getItem('ssl:publicidad-oculta')).toBeNull();
  });

  it('distingue enlaces del sitio y externos', () => {
    expect(esEnlaceInterno('/turamohoy')).toBe(true);
    expect(esEnlaceInterno('/giro/flores')).toBe(true);
    expect(esEnlaceInterno('//otro.com')).toBe(false);
    expect(esEnlaceInterno('https://example.com')).toBe(false);
    expect(esEnlaceInterno(null)).toBe(false);
  });

  it('elige texto claro u oscuro según el fondo', () => {
    expect(textoSobre('#1e2a5a')).toBe('#ffffff');
    expect(textoSobre('#f2c94c')).toBe('#14181f');
    expect(textoSobre('#ffffff')).toBe('#14181f');
    expect(textoSobre(null)).toBe('#ffffff');
  });
});
