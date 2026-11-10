/** Cuenta de un cliente del sitio (nunca trae la contraseña). */
export interface Cliente {
  id: number;
  nombre: string;
  telefono: string;
  correo: string | null;
  direccion: string | null;
  activo: boolean;
  creado: string;
  ultimoAcceso: string | null;
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
  entregar: string;
  totalEstimado: number | null;
  estado: 'NUEVO' | 'ACEPTADO' | 'EN_CAMINO' | 'ENTREGADO' | 'CANCELADO';
  creado: string;
}

/** Cómo ve el cliente cada estado de su pedido. */
export const ESTADO_PARA_CLIENTE: Record<MiPedido['estado'], string> = {
  NUEVO: 'Recibido',
  ACEPTADO: 'En preparación',
  EN_CAMINO: 'En camino',
  ENTREGADO: 'Entregado',
  CANCELADO: 'Cancelado',
};

/** Mínimo de caracteres de la contraseña (igual que el backend). */
export const MINIMO_CONTRASENA = 10;
