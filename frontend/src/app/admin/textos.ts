import { TipoNegocio } from '../catalogo/catalogo.model';

/** Cómo se llama el catálogo según el tipo de negocio (en Encarguitos son tarifas por zona). */
export interface TextosCatalogo {
  plural: string;
  singular: string;
  /** Sugerencias para "unidad del precio". Vacío = precio de venta normal. */
  unidades: string[];
  ayudaUnidad: string;
}

export function textosCatalogo(tipo: TipoNegocio | undefined): TextosCatalogo {
  switch (tipo) {
    case 'SERVICIO':
      return {
        plural: 'Tarifas',
        singular: 'tarifa',
        unidades: ['por mandado', 'extra'],
        ayudaUnidad: '"por mandado" para cada zona; "extra" para cargos adicionales.',
      };
    case 'RENTA':
      return {
        plural: 'Productos',
        singular: 'producto',
        unidades: ['por día', 'por evento', 'por hora'],
        ayudaUnidad: 'Cómo se cobra la renta, p. ej. "por día".',
      };
    default:
      return {
        plural: 'Productos',
        singular: 'producto',
        unidades: [],
        ayudaUnidad: 'Déjalo vacío si es un precio de venta normal.',
      };
  }
}

/** Características: una por renglón en pantalla, lista en la API. */
export function renglones(texto: string): string[] {
  return texto
    .split('\n')
    .map((s) => s.trim())
    // Renglones de la plantilla que se quedaron sin llenar ("Año:", "Kilometraje:  km").
    .filter((s) => s.length > 0 && !/^[^:]+:\s*(km)?$/i.test(s));
}

/** Renglones sugeridos al dar de alta un producto, por negocio (slug). */
export const PLANTILLAS_CARACTERISTICAS: Record<string, string[]> = {
  autos: ['Año: ', 'Kilometraje:  km', 'Transmisión: ', 'Combustible: ', 'Motor: ', 'Color: ', 'Reparaciones: '],
  'estudio-melgarejo': ['Duración: 1 hora', 'Incluye: ', 'Incluye: '],
};
