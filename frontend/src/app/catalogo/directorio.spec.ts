import { Giro, Negocio } from './catalogo.model';
import {
  chipsDeGiro, coincide, esNuevo, filtrar, filtrosDeUrl, iniciales, normalizar, ordenar, tipoDe, urlDeFiltros,
} from './directorio';

const giro = (slug: string, nombre: string, orden: number): Giro => ({ slug, nombre, icono: null, orden, negocios: 0 });
const GIROS = [giro('belleza', 'Belleza', 2), giro('flores', 'Flores y regalos', 1), giro('comida', 'Comida', 5)];

function negocio(slug: string, nombre: string, g: Giro, extra: Partial<Negocio> = {}): Negocio {
  return {
    id: slug.length, slug, nombre, eslogan: null, descripcion: null, tipo: 'VENTA', colorPrimario: '#2f6b4f',
    portadaUrl: '', whatsapp: '', telefono: null, direccion: null, horario: null, soloMayoresEdad: false,
    giro: { slug: g.slug, nombre: g.nombre }, ...extra,
  } as Negocio;
}

const LISTA = [
  negocio('turamohoy', 'TuRamoHoy', GIROS[1], { eslogan: 'Flores frescas para cada momento', creadoEn: '2026-11-01T10:00:00' }),
  negocio('belleza', 'Belleza', GIROS[0], { eslogan: 'Maquillaje y perfumes', creadoEn: '2026-11-17T10:00:00' }),
  negocio('melgarejo', 'Estudio Melgarejo', GIROS[0], { eslogan: 'Salón de belleza', creadoEn: '2026-09-01T10:00:00', patrocinado: true }),
  negocio('sanjose', 'Florería San José', GIROS[1], { eslogan: 'Coronas y ramos', creadoEn: '2026-10-01T10:00:00' }),
];

describe('directorio', () => {
  it('busca sin acentos ni mayúsculas en nombre, eslogan y giro', () => {
    expect(normalizar('  Florería   SAN José ')).toBe('floreria san jose');
    expect(filtrar(LISTA, { giro: null, q: 'floreria' }).map((n) => n.slug)).toEqual(['sanjose']);
    expect(filtrar(LISTA, { giro: null, q: 'SALÓN' }).map((n) => n.slug)).toEqual(['melgarejo']);
    // El nombre del giro también cuenta: «regalos» encuentra a las florerías.
    expect(filtrar(LISTA, { giro: null, q: 'regalos' }).map((n) => n.slug)).toEqual(['turamohoy', 'sanjose']);
    // Todas las palabras deben estar.
    expect(coincide(LISTA[3], 'ramos jose')).toBe(true);
    expect(coincide(LISTA[3], 'ramos mezcal')).toBe(false);
    expect(filtrar(LISTA, { giro: null, q: '   ' })).toHaveLength(4);
  });

  it('filtra por giro y combina con la búsqueda', () => {
    expect(filtrar(LISTA, { giro: 'belleza', q: '' }).map((n) => n.slug)).toEqual(['belleza', 'melgarejo']);
    expect(filtrar(LISTA, { giro: 'belleza', q: 'perfume' }).map((n) => n.slug)).toEqual(['belleza']);
    expect(filtrar(LISTA, { giro: 'comida', q: '' })).toEqual([]);
  });

  it('ordena: patrocinados primero, nuevos o A–Z, sin mover la lista original', () => {
    expect(ordenar(LISTA, 'recomendados').map((n) => n.slug)).toEqual(['melgarejo', 'turamohoy', 'belleza', 'sanjose']);
    expect(ordenar(LISTA, 'nuevos').map((n) => n.slug)).toEqual(['belleza', 'turamohoy', 'sanjose', 'melgarejo']);
    expect(ordenar(LISTA, 'az').map((n) => n.slug)).toEqual(['belleza', 'melgarejo', 'sanjose', 'turamohoy']);
    expect(LISTA[0].slug).toBe('turamohoy');
  });

  it('arma los chips en el orden de los giros, sin los vacíos', () => {
    expect(chipsDeGiro(GIROS, LISTA).map((c) => [c.giro.slug, c.negocios])).toEqual([['flores', 2], ['belleza', 2]]);
  });

  it('etiqueta «Nuevo» por 30 días', () => {
    const hoy = new Date('2026-11-18T12:00:00');
    expect(esNuevo(LISTA[1], hoy)).toBe(true);
    expect(esNuevo(LISTA[3], hoy)).toBe(false);
    expect(esNuevo({ ...LISTA[0], creadoEn: null }, hoy)).toBe(false);
  });

  it('tipo e iniciales de la tarjeta', () => {
    expect(tipoDe({ tipo: 'SERVICIO', modoPedido: null })).toBe('Servicio');
    expect(tipoDe({ tipo: 'VENTA', modoPedido: 'CITA' })).toBe('Citas');
    expect(tipoDe({ tipo: 'RENTA', modoPedido: 'RENTA' })).toBe('Renta');
    expect(tipoDe({ tipo: 'VENTA', modoPedido: 'COMPRA' })).toBe('Venta');
    expect(iniciales('Renta de Inflables')).toBe('RI');
    expect(iniciales('TuRamoHoy')).toBe('TU');
    expect(iniciales('Tlayudas Doña Mary')).toBe('TD');
  });

  it('lee y escribe los filtros de la URL', () => {
    expect(filtrosDeUrl({})).toEqual({ giro: null, q: '', orden: 'recomendados' });
    expect(filtrosDeUrl({ giro: 'flores', q: 'rosas', orden: 'nuevos' })).toEqual({ giro: 'flores', q: 'rosas', orden: 'nuevos' });
    expect(filtrosDeUrl({ orden: 'inventado' }).orden).toBe('recomendados');
    expect(urlDeFiltros({ giro: null, q: '  ', orden: 'recomendados' })).toEqual({ giro: null, q: null, orden: null });
    expect(urlDeFiltros({ giro: 'flores', q: 'rosas ', orden: 'az' })).toEqual({ giro: 'flores', q: 'rosas', orden: 'az' });
  });
});
