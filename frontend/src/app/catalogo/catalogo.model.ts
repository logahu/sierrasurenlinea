export type TipoNegocio = 'VENTA' | 'RENTA' | 'SERVICIO';
/** PUBLICO: lo ven todos · PRUEBAS: solo los probadores · OCULTO: nadie (solo el panel). */
export type EstadoNegocio = 'PUBLICO' | 'PRUEBAS' | 'OCULTO';
/** COMPRA: domicilio o recoger · RENTA: fecha del evento · CITA: ver el producto en persona. */
export type ModoPedido = 'COMPRA' | 'RENTA' | 'CITA';

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
  /** true = tiene local para visitas; false = «Atención solo en línea» (sin dirección ni mapa). */
  atencionEnLocal?: boolean;
  colonia?: string | null;
  referencias?: string | null;
  lat?: number | null;
  lng?: number | null;
  soloMayoresEdad: boolean;
  /** Si se muestra dentro de la app de Google Play (en la web siempre). */
  visibleApp?: boolean;
  /** PUBLICO; o PRUEBAS si quien lo ve es un probador (el público no lo recibe). */
  estado?: EstadoNegocio;
  /** Cómo se piden sus productos en línea; null en servicios (Encarguitos). */
  modoPedido?: ModoPedido | null;
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
  /** Grupos de opciones («Carne: elige 1», «Extras»…). Vacío = se pide tal cual. */
  opciones?: GrupoOpciones[];
}

export interface OpcionPlatillo {
  nombre: string;
  /** Lo que se suma al precio del platillo. */
  precio: number;
  disponible: boolean;
}

export interface GrupoOpciones {
  nombre: string;
  /** false = elige una; true = puede elegir varias (hasta «maximo», si hay). */
  multiple: boolean;
  obligatorio: boolean;
  maximo: number | null;
  opciones: OpcionPlatillo[];
}
