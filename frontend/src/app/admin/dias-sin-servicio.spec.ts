import { BloqueoAgenda } from './admin.model';
import { franjasSinServicio, textoBloqueo } from './agenda-page';
import { festivosDe, proximosFestivos, textoRango } from './dias-sin-servicio';

const b = (inicio: string, fin: string, empleadoId: number | null = null, motivo: string | null = null): BloqueoAgenda => ({
  id: 1, inicio, fin, empleadoId, empleadoNombre: empleadoId ? 'Ana' : null, motivo, citasAfectadas: 0,
});

describe('días sin servicio', () => {
  it('calcula los festivos que se recorren a lunes', () => {
    const f = festivosDe(2027);
    expect(f.find((x) => x.nombre === 'Día de la Constitución')?.fecha).toBe('2027-02-01');
    expect(f.find((x) => x.nombre === 'Natalicio de Benito Juárez')?.fecha).toBe('2027-03-15');
    expect(f.find((x) => x.nombre === 'Revolución Mexicana')?.fecha).toBe('2027-11-15');
  });

  it('sugiere los próximos festivos que no están bloqueados', () => {
    const l = proximosFestivos('2026-11-17', [b('2026-12-12T00:00:00', '2026-12-13T00:00:00')], 3);
    expect(l.map((x) => x.fecha)).toEqual(['2026-12-25', '2027-01-01', '2027-02-01']);
  });

  it('describe el rango', () => {
    expect(textoRango('2026-12-24T00:00:00', '2026-12-25T00:00:00')).toMatch(/^Jueves,? 24 de diciembre, todo el día$/);
    expect(textoRango('2026-12-24T00:00:00', '2026-12-27T00:00:00')).toBe('24 al 26 de diciembre');
    expect(textoRango('2026-11-30T00:00:00', '2026-12-03T00:00:00')).toBe('30 de noviembre al 2 de diciembre');
    expect(textoRango('2026-11-20T15:00:00', '2026-11-20T19:00:00')).toMatch(/20 de noviembre, 15:00 a 19:00$/);
  });

  it('recorta las franjas al día y separa por persona', () => {
    const l = [b('2026-11-16T00:00:00', '2026-11-18T00:00:00', null, 'Cierre'), b('2026-11-17T12:00:00', '2026-11-17T14:00:00', 5)];
    expect(franjasSinServicio(l, '2026-11-17', 5)).toEqual([
      { desde: 0, hasta: 1440, motivo: 'Cierre', deTodos: true },
      { desde: 720, hasta: 840, motivo: null, deTodos: false },
    ]);
    expect(franjasSinServicio(l, '2026-11-17', 6)).toHaveLength(1);
    expect(franjasSinServicio(l, '2026-11-18', 5)).toHaveLength(0);
    expect(textoBloqueo(l[1], '2026-11-17')).toBe('Sin servicio de 12:00 a 14:00 · Ana');
    expect(textoBloqueo(l[0], '2026-11-17')).toBe('Sin servicio · Cierre');
  });
});
