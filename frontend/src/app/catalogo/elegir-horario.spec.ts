import { duracion, sumarMinutos, textoCita } from './elegir-horario';

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
});
