import { colorSeVe } from '../color';
import { NegocioAdmin } from './admin.model';
import { textosCatalogo } from './textos';

/** Un paso para que el negocio quede completo, con a dónde ir a resolverlo. */
export interface PasoConfiguracion {
  clave: string;
  texto: string;
  listo: boolean;
  /** Ruta dentro del negocio (relativa a /admin/negocios/:slug). */
  seccion: string;
  accion: string;
  /** Solo el administrador lo puede resolver. */
  soloDueno?: boolean;
}

/**
 * Qué le falta a un negocio, en el orden en que conviene hacerlo. Lo opcional (Google, frase corta,
 * descripción) no cuenta: solo lo que el cliente nota si falta.
 */
export function pasosDe(n: NegocioAdmin): PasoConfiguracion[] {
  const textos = textosCatalogo(n.tipo);
  const color = colorSeVe(n.colorPrimario);
  const pasos: PasoConfiguracion[] = [
    {
      clave: 'identidad', texto: 'Nombre, giro y foto de portada', listo: !!(n.nombre?.trim() && n.portadaUrl && n.giro),
      seccion: 'datos/identidad', accion: 'Editar',
    },
    {
      clave: 'color', texto: 'Un color que se vea en modo claro y oscuro', listo: color.claro && color.oscuro,
      seccion: 'datos/identidad', accion: 'Elegir color', soloDueno: true,
    },
    {
      clave: 'whatsapp', texto: 'WhatsApp para recibir pedidos', listo: !!n.whatsapp?.replace(/\D/g, ''),
      seccion: 'datos/contacto', accion: 'Agregar',
    },
    {
      clave: 'catalogo',
      texto: n.productosActivos ? `${n.productosActivos} ${n.productosActivos === 1 ? textos.singular : textos.plural.toLowerCase()} a la vista` : `${textos.plural} a la vista`,
      listo: n.productosActivos > 0, seccion: 'catalogo', accion: n.productosActivos ? 'Ver' : 'Agregar',
    },
  ];
  if (n.modoPedido === 'CITA') {
    pasos.push({ clave: 'agenda', texto: 'Horario de citas activo', listo: !!n.agendaActiva, seccion: 'equipo', accion: 'Configurar' });
  }
  if (n.atencionEnLocal !== false && n.tipo !== 'SERVICIO') {
    pasos.push({
      clave: 'ubicacion', texto: 'Ubicación en el mapa', listo: n.lat != null && n.lng != null,
      seccion: 'datos/contacto', accion: 'Agregar',
    });
  }
  pasos.push({
    clave: 'encargado', texto: n.encargado ? `Encargado: ${n.encargado}` : 'Un encargado que atienda los pedidos',
    listo: !!n.encargado, seccion: 'encargado', accion: n.encargado ? 'Cambiar' : 'Asignar', soloDueno: true,
  });
  return pasos;
}

/** Cuántos pasos están listos de cuántos. */
export function avanceDe(n: NegocioAdmin): { listos: number; total: number } {
  const p = pasosDe(n);
  return { listos: p.filter((x) => x.listo).length, total: p.length };
}
