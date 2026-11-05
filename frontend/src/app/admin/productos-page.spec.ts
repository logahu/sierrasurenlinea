import { paraBuscar } from './productos-page';
import { renglones, textosCatalogo } from './textos';

describe('catálogo en el panel', () => {
  it('busca sin importar acentos ni mayúsculas', () => {
    expect(paraBuscar('  Ramo de CEMPASÚCHIL ')).toBe('ramo de cempasuchil');
    expect(paraBuscar('Niño')).toContain('nino');
  });

  it('las características van una por renglón', () => {
    expect(renglones('Medidas: 4 × 4 m\n\n  Capacidad: 8 niños  \n')).toEqual(['Medidas: 4 × 4 m', 'Capacidad: 8 niños']);
  });

  it('en Encarguitos el catálogo se llama tarifas', () => {
    expect(textosCatalogo('SERVICIO').plural).toBe('Tarifas');
    expect(textosCatalogo('SERVICIO').unidades).toContain('por mandado');
    expect(textosCatalogo('RENTA').unidades).toContain('por día');
    expect(textosCatalogo('VENTA').unidades).toEqual([]);
  });
});
