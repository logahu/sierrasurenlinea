export interface Categoria {
  id: number;
  slug: string;
  nombre: string;
  descripcion: string | null;
}

export interface Producto {
  id: number;
  nombre: string;
  descripcion: string | null;
  precio: number;
  imagenUrl: string;
  categoriaSlug: string;
  categoriaNombre: string;
  destacado: boolean;
}
