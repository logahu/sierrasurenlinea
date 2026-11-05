export type TipoNegocio = 'VENTA' | 'RENTA' | 'SERVICIO';

export interface Categoria {
  id: number;
  negocioSlug: string;
  slug: string;
  nombre: string;
  descripcion: string | null;
}

export interface Negocio {
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
  /** Solo servicios: cuánto adelanta el repartidor, en MXN. */
  topeAdelanto?: number | null;
  /** Vacío en el listado; con datos en el detalle de un negocio. */
  categorias: Categoria[];
}

export interface Producto {
  id: number;
  nombre: string;
  descripcion: string | null;
  precio: number;
  /** "por día", "por evento"... o null si es precio de venta. */
  unidadPrecio: string | null;
  caracteristicas: string[];
  imagenUrl: string;
  negocioSlug: string;
  negocioNombre: string;
  categoriaSlug: string;
  categoriaNombre: string;
  destacado: boolean;
}
