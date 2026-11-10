import { soloEnWeb, visiblesAqui } from './modo-app';

describe('modo app', () => {
  const negocios = [
    { slug: 'turamohoy', visibleApp: true },
    { slug: 'vinateria', visibleApp: false },
  ];

  it('en la app quita los negocios "solo web"; en la web muestra todos', () => {
    expect(visiblesAqui(negocios, true).map((n) => n.slug)).toEqual(['turamohoy']);
    expect(visiblesAqui(negocios, false).map((n) => n.slug)).toEqual(['turamohoy', 'vinateria']);
  });

  it('avisa solo dentro de la app', () => {
    expect(soloEnWeb(negocios[1], true)).toBe(true);
    expect(soloEnWeb(negocios[1], false)).toBe(false);
    expect(soloEnWeb(undefined, true)).toBe(false);
  });
});
