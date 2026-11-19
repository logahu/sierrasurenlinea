/** Tianguis Sierra Sur: compra-venta de artículos nuevos y usados, y servicios de particulares. */

export type Condicion = 'NUEVO_SIN_USO' | 'SEMINUEVO' | 'USADO' | 'REPARADO';
export type EstadoAnuncio = 'PENDIENTE' | 'PUBLICADO' | 'VENDIDO' | 'VENCIDO' | 'RECHAZADO' | 'PAUSADO';
export type OrdenTianguis = 'recientes' | 'precioAsc' | 'precioDesc';
/** Artículo: se vende una cosa. Servicio: sin condición, precio fijo/desde/a cotizar, fotos opcionales. */
export type TipoCategoria = 'ARTICULO' | 'SERVICIO';
export type TipoPrecio = 'FIJO' | 'DESDE' | 'COTIZAR';
export type TipoCampo = 'TEXTO' | 'NUMERO' | 'OPCION' | 'SI_NO';

export interface CampoAtributo {
  nombre: string;
  etiqueta: string;
  tipo: TipoCampo;
  requerido: boolean;
  opciones?: string[] | null;
  unidad?: string | null;
}

export interface CategoriaTianguis {
  id: number;
  nombre: string;
  slug: string;
  icono: string | null;
  orden: number;
  activa: boolean;
  tipo: TipoCategoria;
  campos: CampoAtributo[];
  anuncios: number;
}

export interface CategoriaCorta {
  slug: string;
  nombre: string;
  icono: string | null;
  tipo: TipoCategoria;
}

export interface AnuncioResumen {
  id: number;
  idSlug: string;
  titulo: string;
  /** null solo si es «a cotizar». */
  precio: number | null;
  tipoPrecio: TipoPrecio;
  negociable: boolean;
  /** null en servicios. */
  condicion: Condicion | null;
  estado: EstadoAnuncio;
  portada: string | null;
  categoria: CategoriaCorta;
  ubicacion: string;
  fechaPublicacion: string | null;
  fechaVendido: string | null;
}

export interface Atributo {
  nombre: string;
  etiqueta: string;
  valor: string;
  unidad: string | null;
}

export interface AnuncioDetalle extends Omit<AnuncioResumen, 'portada'> {
  descripcion: string;
  fotos: string[];
  atributos: Atributo[];
  vendedor: { nombre: string; whatsapp: string; verificado: boolean };
  vistas: number;
}

export interface Pagina<T> {
  anuncios: T[];
  total: number;
  pagina: number;
  tamano: number;
  paginas: number;
}

export interface Publicacion {
  categoria: string;
  titulo: string;
  descripcion: string;
  /** null solo si es «a cotizar». */
  precio: number | null;
  tipoPrecio: TipoPrecio;
  negociable: boolean;
  /** null en servicios. */
  condicion: Condicion | null;
  atributos: Record<string, string>;
  ubicacion: string;
  fotos: string[];
  vendedorNombre: string;
  vendedorWhatsapp: string;
  aceptaReglas: boolean;
  /** Campo trampa: siempre vacío. */
  sitioWeb: string;
}

export interface Publicado {
  id: number;
  token: string;
  estado: EstadoAnuncio;
}

export interface Gestion {
  id: number;
  idSlug: string;
  titulo: string;
  descripcion: string;
  /** null solo si es «a cotizar». */
  precio: number | null;
  tipoPrecio: TipoPrecio;
  negociable: boolean;
  /** null en servicios. */
  condicion: Condicion | null;
  estado: EstadoAnuncio;
  fotos: string[];
  categoria: CategoriaCorta;
  atributos: Record<string, string>;
  ubicacion: string;
  vendedorNombre: string;
  vendedorWhatsapp: string;
  motivoRechazo: string | null;
  pausadoPor: string | null;
  fechaCreacion: string;
  fechaPublicacion: string | null;
  fechaVencimiento: string | null;
  fechaVendido: string | null;
  renovaciones: number;
  renovacionesRestantes: number;
  vistas: number;
  puedeEditar: boolean;
  puedePausar: boolean;
  puedeReanudar: boolean;
  puedeRenovar: boolean;
  puedeMarcarVendido: boolean;
  vendedorBloqueado: boolean;
}

export type MotivoReporte = 'FRAUDE' | 'PROHIBIDO' | 'VENDIDO' | 'FALSO' | 'OTRO';
