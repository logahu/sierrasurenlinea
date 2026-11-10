import { Pedido } from './admin.model';
import { hace, siguientePaso } from './pedidos';

describe('pedidos', () => {
  const p = (estado: Pedido['estado'], modo: Pedido['modo'] = 'MANDADO') => ({ estado, modo }) as Pedido;

  it('propone el siguiente paso de cada pedido', () => {
    expect(siguientePaso(p('NUEVO'))?.estado).toBe('ACEPTADO');
    expect(siguientePaso(p('ACEPTADO'))?.texto).toBe('Voy en camino');
    expect(siguientePaso(p('ACEPTADO', 'VIAJE'))?.texto).toBe('Voy por el pasajero');
    expect(siguientePaso(p('EN_CAMINO'))?.estado).toBe('ENTREGADO');
    expect(siguientePaso(p('ENTREGADO'))).toBeNull();
    expect(siguientePaso(p('CANCELADO'))).toBeNull();
  });

  it('dice hace cuánto llegó', () => {
    const ahora = Date.parse('2026-11-09T20:00:00Z');
    expect(hace('2026-11-09T19:59:40Z', ahora)).toBe('ahora');
    expect(hace('2026-11-09T19:45:00Z', ahora)).toBe('hace 15 min');
    expect(hace('2026-11-09T17:00:00Z', ahora)).toBe('hace 3 h');
  });
});
