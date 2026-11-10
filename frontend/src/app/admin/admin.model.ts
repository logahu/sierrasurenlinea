import { TipoNegocio } from '../catalogo/catalogo.model';

export type Rol = 'DUENO' | 'ENCARGADO' | 'REPARTIDOR';

export interface Usuario {
  id: number;
  correo: string;
  nombre: string;
  rol: Rol;
  negocioSlug: string | null;
  negocioNombre: string | null;
  activo: boolean;
  bloqueado: boolean;
}

export interface Sesion {
  token: string;
  /** Fecha ISO en que vence el token. */
  expira: string;
  usuario: Usuario;
}

export interface NegocioAdmin {
  id: number;
  slug: string;
  nombre: string;
  eslogan: string | null;
  descripcion: string | null;
  tipo: TipoNegocio;
  colorPrimario: string;
  portadaUrl: string;
  whatsapp: string;
  telefono: string | null;
  direccion: string | null;
  horario: string | null;
  soloMayoresEdad: boolean;
  visible: boolean;
  /** Si se muestra dentro de la app de Google Play. */
  visibleApp: boolean;
  topeAdelanto: number | null;
  orden: number;
  productosActivos: number;
  /** Nombre del encargado activo, si tiene. */
  encargado: string | null;
}

/** Lo que se manda al guardar un negocio. */
export type NegocioEdicion = Pick<
  NegocioAdmin,
  'nombre' | 'eslogan' | 'descripcion' | 'whatsapp' | 'telefono' | 'direccion' | 'horario' | 'colorPrimario' | 'visible' | 'topeAdelanto' | 'portadaUrl'
>;

export interface CategoriaAdmin {
  id: number;
  slug: string;
  nombre: string;
  descripcion: string | null;
  orden: number;
  /** Cuántos productos tiene (visibles y ocultos). */
  productos: number;
}

export interface ProductoAdmin {
  id: number;
  nombre: string;
  descripcion: string | null;
  precio: number;
  unidadPrecio: string | null;
  caracteristicas: string[];
  imagenUrl: string;
  galeria: string[];
  categoriaId: number;
  categoriaNombre: string;
  destacado: boolean;
  disponible: boolean;
}

export interface ProductoEdicion {
  nombre: string;
  descripcion: string;
  precio: number;
  unidadPrecio: string;
  caracteristicas: string[];
  categoriaId: number;
  destacado: boolean;
  disponible: boolean;
  /** Foto nueva; null = no cambia. */
  imagenUrl: string | null;
  /** Fotos adicionales en orden. */
  galeria: string[];
}

export interface CategoriaEdicion {
  nombre: string;
  descripcion: string;
  orden?: number | null;
}

export type EstadoPedido = 'NUEVO' | 'ACEPTADO' | 'EN_CAMINO' | 'ENTREGADO' | 'CANCELADO';

export interface Pedido {
  id: number;
  folio: string;
  negocioSlug: string;
  negocioNombre: string;
  tipo: string;
  modo: 'MANDADO' | 'VIAJE' | 'COMIDA';
  clienteNombre: string;
  clienteTelefono: string;
  entregar: string;
  zona: string | null;
  totalEstimado: number | null;
  mensaje: string;
  estado: EstadoPedido;
  repartidorId: number | null;
  repartidorNombre: string | null;
  creado: string;
  actualizado: string;
}
