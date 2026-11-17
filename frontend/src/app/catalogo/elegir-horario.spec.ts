import { duracion, iniciales, porFranja, sumarMinutos, tarjetaDia, textoCita } from './elegir-horario';

describe('elegir horario', () => {
  it('suma minutos y arma el texto de la cita', () => {
    expect(sumarMinutos('11:00', 120)).toBe('13:00');
    expect(sumarMinutos('18:30', 45)).toBe('19:15');
    expect(textoCita('2026-11-17', '11:00', 120, 'Ana')).toMatch(/^Martes,? 17 de noviembre, 11:00 a 13:00 con Ana$/);
    expect(textoCita('2026-11-17', '11:00', 60, null)).toMatch(/17 de noviembre, 11:00 a 12:00$/);
  });

  it('dice la duración en horas o minutos', () => {
    expect(duracion(60)).toBe('1 hora');
    expect(duracion(120)).toBe('2 horas');
    expect(duracion(90)).toBe('90 minutos');
  });

  it('agrupa las horas en mañana, tarde y noche', () => {
    const h = (hora: string) => ({ hora, libres: [1] });
    const f = porFranja([h('10:00'), h('11:00'), h('12:00'), h('18:00'), h('19:00')]);
    expect(f.map((x) => [x.nombre, x.horarios.length])).toEqual([['Mañana', 2], ['Tarde', 2], ['Noche', 1]]);
    expect(porFranja([h('15:00')]).map((x) => x.nombre)).toEqual(['Tarde']);
  });

  it('tarjeta del día e iniciales', () => {
    expect(tarjetaDia('2026-11-17', 'Hoy')).toEqual({ arriba: 'Hoy', numero: 17 });
    expect(tarjetaDia('2026-11-19', 'Jue 19').numero).toBe(19);
    expect(tarjetaDia('2026-11-19', 'Jue 19').arriba).toMatch(/^Jue/);
    expect(iniciales('Ana María')).toBe('AM');
  });
});
