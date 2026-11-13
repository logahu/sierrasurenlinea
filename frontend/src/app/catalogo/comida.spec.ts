import { GrupoOpciones, Platillo } from './catalogo.model';
import { alternar, firmaOpciones, gruposFaltantes, precioUnitario, reglaDe, textoOpciones } from './comida';
import { ENCARGO_VACIO, PedidoComida, armarMensajeEncargo, comidaParaServidor, porPersona, subtotalComida } from './encargo';
import { TipoEncargo } from './catalogo.model';

const carne: GrupoOpciones = {
  nombre: 'Carne', multiple: false, obligatorio: true, maximo: null,
  opciones: [{ nombre: 'Pastor', precio: 0, disponible: true }, { nombre: 'Suadero', precio: 0, disponible: true }],
};
const extras: GrupoOpciones = {
  nombre: 'Extras', multiple: true, obligatorio: false, maximo: 2,
  opciones: [{ nombre: 'Queso', precio: 15, disponible: true }, { nombre: 'Piña', precio: 5, disponible: true }, { nombre: 'Nopal', precio: 3, disponible: true }],
};
const taco: Platillo = { id: 1, nombre: 'Taco', descripcion: null, precio: 15, imagenUrl: null, orden: 1, disponible: true, opciones: [carne, extras] };
const agua: Platillo = { id: 2, nombre: 'Agua', descripcion: null, precio: 20, imagenUrl: null, orden: 2, disponible: true };

describe('opciones de un platillo', () => {
  it('elige una reemplaza; varias respeta el máximo; la obligatoria no se vacía', () => {
    let e = alternar([], carne, 'Pastor');
    e = alternar(e, carne, 'Suadero');
    expect(e).toEqual([{ grupo: 'Carne', opcion: 'Suadero' }]);
    expect(alternar(e, carne, 'Suadero')).toEqual(e);
    e = alternar(e, extras, 'Queso');
    e = alternar(e, extras, 'Piña');
    expect(alternar(e, extras, 'Nopal')).toEqual(e);
    expect(alternar(e, extras, 'Queso').length).toBe(2);
  });

  it('precio, faltantes, texto y reglas', () => {
    const e = [{ grupo: 'Carne', opcion: 'Pastor' }, { grupo: 'Extras', opcion: 'Queso' }];
    expect(precioUnitario(taco, e)).toBe(30);
    expect(gruposFaltantes(taco, [])).toEqual(['Carne']);
    expect(textoOpciones(taco, e)).toBe('Pastor · Queso (+$15)');
    expect(firmaOpciones(e)).toBe(firmaOpciones([...e].reverse()));
    expect(reglaDe(carne)).toBe('Elige 1');
    expect(reglaDe(extras)).toBe('Opcional · hasta 2');
  });
});

describe('órdenes por persona', () => {
  const comida: TipoEncargo = {
    id: 6, titulo: 'Comida a domicilio', ayuda: null, ejemplo: null, etiquetaRecoger: 'Lugar de comida',
    recogerObligatorio: false, manejaDinero: true, modo: 'COMIDA', icono: 'plato', soloProgramado: false,
  };
  const pedido: PedidoComida = {
    restaurante: { id: 9, nombre: 'Taquería', descripcion: null, horario: null, direccion: null, imagenUrl: null, orden: 1, visible: true, platillos: [taco, agua] },
    lineas: [
      { platillo: taco, cantidad: 1, opciones: [{ grupo: 'Carne', opcion: 'Pastor' }, { grupo: 'Extras', opcion: 'Queso' }], nota: 'Sin cebolla', persona: '' },
      { platillo: taco, cantidad: 6, opciones: [{ grupo: 'Carne', opcion: 'Suadero' }], persona: 'Luis' },
      { platillo: agua, cantidad: 1, persona: '' },
    ],
  };

  it('agrupa por persona y suma con extras', () => {
    expect(porPersona(pedido.lineas).map((g) => [g.persona, g.lineas.length])).toEqual([['', 2], ['Luis', 1]]);
    expect(subtotalComida(pedido)).toBe(30 + 90 + 20);
  });

  it('el mensaje separa las órdenes', () => {
    const msg = armarMensajeEncargo({ ...ENCARGO_VACIO, nombre: 'Hugo', entregar: 'Centro', telefono: '9511234567' }, undefined, 500, comida, pedido);
    expect(msg).toContain('*Para Hugo:* ($50)');
    expect(msg).toContain('• 1 × Taco — $30\n   Pastor · Queso (+$15)\n   📝 Sin cebolla');
    expect(msg).toContain('*Para Luis:* ($90)');
    expect(msg).toContain('• 6 × Taco — $90\n   Suadero');
  });

  it('manda al servidor las órdenes sin precios', () => {
    expect(comidaParaServidor(pedido)).toEqual({
      restauranteId: 9,
      ordenes: [
        { persona: '', renglones: [
          { platilloId: 1, cantidad: 1, opciones: [{ grupo: 'Carne', opcion: 'Pastor' }, { grupo: 'Extras', opcion: 'Queso' }], nota: 'Sin cebolla' },
          { platilloId: 2, cantidad: 1, opciones: [], nota: null },
        ] },
        { persona: 'Luis', renglones: [{ platilloId: 1, cantidad: 6, opciones: [{ grupo: 'Carne', opcion: 'Suadero' }], nota: null }] },
      ],
    });
  });
});
