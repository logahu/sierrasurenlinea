import { ClienteAdmin, Rol, Usuario } from './admin.model';

/** Filtros de la pestaña Equipo (se guardan en la dirección: ?rol=REPARTIDOR&negocio=floreria…). */
export interface FiltrosEquipo {
  q: string;
  rol: 'todos' | Rol;
  /** '' = todos; '_general' = sin negocio (administradores y repartidores de todos). */
  negocio: string;
  estado: 'activos' | 'sin-acceso' | 'bloqueados' | 'todos';
  prueba: 'ocultar' | 'mostrar' | 'solo';
  orden: 'nombre' | 'rol' | 'negocio' | 'alta';
}

export const EQUIPO_POR_OMISION: FiltrosEquipo = {
  q: '', rol: 'todos', negocio: '', estado: 'activos', prueba: 'ocultar', orden: 'nombre',
};

/** Sin acentos ni mayúsculas, para buscar «maria» y encontrar «María». */
export function plano(texto: string | null | undefined): string {
  return (texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** «9512345566» → «951 234 5566». */
export function telefonoLegible(t: string | null | undefined): string {
  return t && /^\d{10}$/.test(t) ? `${t.slice(0, 3)} ${t.slice(3, 6)} ${t.slice(6)}` : (t ?? '');
}

const ORDEN_ROL: Record<Rol, number> = { DUENO: 0, ENCARGADO: 1, EMPLEADO: 2, REPARTIDOR: 3 };

/** Todo menos el rol: así los botones de rol cuentan lo que hay con los demás filtros. */
function pasaSinRol(u: Usuario, f: FiltrosEquipo): boolean {
  const q = plano(f.q);
  if (q) {
    const digitos = q.replace(/\D/g, '');
    const texto = plano(`${u.nombre} ${u.correo ?? ''} ${u.negocioNombre ?? ''}`);
    if (!texto.includes(q) && !(digitos && (u.telefono ?? '').includes(digitos))) return false;
  }
  if (f.negocio === '_general' && u.negocioSlug) return false;
  if (f.negocio && f.negocio !== '_general' && u.negocioSlug !== f.negocio) return false;
  if (f.estado === 'activos' && !u.activo) return false;
  if (f.estado === 'sin-acceso' && u.activo) return false;
  if (f.estado === 'bloqueados' && !u.bloqueado) return false;
  if (f.prueba === 'ocultar' && u.dePrueba) return false;
  if (f.prueba === 'solo' && !u.dePrueba) return false;
  return true;
}

export interface ResultadoEquipo {
  lista: Usuario[];
  /** Por rol, con los demás filtros aplicados. */
  conteos: Record<'todos' | Rol, number>;
}

export function filtrarEquipo(usuarios: Usuario[], f: FiltrosEquipo): ResultadoEquipo {
  const base = usuarios.filter((u) => pasaSinRol(u, f));
  const conteos = { todos: base.length, DUENO: 0, ENCARGADO: 0, REPARTIDOR: 0, EMPLEADO: 0 };
  for (const u of base) conteos[u.rol]++;
  const lista = base.filter((u) => f.rol === 'todos' || u.rol === f.rol);
  const nombre = (a: Usuario, b: Usuario) => a.nombre.localeCompare(b.nombre, 'es');
  const comparar: Record<FiltrosEquipo['orden'], (a: Usuario, b: Usuario) => number> = {
    nombre,
    rol: (a, b) => ORDEN_ROL[a.rol] - ORDEN_ROL[b.rol] || nombre(a, b),
    negocio: (a, b) => (a.negocioNombre ?? '').localeCompare(b.negocioNombre ?? '', 'es') || nombre(a, b),
    alta: (a, b) => (b.creado ?? '').localeCompare(a.creado ?? '') || nombre(a, b),
  };
  return { lista: [...lista].sort(comparar[f.orden]), conteos };
}

/** Filtros de la pestaña Clientes (los aplica el servidor). */
export interface FiltrosClientes {
  q: string;
  /** '' = todos menos los de prueba. */
  grupo: '' | 'probadores' | 'prueba' | 'sin-acceso';
  pedidos: '' | 'con' | 'sin';
  orden: 'recientes' | 'visita' | 'nombre' | 'pedidos';
}

export const CLIENTES_POR_OMISION: FiltrosClientes = { q: '', grupo: '', pedidos: '', orden: 'recientes' };

/** Junta las páginas de «Ver más»; la página 0 empieza de nuevo. */
export function juntarPaginas(anteriores: ClienteAdmin[], nuevos: ClienteAdmin[], pagina: number): ClienteAdmin[] {
  if (pagina === 0) return nuevos;
  const vistos = new Set(anteriores.map((c) => c.id));
  return [...anteriores, ...nuevos.filter((c) => !vistos.has(c.id))];
}
