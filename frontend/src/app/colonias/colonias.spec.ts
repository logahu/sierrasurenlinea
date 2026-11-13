import { Colonia, agrupar, clave, nombreParaPedido } from './colonias';
import { faltaColonia } from './elegir-colonia';

const c = (id: number, nombre: string, tipo: string): Colonia => ({ id, nombre, tipo, codigoPostal: null, zona: null });
const lista = [c(1, 'Dolores', 'Colonia'), c(2, 'Dolores', 'Barrio'), c(3, 'Arriba', 'Barrio'), c(4, 'El Tunillo', 'Ranchería'), c(5, '14 de Febrero', 'Colonia'), c(6, '3 de Octubre', 'Colonia')];

describe('colonias', () => {
  it('agrupa por tipo en orden y ordena con números naturales', () => {
    const g = agrupar(lista);
    expect(g.map((x) => x.titulo)).toEqual(['Barrios', 'Colonias', 'Rancherías y comunidades']);
    expect(g[1].colonias.map((x) => x.nombre)).toEqual(['3 de Octubre', '14 de Febrero', 'Dolores']);
  });

  it('aclara el tipo solo cuando el nombre se repite', () => {
    expect(nombreParaPedido(lista[1], lista)).toBe('Dolores (Barrio)');
    expect(nombreParaPedido(lista[2], lista)).toBe('Arriba');
  });

  it('compara sin acentos y valida lo escrito', () => {
    expect(clave(' Sta. Cecília ')).toBe('sta cecilia');
    expect(faltaColonia(null)).toBe(true);
    expect(faltaColonia({ id: null, nombre: '  ', zona: null, otra: true })).toBe(true);
    expect(faltaColonia({ id: 1, nombre: 'Dolores', zona: null, otra: false })).toBe(false);
  });
});
