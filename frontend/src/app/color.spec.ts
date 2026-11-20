import { acentoLegible, contrasteConBlanco } from './color';

describe('acentoLegible', () => {
  it('deja igual un color que ya se lee con texto blanco', () => {
    expect(acentoLegible('#1a1a1a')).toBe('#1a1a1a');
    expect(acentoLegible('#2f6b4f')).toBe('#2f6b4f');
  });

  it('oscurece un color claro hasta contraste 4.5:1', () => {
    const c = acentoLegible('#faf8f4')!;
    expect(c).not.toBe('#faf8f4');
    expect(contrasteConBlanco(c)).toBeGreaterThanOrEqual(4.5);
    expect(contrasteConBlanco(acentoLegible('#ffd400')!)).toBeGreaterThanOrEqual(4.5);
  });

  it('un color inválido regresa null', () => {
    expect(acentoLegible('')).toBeNull();
    expect(acentoLegible(null)).toBeNull();
    expect(acentoLegible('rojo')).toBeNull();
  });
});
