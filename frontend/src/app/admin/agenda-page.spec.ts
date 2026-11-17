import { CitaAgenda } from './admin.model';
import { citasPorDia, hora, nombreDelDia, sumarDias } from './agenda-page';
import { diasDesde, horarioDesde } from './equipo-page';

const c = (inicio: string): CitaAgenda => ({
  pedidoId: 1, folio: 'X', estado: 'NUEVO', inicio, fin: inicio, empleadoId: 1, empleadoNombre: 'Ana',
  clienteNombre: 'Rosa', clienteTelefono: '9511234567', servicios: [], notas: null, prueba: false,
});

describe('agenda del panel', () => {
  it('fechas, nombres de día y horas', () => {
    expect(sumarDias('2026-11-30', 1)).toBe('2026-12-01');
    expect(nombreDelDia('2026-11-16', '2026-11-16')).toBe('Hoy');
    expect(nombreDelDia('2026-11-17', '2026-11-16')).toBe('Mañana');
    expect(hora('2026-11-18T10:00:00')).toBe('10:00');
  });

  it('agrupa por día incluyendo los días sin citas', () => {
    const g = citasPorDia([c('2026-11-16T10:00:00'), c('2026-11-18T12:00:00')], '2026-11-16', 3);
    expect(g.map((x) => [x.fecha, x.citas.length])).toEqual([['2026-11-16', 1], ['2026-11-17', 0], ['2026-11-18', 1]]);
  });

  it('el horario va y viene del formulario', () => {
    const conf = { activa: true, minutosCita: 60, horario: { '1': ['10:00', '19:00'] as [string, string], '7': null } };
    const dias = diasDesde(conf);
    expect(dias[0]).toEqual({ dia: 1, abierto: true, abre: '10:00', cierra: '19:00' });
    expect(dias[6].abierto).toBe(false);
    expect(horarioDesde(dias)['1']).toEqual(['10:00', '19:00']);
    expect(horarioDesde(dias)['7']).toBeNull();
  });
});
