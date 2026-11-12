import { textoDeCuentas } from './usuarios-prueba';

describe('textoDeCuentas', () => {
  const cuentas = [
    { tipo: 'Cliente' as const, nombre: '🧪 PRUEBA Cliente 01', telefono: '5550000001', contrasena: 'abcd-efgh-jkmn', negocio: null, estado: 'Creado' },
    { tipo: 'Encargado' as const, nombre: 'Ana, la de flores', telefono: '9511234567', contrasena: null, negocio: 'Florería', estado: 'Omitido: ya tiene encargado' },
  ];

  it('separa con tabuladores y dice dónde entra cada quien', () => {
    const lineas = textoDeCuentas(cuentas).split('\n');
    expect(lineas.length).toBe(3);
    expect(lineas[1]).toBe('Cliente\t🧪 PRUEBA Cliente 01\t5550000001\tabcd-efgh-jkmn\t\tCreado\tsierrasurenlinea.com.mx/cuenta/entrar');
    expect(lineas[2].endsWith('sierrasurenlinea.com.mx/admin')).toBe(true);
  });

  it('en CSV pone entre comillas lo que lleva coma', () => {
    expect(textoDeCuentas(cuentas, ',').split('\n')[2]).toContain('"Ana, la de flores"');
  });
});
