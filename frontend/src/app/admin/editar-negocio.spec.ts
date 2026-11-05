import { whatsappLegible, whatsappValido } from './editar-negocio';

describe('WhatsApp en el panel', () => {
  it('se muestra como número local', () => {
    expect(whatsappLegible('525540485363')).toBe('55 4048 5363');
    expect(whatsappLegible('5219511234567')).toBe('951 123 4567');
    expect(whatsappLegible('14155550100')).toBe('14155550100');
    expect(whatsappLegible('9511234567')).toBe('951 123 4567');
  });

  it('acepta 10 dígitos o el número con lada de país', () => {
    expect(whatsappValido('55 4048 5363')).toBe(true);
    expect(whatsappValido('+52 55 4048 5363')).toBe(true);
    expect(whatsappValido('5540')).toBe(false);
  });
});
