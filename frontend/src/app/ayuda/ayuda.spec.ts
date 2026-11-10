import { PREGUNTAS, guiaDe, partesDe } from './ayuda';

describe('ayuda', () => {
  const negocio = { slug: 'x', nombre: 'X', colorPrimario: '#000', soloMayoresEdad: false, modoPedido: null };

  it('arma una guía según cómo se pide en cada negocio', () => {
    expect(guiaDe({ ...negocio, tipo: 'VENTA' }).pasos[1].titulo).toBe('Agrega a tu pedido');
    expect(guiaDe({ ...negocio, tipo: 'RENTA' }).pasos[3].titulo).toBe('Indica los datos del evento');
    expect(guiaDe({ ...negocio, tipo: 'VENTA', modoPedido: 'CITA' }).pasos[1].titulo).toBe('Agenda tu visita');
    expect(guiaDe({ ...negocio, tipo: 'SERVICIO' }).pasos[0].titulo).toBe('Elige qué necesitas');
    expect(guiaDe({ ...negocio, slug: 'vinateria', tipo: 'VENTA' }).consejos.join(' ')).toContain('mayores de 18');
  });

  it('separa los enlaces internos de las respuestas', () => {
    expect(partesDe('Ve a [Mi cuenta](/cuenta) y listo.')).toEqual([
      { texto: 'Ve a ' }, { texto: 'Mi cuenta', ruta: '/cuenta' }, { texto: ' y listo.' },
    ]);
    // Todas las rutas de las respuestas son internas.
    const rutas = PREGUNTAS.flatMap((t) => t.preguntas).flatMap((q) => partesDe(q.respuesta)).filter((p) => p.ruta);
    expect(rutas.every((p) => p.ruta!.startsWith('/'))).toBe(true);
  });
});
