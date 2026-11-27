import { colorSeVe, contraste } from '../color';
import { NegocioAdmin } from './admin.model';
import { avanceDe, pasosDe } from './configuracion';

const base = (extra: Partial<NegocioAdmin> = {}): NegocioAdmin => ({
  id: 1, slug: 'estudio-melgarejo', nombre: 'Estudio Melgarejo', eslogan: null, descripcion: null, tipo: 'VENTA',
  colorPrimario: '#8a6d3b', portadaUrl: 'img/x.png', whatsapp: '5219510000000', telefono: null, direccion: null, horario: null,
  atencionEnLocal: true, lat: 16.3, lng: -96.6, soloMayoresEdad: false, visible: true, estado: 'PUBLICO', visibleApp: true,
  topeAdelanto: null, orden: 7, productosActivos: 4, encargado: 'Yolanda', modoPedido: 'CITA', agendaActiva: true, giro: 'belleza',
  ...extra,
});

describe('configuración de un negocio', () => {
  it('un negocio completo tiene todo listo', () => {
    expect(avanceDe(base())).toEqual({ listos: 7, total: 7 });
  });

  it('señala lo que falta y a dónde ir', () => {
    const p = pasosDe(base({ colorPrimario: '#1a1a1a', lat: null, lng: null, encargado: null, productosActivos: 0 }));
    const falta = p.filter((x) => !x.listo).map((x) => [x.clave, x.seccion]);
    expect(falta).toEqual([['color', 'datos/identidad'], ['catalogo', 'catalogo'], ['ubicacion', 'datos/contacto'], ['encargado', 'encargado']]);
    expect(p.find((x) => x.clave === 'catalogo')?.texto).toBe('Productos a la vista');
  });

  it('solo pide lo que aplica al tipo de negocio', () => {
    const encarguitos = pasosDe(base({ tipo: 'SERVICIO', modoPedido: null, atencionEnLocal: false }));
    expect(encarguitos.map((x) => x.clave)).toEqual(['identidad', 'color', 'whatsapp', 'catalogo', 'encargado']);
    expect(pasosDe(base({ atencionEnLocal: false, modoPedido: 'COMPRA' })).some((x) => x.clave === 'ubicacion' || x.clave === 'agenda')).toBe(false);
  });

  it('el color debe verse en claro y en oscuro', () => {
    expect(colorSeVe('#1a1a1a')).toEqual({ claro: true, oscuro: false });
    expect(colorSeVe('#fbf3e6')).toEqual({ claro: false, oscuro: true });
    expect(colorSeVe('#8a6d3b')).toEqual({ claro: true, oscuro: true });
    expect(colorSeVe(null)).toEqual({ claro: false, oscuro: false });
    expect(contraste('#ffffff', '#000000')).toBeCloseTo(21, 0);
  });
});
