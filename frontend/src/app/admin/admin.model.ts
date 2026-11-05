import { TipoNegocio } from '../catalogo/catalogo.model';

export type Rol = 'DUENO' | 'ENCARGADO';

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
  topeAdelanto: number | null;
  orden: number;
  productosActivos: number;
  /** Nombre del encargado activo, si tiene. */
  encargado: string | null;
}

/** Lo que se manda al guardar un negocio. */
export type NegocioEdicion = Pick<
  NegocioAdmin,
  'nombre' | 'eslogan' | 'descripcion' | 'whatsapp' | 'telefono' | 'direccion' | 'horario' | 'colorPrimario' | 'visible' | 'topeAdelanto'
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
}

export interface CategoriaEdicion {
  nombre: string;
  descripcion: string;
  orden?: number | null;
}
