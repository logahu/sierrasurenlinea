import { menuDe, principales, secundarias } from './menu-panel';

const textos = (g: ReturnType<typeof menuDe>) => g.map((x) => [x.titulo, x.opciones.map((o) => o.texto)]);

describe('menú del panel', () => {
  it('el administrador ve todo, agrupado', () => {
    const m = menuDe({ rol: 'DUENO', veAgenda: true, veTianguis: true });
    expect(textos(m)).toEqual([
      ['Día a día', ['Inicio', 'Pedidos', 'Agenda', 'Tianguis']],
      ['Negocios', ['Mis negocios']],
      ['El sitio', ['Portada y publicidad', 'Colonias y envíos']],
      ['Personas y números', ['Usuarios', 'Tablero', 'Historial']],
    ]);
    expect(principales(m).map((o) => o.texto)).toEqual(['Inicio', 'Pedidos', 'Agenda', 'Mis negocios']);
    expect(textos(secundarias(m))).toEqual([
      ['Día a día', ['Tianguis']],
      ['El sitio', ['Portada y publicidad', 'Colonias y envíos']],
      ['Personas y números', ['Usuarios', 'Tablero', 'Historial']],
    ]);
  });

  it('el encargado ve su negocio y no lo del sitio ni usuarios', () => {
    const m = menuDe({ rol: 'ENCARGADO', negocioSlug: 'turamohoy', veAgenda: false, veTianguis: false });
    expect(textos(m)).toEqual([
      ['Día a día', ['Inicio', 'Pedidos']],
      ['Negocios', ['Mi negocio']],
      ['Personas y números', ['Tablero', 'Historial']],
    ]);
    expect(m[1].opciones[0].ruta).toBe('/admin/negocios/turamohoy');
  });

  it('empleado y repartidor ven lo mínimo', () => {
    expect(textos(menuDe({ rol: 'EMPLEADO', negocioSlug: 'x', veAgenda: true, veTianguis: false }))).toEqual([['Día a día', ['Mi agenda']]]);
    expect(textos(menuDe({ rol: 'REPARTIDOR', veAgenda: false, veTianguis: false }))).toEqual([['Día a día', ['Pedidos']]]);
  });
});
