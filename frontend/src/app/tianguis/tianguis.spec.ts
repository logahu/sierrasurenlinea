import {
  enlaceWhatsapp, filtrosDeUrl, valorAtributo, haceCuanto, hayFiltros, idDe, mensajeContacto, precioMxn, textoCondicion, textoPrecio, urlDeFiltros,
  whatsappValido,
} from './tianguis';

describe('tianguis', () => {
  it('precio en pesos, condición y «hace cuánto»', () => {
    expect(precioMxn(85000)).toBe('$85,000');
    expect(precioMxn(1234.5)).toBe('$1,234.50');
    expect(textoCondicion('NUEVO_SIN_USO')).toBe('Nuevo sin usar');
    expect(textoCondicion(null)).toBe('Servicio');
    const hoy = new Date('2026-11-19T12:00:00');
    expect(haceCuanto('2026-11-19T08:00:00', hoy)).toBe('hoy');
    expect(haceCuanto('2026-11-18T23:00:00', hoy)).toBe('ayer');
    expect(haceCuanto('2026-11-14T10:00:00', hoy)).toBe('hace 5 días');
    expect(haceCuanto('2026-10-29T10:00:00', hoy)).toBe('hace 3 semanas');
    expect(haceCuanto('2026-09-01T10:00:00', hoy)).toBe('hace 2 meses');
    expect(haceCuanto(null, hoy)).toBe('');
  });

  it('mensaje y enlace de WhatsApp como pide la spec', () => {
    const m = mensajeContacto('Tsuru 2015', 'https://sierrasurenlinea.com.mx/tianguis/12-tsuru-2015');
    expect(m).toBe('Hola, vi tu anuncio "Tsuru 2015" en Tianguis Sierra Sur (https://sierrasurenlinea.com.mx/tianguis/12-tsuru-2015). ¿Sigue disponible?');
    expect(enlaceWhatsapp('529511234567', 'Hola y adiós')).toBe('https://wa.me/529511234567?text=Hola%20y%20adi%C3%B3s');
  });

  it('precio de artículos y servicios', () => {
    expect(textoPrecio(85000, 'FIJO')).toBe('$85,000');
    expect(textoPrecio(300, 'DESDE')).toBe('Desde $300');
    expect(textoPrecio(null, 'COTIZAR')).toBe('A cotizar');
    expect(mensajeContacto('Plomero', 'https://x/1', true)).toBe('Hola, vi tu servicio "Plomero" en Tianguis Sierra Sur (https://x/1). ¿Me das más información?');
  });

  it('cantidades con unidad', () => {
    expect(valorAtributo('120000', 'km')).toBe('120,000 km');
    expect(valorAtributo('2015', null)).toBe('2015');
    expect(valorAtributo('150', 'cc')).toBe('150 cc');
  });

  it('id desde la URL de la ficha y WhatsApp de 10 dígitos', () => {
    expect(idDe('12-sofa-de-3-plazas')).toBe(12);
    expect(idDe('sofa')).toBeNull();
    expect(whatsappValido('951 123 4567')).toBe(true);
    expect(whatsappValido('+52 1 951 123 4567')).toBe(true);
    expect(whatsappValido('12345')).toBe(false);
  });

  it('filtros en la URL', () => {
    expect(filtrosDeUrl({})).toEqual({ q: '', condicion: null, precioMin: null, precioMax: null, orden: 'recientes' });
    const f = filtrosDeUrl({ q: 'moto', condicion: 'USADO', min: '1000', max: 'x', orden: 'precioAsc' });
    expect(f).toEqual({ q: 'moto', condicion: 'USADO', precioMin: 1000, precioMax: null, orden: 'precioAsc' });
    expect(urlDeFiltros(f)).toEqual({ q: 'moto', condicion: 'USADO', min: 1000, max: null, orden: 'precioAsc' });
    expect(hayFiltros(f)).toBe(true);
    expect(hayFiltros(filtrosDeUrl({ orden: 'precioDesc' }))).toBe(false);
    expect(filtrosDeUrl({ condicion: 'ROTO' }).condicion).toBeNull();
  });
});
