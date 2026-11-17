import { puestoDe } from './cuenta-page';

describe('mi perfil', () => {
  it('describe el puesto de cada quien', () => {
    expect(puestoDe({ rol: 'DUENO', negocioNombre: null })).toBe('Administrador');
    expect(puestoDe({ rol: 'ENCARGADO', negocioNombre: 'TuRamoHoy' })).toBe('Encargado de TuRamoHoy');
    expect(puestoDe({ rol: 'EMPLEADO', negocioNombre: 'Estudio Melgarejo' })).toBe('Equipo de Estudio Melgarejo');
    expect(puestoDe({ rol: 'REPARTIDOR', negocioNombre: null })).toBe('Repartidor general');
  });
});
