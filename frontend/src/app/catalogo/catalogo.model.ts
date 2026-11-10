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
  /** Si se muestra dentro de la app de Google Play (en la web siempre). */
  visibleApp?: boolean;
  /** Solo servicios: cuánto adelanta el repartidor, en MXN. */
  topeAdelanto?: number | null;
  /** Vacío en el listado; con datos en el detalle de un negocio. */
  categorias: Categoria[];
  /** Solo servicios (Encarguitos): tarjetas de "Tu lista del mandado". */
  tiposEncargo?: TipoEncargo[];
}

export type ModoEncargo = 'MANDADO' | 'VIAJE' | 'COMIDA';
export type IconoEncargo = 'bolsa' | 'caja' | 'recibo' | 'estrella' | 'moto' | 'pastilla' | 'llave' | 'plato';

/** Una opción de ¿Qué necesitas? (se edita desde el panel). */
export interface TipoEncargo {
  id: number | string;
  titulo: string;
  ayuda: string | null;
  ejemplo: string | null;
  /** Etiqueta del punto de inicio: "Dónde comprar", "Dónde te recogemos"... */
  etiquetaRecoger: string;
  recogerObligatorio: boolean;
  /** Si implica pagar algo además del envío: pregunta quién paga la compra. */
  manejaDinero: boolean;
  modo: ModoEncargo;
  icono: IconoEncargo;
  /** Sin "lo antes posible": solo con hora reservada. */
  soloProgramado: boolean;
  orden?: number;
  visible?: boolean;
}

export interface Producto {
  id: number;
  nombre: string;
  descripcion: string | null;
  precio: number;
  /** "por día", "por evento"... o null si es precio de venta. */
  unidadPrecio: string | null;
  caracteristicas: string[];
  /** Fotos adicionales, después de la principal. */
  galeria?: string[];
  imagenUrl: string;
  negocioSlug: string;
  negocioNombre: string;
  categoriaSlug: string;
  categoriaNombre: string;
  destacado: boolean;
}

/** Encarguitos: lugar de comida con su menú. */
export interface Restaurante {
  id: number;
  nombre: string;
  descripcion: string | null;
  horario: string | null;
  direccion: string | null;
  imagenUrl: string | null;
  orden: number;
  visible: boolean;
  platillos: Platillo[];
}

export interface Platillo {
  id: number;
  nombre: string;
  descripcion: string | null;
  precio: number;
  imagenUrl: string | null;
  orden: number;
  disponible: boolean;
}
