import { Giro, Negocio } from './catalogo.model';
import { MAX_FACHADAS, callesPorGiro, fachadasDe, filtrarCalles, indiceBannerEntreCalles } from './calles';

const giro = (slug: string, orden: number): Giro => ({ slug, nombre: slug.toUpperCase(), icono: null, orden, negocios: 0 });
const negocio = (slug: string, g: string | null): Negocio =>
  ({ id: slug.length, slug, nombre: slug, giro: g ? { slug: g, nombre: g } : null }) as unknown as Negocio;

const giros = [giro('belleza', 2), giro('flores', 1), giro('comida', 5)];

describe('calles por giro', () => {
  it('agrupa por giro en el orden de los giros y omite los giros vacíos', () => {
    const calles = callesPorGiro(giros, [negocio('belleza', 'belleza'), negocio('turamohoy', 'flores'), negocio('melgarejo', 'belleza')]);
    expect(calles.map((c) => c.giro.slug)).toEqual(['flores', 'belleza']);
    expect(calles[1].negocios.map((n) => n.slug)).toEqual(['belleza', 'melgarejo']);
  });

  it('los negocios sin giro conocido van al final, en «Otros negocios»', () => {
    const calles = callesPorGiro(giros, [negocio('x', null), negocio('y', 'inventado'), negocio('turamohoy', 'flores')]);
    expect(calles.map((c) => c.giro.slug)).toEqual(['flores', 'otros']);
    expect(calles[1].negocios).toHaveLength(2);
  });

  it('filtra por el giro elegido; si no existe, muestra todas', () => {
    const calles = callesPorGiro(giros, [negocio('belleza', 'belleza'), negocio('turamohoy', 'flores')]);
    expect(filtrarCalles(calles, 'belleza').map((c) => c.giro.slug)).toEqual(['belleza']);
    expect(filtrarCalles(calles, null)).toHaveLength(2);
    expect(filtrarCalles(calles, 'no-existe')).toHaveLength(2);
  });

  it('una calle enseña hasta 6 fachadas y cuenta el resto para «Ver todos»', () => {
    expect(MAX_FACHADAS).toBe(6);
    const muchos = Array.from({ length: 9 }, (_, i) => negocio('n' + i, 'flores'));
    const [calle] = callesPorGiro(giros, muchos);
    const { visibles, resto } = fachadasDe(calle);
    expect(visibles.map((n) => n.slug)).toEqual(['n0', 'n1', 'n2', 'n3', 'n4', 'n5']);
    expect(resto).toBe(3);
    expect(fachadasDe({ ...calle, negocios: muchos.slice(0, 6) }).resto).toBe(0);
  });

  it('el banner entre calles va después de la segunda calle', () => {
    expect(indiceBannerEntreCalles(5)).toBe(1);
    expect(indiceBannerEntreCalles(1)).toBe(0);
  });
});
