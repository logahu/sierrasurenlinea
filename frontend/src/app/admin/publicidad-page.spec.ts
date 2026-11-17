import { estadoAnuncio, textoFechas } from './publicidad-page';

describe('publicidad del panel', () => {
  const hoy = '2026-11-17';

  it('dice si un anuncio se ve hoy, está pausado, programado o ya terminó', () => {
    expect(estadoAnuncio({ activo: true, inicio: null, fin: null }, hoy)).toBe('VIGENTE');
    expect(estadoAnuncio({ activo: true, inicio: hoy, fin: hoy }, hoy)).toBe('VIGENTE');
    expect(estadoAnuncio({ activo: false, inicio: null, fin: null }, hoy)).toBe('PAUSADO');
    expect(estadoAnuncio({ activo: true, inicio: '2026-11-18', fin: null }, hoy)).toBe('PROGRAMADO');
    expect(estadoAnuncio({ activo: true, inicio: null, fin: '2026-11-16' }, hoy)).toBe('TERMINADO');
  });

  it('describe las fechas', () => {
    expect(textoFechas(null, null)).toBe('Sin fechas');
    expect(textoFechas('2026-12-01', null)).toMatch(/^Desde el 1 (de )?dic/);
    expect(textoFechas(null, '2026-12-15')).toMatch(/^Hasta el 15 (de )?dic/);
    expect(textoFechas('2026-12-01', '2026-12-15')).toMatch(/^Del 1 .* al 15 /);
  });
});
