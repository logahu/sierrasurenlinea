/** Tianguis Sierra Sur: compra-venta de segunda mano. */

export type Condicion = 'NUEVO_SIN_USO' | 'SEMINUEVO' | 'USADO' | 'REPARADO';
export type EstadoAnuncio = 'PENDIENTE' | 'PUBLICADO' | 'VENDIDO' | 'VENCIDO' | 'RECHAZADO' | 'PAUSADO';
export type OrdenTianguis = 'recientes' | 'precioAsc' | 'precioDesc';
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
  campos: CampoAtributo[];
  anuncios: number;
}

export interface CategoriaCorta {
  slug: string;
  nombre: string;
  icono: string | null;
}

export interface AnuncioResumen {
  id: number;
  idSlug: string;
  titulo: string;
  precio: number;
  negociable: boolean;
  condicion: Condicion;
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
  precio: number;
  negociable: boolean;
  condicion: Condicion;
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
  precio: number;
  negociable: boolean;
  condicion: Condicion;
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
