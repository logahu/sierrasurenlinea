import { TestBed } from '@angular/core/testing';
import { DOCUMENT } from '@angular/common';
import { Negocio } from './catalogo.model';
import { DatosEstructurados, datosEstructurados } from './datos-estructurados';

const SALON = {
  id: 7, slug: 'estudio-melgarejo', nombre: 'Estudio Melgarejo', eslogan: 'Salón de belleza', descripcion: null,
  tipo: 'VENTA', colorPrimario: '#1a1a1a', portadaUrl: 'img/estudio-melgarejo-logo.png', whatsapp: '5219511234567',
  telefono: null, direccion: 'Calle Morelos 12', colonia: 'Centro', horario: 'Lun a sáb, 10:00 a 19:00',
  atencionEnLocal: true, lat: 16.323368, lng: -96.588286, soloMayoresEdad: false,
  giro: { slug: 'belleza', nombre: 'Belleza' },
  googleMapsUrl: 'https://maps.app.goo.gl/bpEujxaGgXyRK41H8',
} as unknown as Negocio;

describe('datos estructurados', () => {
  it('describe al negocio para Google con su perfil de Maps', () => {
    const d = datosEstructurados(SALON, 'https://sierrasurenlinea.com.mx');
    expect(d).toEqual({
      '@context': 'https://schema.org',
      '@type': 'BeautySalon',
      '@id': 'https://sierrasurenlinea.com.mx/estudio-melgarejo#negocio',
      name: 'Estudio Melgarejo',
      url: 'https://sierrasurenlinea.com.mx/estudio-melgarejo',
      description: 'Salón de belleza',
      image: 'https://sierrasurenlinea.com.mx/img/estudio-melgarejo-logo.png',
      telephone: '+529511234567',
      address: {
        '@type': 'PostalAddress', streetAddress: 'Calle Morelos 12, Centro',
        addressLocality: 'Miahuatlán de Porfirio Díaz', addressRegion: 'Oaxaca', addressCountry: 'MX',
      },
      geo: { '@type': 'GeoCoordinates', latitude: 16.323368, longitude: -96.588286 },
      hasMap: 'https://maps.app.goo.gl/bpEujxaGgXyRK41H8',
      sameAs: ['https://maps.app.goo.gl/bpEujxaGgXyRK41H8'],
    });
  });

  it('solo en línea: sin dirección ni coordenadas; giro sin tipo propio = LocalBusiness', () => {
    const d = datosEstructurados({ ...SALON, atencionEnLocal: false, googleMapsUrl: null, giro: { slug: 'fiestas', nombre: 'Fiestas' } },
      'https://sierrasurenlinea.com.mx');
    expect(d['@type']).toBe('LocalBusiness');
    expect(d['address']).toBeUndefined();
    expect(d['geo']).toBeUndefined();
    expect(d['sameAs']).toBeUndefined();
  });

  it('pone un solo <script> en el head, escapa «<» y lo quita', () => {
    TestBed.configureTestingModule({ providers: [DatosEstructurados] });
    const s = TestBed.inject(DatosEstructurados);
    const doc = TestBed.inject(DOCUMENT);
    s.poner({ ...SALON, nombre: 'Malo </script><b>' });
    s.poner(SALON);
    const scripts = doc.head.querySelectorAll('script[type="application/ld+json"]#ld-negocio');
    expect(scripts.length).toBe(1);
    expect(JSON.parse(scripts[0].textContent!).name).toBe('Estudio Melgarejo');
    s.poner({ ...SALON, nombre: 'A</script>' });
    expect(scripts[0].textContent).not.toContain('</script>');
    s.quitar();
    expect(doc.head.querySelector('#ld-negocio')).toBeNull();
  });
});
