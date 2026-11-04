import { Producto } from './catalogo.model';
import { enlaceTelefono, enlaceWhatsapp, mensajeProducto, precioConUnidad } from './contacto';

const producto = (parcial: Partial<Producto>): Producto => ({
  id: 1,
  nombre: 'Brincolín castillo',
  descripcion: null,
  precio: 650,
  unidadPrecio: 'por día',
  caracteristicas: [],
  imagenUrl: 'img/x.svg',
  negocioSlug: 'inflables',
  negocioNombre: 'Renta de Inflables',
  categoriaSlug: 'brincolines',
  categoriaNombre: 'Brincolines',
  destacado: false,
  ...parcial,
});

describe('contacto', () => {
  it('muestra el precio con su unidad cuando es renta', () => {
    expect(precioConUnidad({ precio: 650, unidadPrecio: 'por día' })).toBe('$650 por día');
  });

  it('muestra solo el precio cuando es venta', () => {
    expect(precioConUnidad({ precio: 1200, unidadPrecio: null })).toBe('$1,200');
  });

  it('arma el enlace de WhatsApp quitando espacios y codificando el mensaje', () => {
    expect(enlaceWhatsapp('52 1 951 000 0000', 'Hola, ¿precio?')).toBe(
      'https://wa.me/5219510000000?text=Hola%2C%20%C2%BFprecio%3F',
    );
  });

  it('el mensaje de renta pregunta por fechas', () => {
    const msg = mensajeProducto({ tipo: 'RENTA' }, producto({}));
    expect(msg).toContain('quiero rentar "Brincolín castillo"');
    expect(msg).toContain('$650 por día');
    expect(msg).toContain('fechas');
  });

  it('el mensaje de venta pregunta por disponibilidad', () => {
    const msg = mensajeProducto({ tipo: 'VENTA' }, producto({ nombre: 'Labial mate', precio: 149, unidadPrecio: null }));
    expect(msg).toContain('me interesa "Labial mate" ($149)');
  });

  it('arma el enlace tel: sin espacios', () => {
    expect(enlaceTelefono('951 000 0000')).toBe('tel:9510000000');
  });
});
