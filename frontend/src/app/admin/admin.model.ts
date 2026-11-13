import { TipoNegocio } from '../catalogo/catalogo.model';

export type Rol = 'DUENO' | 'ENCARGADO' | 'REPARTIDOR';

export interface Usuario {
  id: number;
  /** Opcional: se puede entrar con el teléfono o con el correo. */
  correo: string | null;
  telefono: string | null;
  nombre: string;
  rol: Rol;
  negocioSlug: string | null;
  negocioNombre: string | null;
  activo: boolean;
  bloqueado: boolean;
  /** Creada con «Crear usuarios de prueba». */
  dePrueba?: boolean;
  creado?: string;
  /** Pedidos entregados (repartidores). */
  entregas?: number;
}

/** Tablero de visitas y pedidos. */
export interface Tablero {
  dias: number;
  desde: string;
  hasta: string;
  visitas: number;
  visitasPrevias: number;
  pedidos: number;
  pedidosPrevios: number;
  entregados: number;
  cancelados: number;
  ventas: number;
  serie: { dia: string; visitas: number; pedidos: number }[];
  negocios: { slug: string; nombre: string; color: string; visitas: number; pedidos: number; entregados: number; ventas: number }[];
  productos: { id: number; nombre: string; negocioSlug: string; negocioNombre: string; visitas: number }[];
  paginas: { ruta: string; visitas: number }[];
}

/** Un renglón del historial de cambios. */
export interface RenglonHistorial {
  id: number;
  cuando: string;
  actorTipo: 'USUARIO' | 'CLIENTE' | 'SISTEMA';
  actorNombre: string;
  negocioSlug: string | null;
  negocioNombre: string | null;
  entidad: string;
  entidadId: number | null;
  accion: string;
  detalle: string | null;
}

export interface PaginaHistorial {
  renglones: RenglonHistorial[];
  hayMas: boolean;
}

/** Una foto subida a R2 y dónde se usa. */
export interface FotoAdmin {
  id: number;
  url: string;
  tipo: string;
  bytes: number;
  subida: string;
  subidaPor: string | null;
  usos: string[];
}

export interface FotosNegocio {
  fotos: FotoAdmin[];
  bytesEnUso: number;
  bytesSinUsar: number;
  borradas: number;
  bytesLiberados: number;
}

/** Cliente registrado en el sitio, visto desde el panel. */
/** Fila de «Crear usuarios de prueba». La contraseña solo llega una vez. */
export interface CuentaDePrueba {
  tipo: 'Cliente' | 'Encargado' | 'Repartidor';
  nombre: string;
  telefono: string | null;
  contrasena: string | null;
  negocio: string | null;
  estado: string;
}

export interface ClienteAdmin {
  id: number;
  nombre: string;
  telefono: string;
  correo: string | null;
  direccion: string | null;
  activo: boolean;
  creado: string;
  ultimoAcceso: string | null;
  pedidos: number;
  /** Ve los negocios en pruebas; sus pedidos se marcan como prueba. */
  probador: boolean;
  dePrueba?: boolean;
}

export interface PaginaClientes {
  clientes: ClienteAdmin[];
  total: number;
  pagina: number;
  porPagina: number;
  conteos: { todos: number; probadores: number; dePrueba: number; sinAcceso: number };
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
  /** true solo si es público (compatibilidad). */
  visible: boolean;
  /** PUBLICO, PRUEBAS u OCULTO. */
  estado: 'PUBLICO' | 'PRUEBAS' | 'OCULTO';
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
  'nombre' | 'eslogan' | 'descripcion' | 'whatsapp' | 'telefono' | 'direccion' | 'horario' | 'colorPrimario' | 'topeAdelanto' | 'portadaUrl'
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
  modo: 'MANDADO' | 'VIAJE' | 'COMIDA' | 'COMPRA' | 'RENTA' | 'CITA';
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
  /** DOMICILIO o RECOGER (pasa al negocio). */
  entrega: 'DOMICILIO' | 'RECOGER';
  cuando: string | null;
  notas: string | null;
  /** Renglones del carrito (vacío en encargos). */
  lineas: LineaPedido[];
  /** Pedido de un cliente probador: no cuenta en el tablero. */
  prueba: boolean;
  /** Punto de entrega marcado en el mapa. */
  lat: number | null;
  lng: number | null;
  colonia?: string | null;
  /** El cliente la escribió en «Otra» (está en Colonias → Solicitudes). */
  coloniaOtra?: boolean;
}

export interface ColoniaAdmin {
  id: number;
  nombre: string;
  tipo: string;
  codigoPostal: string | null;
  /** Nombre de la tarifa de Encarguitos. */
  zona: string | null;
  estado: 'ACTIVA' | 'SOLICITADA';
  origen: 'SEPOMEX' | 'ADMIN' | 'CLIENTE';
  solicitudes: number;
  creada: string;
  pedidos: number;
}

export interface DatosColonia {
  nombre: string;
  tipo: string;
  codigoPostal: string;
  zona: string;
}

export interface LineaPedido {
  nombre: string;
  cantidad: number;
  precioUnitario: number;
  unidad: string | null;
  subtotal: number;
  /** Comida: para quién es, opciones elegidas y nota. */
  persona?: string | null;
  detalle?: string | null;
  nota?: string | null;
}
