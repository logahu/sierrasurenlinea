import { direccionCorta, enlaceLlegarNegocio, horarioCorto, puntoNegocio } from './ubicacion-negocio';

describe('ubicación del negocio', () => {
  const local = { atencionEnLocal: true, direccion: 'Av. Juárez 25', colonia: 'Centro', referencias: null, lat: 16.3301, lng: -96.5944 };

  it('dirección corta y horario corto', () => {
    expect(direccionCorta(local)).toBe('Av. Juárez 25, Centro');
    expect(horarioCorto('Lun a sáb, 9:00 a 19:00')).toBe('Lun a sáb 9–19');
    expect(horarioCorto('Todos los días')).toBe('Todos los días');
  });

  it('cómo llegar: al pin, o buscando la dirección, o nada si es solo en línea', () => {
    expect(enlaceLlegarNegocio(local)).toContain('destination=16.330100,-96.594400');
    expect(enlaceLlegarNegocio({ ...local, lat: null, lng: null })).toBe(
      'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent('Av. Juárez 25, Centro, Miahuatlán de Porfirio Díaz, Oax.'),
    );
    expect(enlaceLlegarNegocio({ ...local, atencionEnLocal: false })).toBeNull();
    expect(puntoNegocio({ ...local, atencionEnLocal: false })).toBeNull();
    expect(enlaceLlegarNegocio({ ...local, direccion: null, colonia: null, lat: null, lng: null })).toBeNull();
  });
});
