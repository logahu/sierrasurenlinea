import { TestBed } from '@angular/core/testing';
import { Producto } from './catalogo.model';
import {
  CarritoService, DatosPedido, LineaCarrito, armarMensajeCarrito, bloquesDeCita, faltantesPedido, modoDe, textoCuando, totalDe,
} from './carrito';

const ramo = { id: 1, nombre: 'Ramo de rosas', precio: 450, unidadPrecio: null, imagenUrl: 'a.svg' } as Producto;
const girasol = { id: 2, nombre: 'Girasoles', precio: 380.5, unidadPrecio: null, imagenUrl: 'b.svg' } as Producto;

const datos = (d: Partial<DatosPedido> = {}): DatosPedido => ({
  entrega: 'DOMICILIO', entregar: 'Hidalgo 4', cuando: 'Lo antes posible', notas: '', ...d,
});

describe('carrito', () => {
  beforeEach(() => localStorage.clear());

  it('suma cantidades del mismo producto y separa por negocio', () => {
    const c = TestBed.inject(CarritoService);
    c.agregar('turamohoy', ramo, 1);
    c.agregar('turamohoy', ramo, 2);
    c.agregar('turamohoy', girasol, 1);
    c.agregar('belleza', ramo, 1);
    expect(c.lineas('turamohoy').map((l) => l.cantidad)).toEqual([3, 1]);
    expect(totalDe(c.lineas('turamohoy'))).toBe(1730.5);
    expect(c.lineas('belleza').length).toBe(1);
    c.cambiarCantidad('turamohoy', 1, 0);
    expect(c.lineas('turamohoy').map((l) => l.productoId)).toEqual([2]);
    c.vaciar('turamohoy');
    expect(c.lineas('turamohoy')).toEqual([]);
    expect(JSON.parse(localStorage.getItem('ssl:carrito')!)).toEqual({ belleza: c.lineas('belleza') });
  });

  it('en citas cada vehículo cuenta una vez', () => {
    const c = TestBed.inject(CarritoService);
    c.agregar('autos', ramo, 5, 'CITA');
    c.agregar('autos', ramo, 1, 'CITA');
    expect(c.lineas('autos')[0].cantidad).toBe(1);
  });

  it('toma el modo del negocio', () => {
    expect(modoDe({ tipo: 'VENTA', modoPedido: null })).toBe('COMPRA');
    expect(modoDe({ tipo: 'RENTA' })).toBe('RENTA');
    expect(modoDe({ tipo: 'VENTA', modoPedido: 'CITA' })).toBe('CITA');
    expect(modoDe({ tipo: 'SERVICIO' })).toBeNull();
  });

  it('pide lo necesario según el modo', () => {
    const l: LineaCarrito[] = [{ productoId: 1, nombre: 'x', precio: 1, unidadPrecio: null, imagenUrl: '', cantidad: 1 }];
    expect(faltantesPedido('COMPRA', l, datos(), false, false)).toEqual([]);
    expect(faltantesPedido('COMPRA', l, datos({ entregar: ' ' }), false, false)).toEqual(['la dirección de entrega']);
    expect(faltantesPedido('COMPRA', l, datos({ entrega: 'RECOGER', entregar: '' }), false, false)).toEqual([]);
    expect(faltantesPedido('RENTA', l, datos({ cuando: '' }), false, false)).toEqual(['la fecha del evento']);
    expect(faltantesPedido('CITA', [], datos({ cuando: '' }), true, false)).toEqual([
      'al menos un vehículo', 'el día de tu visita', 'confirmar que eres mayor de 18 años',
    ]);
  });

  it('arma el texto de cuándo', () => {
    expect(textoCuando('COMPRA', false, '2026-12-20', '')).toBe('Lo antes posible');
    expect(textoCuando('RENTA', false, '', '')).toBe('');
    expect(textoCuando('RENTA', false, '2026-12-20', 'de 4 a 9')).toMatch(/20 de diciembre, de 4 a 9$/);
  });

  it('arma el mensaje con folio, renglones y total', () => {
    const l: LineaCarrito[] = [
      { productoId: 1, nombre: 'Ramo de rosas', precio: 450, unidadPrecio: null, imagenUrl: '', cantidad: 2 },
    ];
    const m = armarMensajeCarrito({ nombre: 'TuRamoHoy' }, 'COMPRA', l, datos({ notas: 'Tarjeta: Te quiero' }),
      { nombre: 'Rosa', telefono: '9511234567' }, 'TUR-00012');
    expect(m).toContain('Hola TuRamoHoy, quiero hacer un pedido:');
    expect(m).toContain('*Folio:* TUR-00012');
    expect(m).toContain('• 2 × Ramo de rosas — $900');
    expect(m).toContain('*Total aprox.:* $900');
    expect(m).toContain('*Entregar en:* Hidalgo 4');
    expect(m).toContain('*Notas:* Tarjeta: Te quiero');
    expect(m).toContain('*Teléfono:* 9511234567');
    const conPunto = armarMensajeCarrito({ nombre: 'TuRamoHoy' }, 'COMPRA', l, datos({ punto: { lat: 16.33, lng: -96.6 } }),
      { nombre: 'Rosa', telefono: '9511234567' });
    expect(conPunto).toContain('*Ubicación:* https://maps.google.com/?q=16.330000,-96.600000');
  });

  it('la cita ocupa la suma de los bloques de sus servicios (máximo 8)', () => {
    const c = TestBed.inject(CarritoService);
    c.agregar('dentista', { ...ramo, bloquesCita: 1 }, 1, 'CITA');
    c.agregar('dentista', { ...girasol, bloquesCita: 2 }, 1, 'CITA');
    expect(bloquesDeCita(c.lineas('dentista'))).toBe(3);
    // Carritos guardados antes del cambio no traen bloques: cuentan como 1.
    expect(bloquesDeCita([{}, {}])).toBe(2);
    expect(bloquesDeCita([{ bloquesCita: 6 }, { bloquesCita: 5 }])).toBe(8);
    expect(bloquesDeCita([])).toBe(1);
  });
});
