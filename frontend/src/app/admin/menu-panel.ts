import { Rol } from './admin.model';

/** Contador que se muestra junto a una opción. */
export type Contador = 'pedidos' | 'tianguis';

export interface OpcionMenu {
  texto: string;
  ruta: string;
  /** Marcada solo si la ruta coincide exacta (Inicio). */
  exacta?: boolean;
  contador?: Contador;
  icono: string;
  /** Va en la barra de abajo del celular (las demás, en «Más»). */
  principal?: boolean;
}

export interface GrupoMenu {
  titulo: string;
  opciones: OpcionMenu[];
}

export interface QuienEntra {
  rol: Rol;
  /** Slug del negocio del encargado o empleado. */
  negocioSlug?: string | null;
  veAgenda: boolean;
  veTianguis: boolean;
}

/**
 * Menú del panel, agrupado por intención y según quién entra:
 * día a día · negocios · el sitio · personas y números. Los grupos vacíos no salen.
 */
export function menuDe(q: QuienEntra): GrupoMenu[] {
  const dueno = q.rol === 'DUENO';
  const encargado = q.rol === 'ENCARGADO';
  const empleado = q.rol === 'EMPLEADO';
  const grupos: GrupoMenu[] = [
    {
      titulo: 'Día a día',
      opciones: [
        ...(dueno || encargado ? [{ texto: 'Inicio', ruta: '/admin', exacta: true, icono: 'casa', principal: true }] : []),
        ...(!empleado ? [{ texto: 'Pedidos', ruta: '/admin/pedidos', contador: 'pedidos' as const, icono: 'pedidos', principal: true }] : []),
        ...(q.veAgenda ? [{ texto: empleado ? 'Mi agenda' : 'Agenda', ruta: '/admin/agenda', icono: 'agenda', principal: true }] : []),
        ...(q.veTianguis ? [{ texto: 'Tianguis', ruta: '/admin/tianguis', contador: 'tianguis' as const, icono: 'tianguis' }] : []),
      ],
    },
    {
      titulo: 'Negocios',
      opciones: dueno
        ? [{ texto: 'Mis negocios', ruta: '/admin/negocios', icono: 'negocio', principal: true }]
        : encargado && q.negocioSlug
          ? [{ texto: 'Mi negocio', ruta: `/admin/negocios/${q.negocioSlug}`, icono: 'negocio', principal: true }]
          : [],
    },
    {
      titulo: 'El sitio',
      opciones: dueno
        ? [
            { texto: 'Portada y publicidad', ruta: '/admin/publicidad', icono: 'portada' },
            { texto: 'Colonias y envíos', ruta: '/admin/colonias', icono: 'colonias' },
          ]
        : [],
    },
    {
      titulo: 'Personas y números',
      opciones: [
        ...(dueno ? [{ texto: 'Usuarios', ruta: '/admin/usuarios', icono: 'personas' }] : []),
        ...(dueno || encargado
          ? [
              { texto: 'Tablero', ruta: '/admin/tablero', icono: 'tablero' },
              { texto: 'Historial', ruta: '/admin/historial', icono: 'historial' },
            ]
          : []),
      ],
    },
  ];
  return grupos.filter((g) => g.opciones.length);
}

/** Las opciones de la barra de abajo del celular (máximo 4; el resto va en «Más»). */
export function principales(grupos: GrupoMenu[]): OpcionMenu[] {
  return grupos.flatMap((g) => g.opciones).filter((o) => o.principal).slice(0, 4);
}

/** Lo que va en la hoja «Más» del celular, agrupado. */
export function secundarias(grupos: GrupoMenu[]): GrupoMenu[] {
  const arriba = new Set(principales(grupos));
  return grupos
    .map((g) => ({ ...g, opciones: g.opciones.filter((o) => !arriba.has(o)) }))
    .filter((g) => g.opciones.length);
}
