import { medidasSinRecorte, recorteCuadrado } from './fotos';

describe('fotos', () => {
  it('recorta al centro un cuadrado del lado menor', () => {
    expect(recorteCuadrado(4000, 3000)).toEqual({ x: 500, y: 0, lado: 3000 });
    expect(recorteCuadrado(1080, 1920)).toEqual({ x: 0, y: 420, lado: 1080 });
    expect(recorteCuadrado(800, 800)).toEqual({ x: 0, y: 0, lado: 800 });
  });

  it('reduce las fotos del tianguis sin recortar y sin agrandar', () => {
    expect(medidasSinRecorte(4000, 3000, 1600)).toEqual({ ancho: 1600, alto: 1200 });
    expect(medidasSinRecorte(3000, 4000, 1600)).toEqual({ ancho: 1200, alto: 1600 });
    expect(medidasSinRecorte(800, 600, 1600)).toEqual({ ancho: 800, alto: 600 });
  });
});
