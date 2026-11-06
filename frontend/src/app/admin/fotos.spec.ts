import { recorteCuadrado } from './fotos';

describe('fotos', () => {
  it('recorta al centro un cuadrado del lado menor', () => {
    expect(recorteCuadrado(4000, 3000)).toEqual({ x: 500, y: 0, lado: 3000 });
    expect(recorteCuadrado(1080, 1920)).toEqual({ x: 0, y: 420, lado: 1080 });
    expect(recorteCuadrado(800, 800)).toEqual({ x: 0, y: 0, lado: 800 });
  });
});
