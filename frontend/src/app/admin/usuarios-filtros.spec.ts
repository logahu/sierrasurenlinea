import { ClienteAdmin, Usuario } from './admin.model';
import { EQUIPO_POR_OMISION, filtrarEquipo, juntarPaginas, plano, telefonoLegible } from './usuarios-filtros';

const u = (id: number, nombre: string, rol: Usuario['rol'], extra: Partial<Usuario> = {}): Usuario => ({
  id, nombre, rol, correo: null, telefono: `95100000${String(id).padStart(2, '0')}`, negocioSlug: null, negocioNombre: null,
  activo: true, bloqueado: false, dePrueba: false, creado: `2026-10-${String(id).padStart(2, '0')}T00:00:00Z`, ...extra,
});

const equipo: Usuario[] = [
  u(1, 'Hugo López', 'DUENO'),
  u(2, 'María Flores', 'ENCARGADO', { negocioSlug: 'floreria', negocioNombre: 'Florería' }),
  u(3, 'Mario Cruz', 'REPARTIDOR'),
  u(4, 'Marisol Pérez', 'REPARTIDOR', { negocioSlug: 'vinateria', negocioNombre: 'Vinatería', activo: false }),
  u(5, '🧪 PRUEBA Repartidor 01', 'REPARTIDOR', { dePrueba: true }),
];

describe('filtrarEquipo', () => {
  it('por omisión oculta los inactivos y los de prueba, y cuenta por rol', () => {
    const r = filtrarEquipo(equipo, EQUIPO_POR_OMISION);
    expect(r.lista.map((x) => x.id)).toEqual([1, 2, 3]);
    expect(r.conteos).toEqual({ todos: 3, DUENO: 1, ENCARGADO: 1, REPARTIDOR: 1, EMPLEADO: 0 });
  });

  it('busca sin acentos por nombre, negocio o parte del teléfono', () => {
    const f = { ...EQUIPO_POR_OMISION, estado: 'todos' as const };
    expect(filtrarEquipo(equipo, { ...f, q: 'maria' }).lista.map((x) => x.id)).toEqual([2]);
    expect(filtrarEquipo(equipo, { ...f, q: 'vinateria' }).lista.map((x) => x.id)).toEqual([4]);
    expect(filtrarEquipo(equipo, { ...f, q: '0003' }).lista.map((x) => x.id)).toEqual([3]);
  });

  it('filtra por rol, negocio, estado y cuentas de prueba', () => {
    const f = EQUIPO_POR_OMISION;
    expect(filtrarEquipo(equipo, { ...f, rol: 'REPARTIDOR', prueba: 'mostrar' }).lista.map((x) => x.id)).toEqual([5, 3]);
    expect(filtrarEquipo(equipo, { ...f, negocio: '_general' }).lista.map((x) => x.id)).toEqual([1, 3]);
    expect(filtrarEquipo(equipo, { ...f, estado: 'sin-acceso' }).lista.map((x) => x.id)).toEqual([4]);
    expect(filtrarEquipo(equipo, { ...f, prueba: 'solo' }).lista.map((x) => x.id)).toEqual([5]);
  });

  it('ordena por rol o por alta', () => {
    expect(filtrarEquipo(equipo, { ...EQUIPO_POR_OMISION, orden: 'rol' }).lista.map((x) => x.id)).toEqual([1, 2, 3]);
    expect(filtrarEquipo(equipo, { ...EQUIPO_POR_OMISION, orden: 'alta' }).lista.map((x) => x.id)).toEqual([3, 2, 1]);
  });
});

describe('ayudantes', () => {
  it('plano y teléfono legible', () => {
    expect(plano(' María ')).toBe('maria');
    expect(telefonoLegible('9512345566')).toBe('951 234 5566');
    expect(telefonoLegible(null)).toBe('');
  });

  it('juntarPaginas agrega sin repetir y la página 0 reinicia', () => {
    const c = (id: number) => ({ id }) as ClienteAdmin;
    expect(juntarPaginas([c(1), c(2)], [c(2), c(3)], 1).map((x) => x.id)).toEqual([1, 2, 3]);
    expect(juntarPaginas([c(1), c(2)], [c(9)], 0).map((x) => x.id)).toEqual([9]);
  });
});
