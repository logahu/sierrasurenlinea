import { topeEje, variacion } from './tablero-page';

describe('tablero', () => {
  it('calcula el cambio contra el periodo anterior', () => {
    expect(variacion(125, 100)).toEqual({ texto: '+25 %', sube: true });
    expect(variacion(90, 100)).toEqual({ texto: '−10 %', sube: false });
    expect(variacion(5, 0)).toEqual({ texto: 'nuevo', sube: true });
    expect(variacion(0, 0)).toEqual({ texto: '', sube: null });
  });

  it('redondea el tope del eje', () => {
    expect(topeEje(0)).toBe(4);
    expect(topeEje(7)).toBe(10);
    expect(topeEje(23)).toBe(25);
    expect(topeEje(130)).toBe(200);
  });
});
