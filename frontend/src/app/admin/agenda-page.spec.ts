import { CitaAgenda } from './admin.model';
import {
  citasPorDia, colorDeCategoria, diaDeLaSemana, hora, huecosLibres, iniciales, minutos, nombreDelDia, rangoDelDia,
  siguientePasoCita, sumarDias,
} from './agenda-page';
import { diasDesde, horarioDesde } from './equipo-page';

const c = (inicio: string, fin = inicio): CitaAgenda => ({
  pedidoId: 1, folio: 'X', estado: 'NUEVO', inicio, fin, empleadoId: 1, empleadoNombre: 'Ana',
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

  it('tablero del día: horas, huecos libres y colores', () => {
    expect(minutos('10:30')).toBe(630);
    expect(minutos('2026-11-17T13:15:00')).toBe(795);
    expect(diaDeLaSemana('2026-11-16')).toBe(1); // lunes
    expect(diaDeLaSemana('2026-11-22')).toBe(7); // domingo
    const horario = { '1': ['10:00', '19:00'] as [string, string], '7': null };
    expect(rangoDelDia('2026-11-16', horario, [])).toEqual({ abre: 600, cierra: 1140, abierto: true });
    // Una cita fuera del horario estira el tablero; el domingo está cerrado.
    expect(rangoDelDia('2026-11-16', horario, [c('2026-11-16T09:30:00', '2026-11-16T10:30:00')]).abre).toBe(540);
    expect(rangoDelDia('2026-11-22', horario, []).abierto).toBe(false);

    const citas = [c('2026-11-16T11:00:00', '2026-11-16T13:00:00')];
    expect(huecosLibres(citas, 600, 900, 60, null)).toEqual([600, 780, 840]);
    expect(huecosLibres(citas, 600, 900, 60, 790)).toEqual([840]);

    expect(colorDeCategoria('Barba', ['Cortes', 'Barba'])).toBe(1);
    expect(colorDeCategoria('Otra', ['Cortes'])).toBe(-1);
    expect(colorDeCategoria(null, ['Cortes'])).toBe(-1);
    expect(iniciales('Ana María López')).toBe('AM');
    expect(iniciales('Gabriela')).toBe('G');
  });

  it('siguiente paso de una cita', () => {
    expect(siguientePasoCita('NUEVO')?.estado).toBe('ACEPTADO');
    expect(siguientePasoCita('EN_CAMINO')?.texto).toBe('Marcar realizada');
    expect(siguientePasoCita('ENTREGADO')).toBeNull();
  });
});
