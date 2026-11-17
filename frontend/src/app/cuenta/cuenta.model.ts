/** Cuenta de un cliente del sitio (nunca trae la contraseña). */
export interface Cliente {
  id: number;
  nombre: string;
  telefono: string;
  correo: string | null;
  direccion: string | null;
  lat: number | null;
  lng: number | null;
  activo: boolean;
  creado: string;
  ultimoAcceso: string | null;
  /** Ve los negocios en pruebas; sus pedidos se marcan como prueba. */
  probador: boolean;
  /** «avatar:flor», URL de su foto o null (iniciales). */
  avatar?: string | null;
}

export interface SesionCliente {
  token: string;
  /** Fecha ISO en que vence el token. */
  expira: string;
  cliente: Cliente;
}

export interface Registro {
  nombre: string;
  telefono: string;
  contrasena: string;
  correo: string | null;
  aceptaPrivacidad: boolean;
}

export interface MiPedido {
  id: number;
  folio: string;
  negocioNombre: string;
  tipo: string;
  modo: string;
  entrega: 'DOMICILIO' | 'RECOGER';
  entregar: string;
  cuando: string | null;
  totalEstimado: number | null;
  estado: 'NUEVO' | 'ACEPTADO' | 'EN_CAMINO' | 'ENTREGADO' | 'CANCELADO';
  creado: string;
}

export interface LineaCliente {
  nombre: string;
  cantidad: number;
  subtotal: number;
  /** Comida: para quién era, opciones elegidas y nota. */
  persona: string | null;
  detalle: string | null;
  nota: string | null;
}

/** Un pedido en «Mi historial», con su detalle. */
export interface PedidoHistorial extends MiPedido {
  negocioSlug: string;
  colonia: string | null;
  actualizado: string | null;
  lineas: LineaCliente[];
}

export type FiltroHistorial = 'todos' | 'en-curso' | 'entregados' | 'cancelados';

export interface HistorialPedidos {
  pedidos: PedidoHistorial[];
  total: number;
  pagina: number;
  porPagina: number;
  conteos: { todos: number; enCurso: number; entregados: number; cancelados: number };
  /** Suma de lo entregado (aprox.). */
  totalEntregado: number;
}

/** Algo que pasó en la cuenta: lo hizo el cliente (TU) o el equipo (EQUIPO, sin decir quién). */
export interface EventoCuenta {
  cuando: string;
  quien: 'TU' | 'EQUIPO';
  tipo: 'PEDIDO' | 'ESTADO' | 'CUENTA';
  texto: string;
  folio: string | null;
}

export interface ActividadCuenta {
  eventos: EventoCuenta[];
  hayMas: boolean;
  pagina: number;
  registro: string;
}

/** Cómo ve el cliente cada estado de su pedido. */
export const ESTADO_PARA_CLIENTE: Record<MiPedido['estado'], string> = {
  NUEVO: 'Recibido',
  ACEPTADO: 'En preparación',
  EN_CAMINO: 'En camino',
  ENTREGADO: 'Entregado',
  CANCELADO: 'Cancelado',
};

/** Estado en palabras del cliente, según si es a domicilio, para recoger o una cita. */
export function estadoParaCliente(p: Pick<MiPedido, 'estado' | 'modo' | 'entrega'>): string {
  if (p.modo === 'CITA') {
    return { NUEVO: 'Solicitada', ACEPTADO: 'Cita confirmada', EN_CAMINO: 'En visita', ENTREGADO: 'Realizada', CANCELADO: 'Cancelada' }[p.estado];
  }
  if (p.estado === 'EN_CAMINO' && p.entrega === 'RECOGER') return 'Listo para recoger';
  return ESTADO_PARA_CLIENTE[p.estado];
}

/** Mínimo de caracteres de la contraseña (igual que el backend). */
export const MINIMO_CONTRASENA = 10;
