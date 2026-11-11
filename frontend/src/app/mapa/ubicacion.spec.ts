import { enlaceComoLlegar, enlaceVer, puntoDe, puntoValido } from './ubicacion';

describe('ubicación', () => {
  it('arma los enlaces de Google Maps', () => {
    const p = { lat: 16.3283451, lng: -96.5961234 };
    expect(enlaceVer(p)).toBe('https://maps.google.com/?q=16.328345,-96.596123');
    expect(enlaceComoLlegar(p)).toBe('https://www.google.com/maps/dir/?api=1&destination=16.328345,-96.596123');
  });

  it('solo acepta puntos dentro de México', () => {
    expect(puntoValido({ lat: 16.33, lng: -96.6 })).toBe(true);
    expect(puntoValido({ lat: 48.85, lng: 2.35 })).toBe(false);
    expect(puntoDe(null, -96.6)).toBeNull();
    expect(puntoDe(16.33, -96.6)).toEqual({ lat: 16.33, lng: -96.6 });
  });
});
