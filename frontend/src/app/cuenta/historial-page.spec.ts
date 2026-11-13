import { EventoCuenta, LineaCliente } from './cuenta.model';
import { juntar, lineasPorPersona, porDia } from './historial-page';

const e = (cuando: string, texto = 'x'): EventoCuenta => ({ cuando, quien: 'TU', tipo: 'CUENTA', texto, folio: null });

describe('Mi historial', () => {
  it('agrupa la actividad en Hoy, Ayer y fechas', () => {
    const hoy = new Date(2026, 10, 13, 18, 0);
    const g = porDia([e(new Date(2026, 10, 13, 9).toISOString()), e(new Date(2026, 10, 13, 8).toISOString()),
      e(new Date(2026, 10, 12, 20).toISOString()), e(new Date(2026, 10, 1, 10).toISOString())], hoy);
    expect(g.map((x) => [x.dia.startsWith('1') ? 'fecha' : x.dia, x.eventos.length])).toEqual([['Hoy', 2], ['Ayer', 1], ['fecha', 1]]);
  });

  it('junta las páginas sin repetir', () => {
    expect(juntar([{ id: 1 }, { id: 2 }], [{ id: 2 }, { id: 3 }], 1).map((x) => x.id)).toEqual([1, 2, 3]);
    expect(juntar([{ id: 1 }], [{ id: 9 }], 0).map((x) => x.id)).toEqual([9]);
  });

  it('separa los renglones por persona', () => {
    const l = (persona: string | null): LineaCliente => ({ nombre: 'Taco', cantidad: 1, subtotal: 15, persona, detalle: null, nota: null });
    expect(lineasPorPersona([l('Hugo'), l('Hugo'), l('Luis')]).map((g) => [g.persona, g.lineas.length])).toEqual([['Hugo', 2], ['Luis', 1]]);
    expect(lineasPorPersona([l(null)]).map((g) => g.persona)).toEqual([null]);
  });
});
