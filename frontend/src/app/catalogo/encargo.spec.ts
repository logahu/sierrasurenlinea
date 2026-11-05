import { Producto } from './catalogo.model';
import { ENCARGO_VACIO, armarMensajeEncargo, camposFaltantes, zonasDeEntrega } from './encargo';

const tarifa = (id: number, nombre: string, precio: number, unidadPrecio: string): Producto => ({
  id, nombre, precio, unidadPrecio, descripcion: null, caracteristicas: [], imagenUrl: '',
  negocioSlug: 'encarguitos', negocioNombre: 'Encarguitos', categoriaSlug: 'zonas',
  categoriaNombre: 'Tarifas por zona', destacado: false,
});
const centro = tarifa(34, 'Centro', 30, 'por mandado');
const extra = tarifa(37, 'Carga grande o espera extra', 15, 'extra');

const completo = {
  ...ENCARGO_VACIO,
  detalle: '1 kg de tortillas',
  entregar: 'Calle Juárez 10, casa azul',
  zona: '34',
  nombre: 'Hugo',
};

describe('encargo', () => {
  it('pide los campos mínimos', () => {
    expect(camposFaltantes(ENCARGO_VACIO)).toEqual([
      'qué necesitas que hagamos', 'a dónde lo llevamos', 'la zona de entrega', 'tu nombre',
    ]);
    expect(camposFaltantes(completo)).toEqual([]);
  });

  it('para llevar algo exige dónde se recoge', () => {
    expect(camposFaltantes({ ...completo, tipo: 'llevar' })).toEqual(['dónde lo recogemos']);
  });

  it('si es programado exige la hora', () => {
    expect(camposFaltantes({ ...completo, cuando: 'programado' })).toEqual(['a qué hora lo necesitas']);
  });

  it('las zonas no incluyen los cargos extra y van de la más barata a la más cara', () => {
    const agencias = tarifa(36, 'Agencias', 70, 'por mandado');
    expect(zonasDeEntrega([agencias, extra, centro]).map((z) => z.nombre)).toEqual(['Centro', 'Agencias']);
  });

  it('arma un mensaje de súper con zona y forma de pago', () => {
    const msg = armarMensajeEncargo(completo, centro);
    expect(msg).toContain('*Tipo:* Súper o mercado');
    expect(msg).toContain('*Qué necesito:* 1 kg de tortillas');
    expect(msg).toContain('*Zona:* Centro ($30 por mandado)');
    expect(msg).toContain('*Para:* lo antes posible');
    expect(msg).toContain('El repartidor adelanta los productos (hasta $500)');
    expect(msg).toContain('*Nombre:* Hugo');
  });

  it('para llevar algo no menciona pago y sí dónde se recoge', () => {
    const msg = armarMensajeEncargo(
      { ...completo, tipo: 'llevar', recoger: 'Mercado', cuando: 'programado', hora: '18:30' }, centro,
    );
    expect(msg).toContain('*Dónde lo recogemos:* Mercado');
    expect(msg).toContain('*Para:* hoy a las 18:30');
    expect(msg).not.toContain('*Pago:*');
  });

  it('en pagos con transferencia lo dice claro', () => {
    const msg = armarMensajeEncargo({ ...completo, tipo: 'pagos', pagoCompra: 'cliente-paga-antes' }, centro);
    expect(msg).toContain('*Pago:* Pago el monto a pagar antes, por transferencia');
  });
});
