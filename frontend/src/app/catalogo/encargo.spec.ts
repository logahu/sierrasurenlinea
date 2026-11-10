import { Producto } from './catalogo.model';
import { TipoEncargo } from './catalogo.model';
import {
  ENCARGO_VACIO, PedidoComida, TIPOS_ENCARGO, armarMensajeEncargo, datosDelPedido, subtotalComida, telefonoValido, camposFaltantes, enlaceMapa, opcionDe, textoCuando, zonasDeEntrega, zonasPara,
} from './encargo';

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
  telefono: '951 123 4567',
};

describe('encargo', () => {
  it('pide los campos mínimos', () => {
    expect(camposFaltantes(ENCARGO_VACIO)).toEqual([
      'qué necesitas que hagamos', 'a dónde lo llevamos', 'la zona de entrega', 'tu nombre', 'tu teléfono (10 dígitos)',
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

  describe('viaje en moto', () => {
    const viaje: TipoEncargo = {
      id: 5, titulo: 'Viaje en moto', ayuda: null, ejemplo: null, etiquetaRecoger: 'Dónde te recogemos',
      recogerObligatorio: true, manejaDinero: false, modo: 'VIAJE', icono: 'moto', soloProgramado: false,
    };
    const viajeCentro = tarifa(38, 'Viaje en el centro', 30, 'por viaje');
    const datosViaje = { ...ENCARGO_VACIO, tipo: '5', recoger: 'Parque central', entregar: 'Hospital', zona: '38', nombre: 'Ana', telefono: '9511234567' };

    it('usa solo las tarifas por viaje, y los mandados no las incluyen', () => {
      expect(zonasPara([centro, extra, viajeCentro], viaje).map((z) => z.id)).toEqual([38]);
      expect(zonasDeEntrega([centro, extra, viajeCentro]).map((z) => z.id)).toEqual([34]);
    });

    it('no pide detalle pero sí dónde recoger (o la ubicación)', () => {
      expect(camposFaltantes(datosViaje, viaje)).toEqual([]);
      expect(camposFaltantes({ ...datosViaje, recoger: '' }, viaje)).toEqual(['dónde te recogemos']);
      expect(camposFaltantes({ ...datosViaje, recoger: '', ubicacion: enlaceMapa(16.3, -96.6) }, viaje)).toEqual([]);
    });

    it('arma el mensaje de viaje con ubicación y pide los datos del conductor', () => {
      const msg = armarMensajeEncargo(
        { ...datosViaje, ubicacion: enlaceMapa(16.326, -96.5958), equipaje: true }, viajeCentro, 500, viaje,
      );
      expect(msg).toContain('quiero un viaje en moto');
      expect(msg).toContain('*Dónde te recogemos:* Parque central');
      expect(msg).toContain('*Mi ubicación:* https://maps.google.com/?q=16.326000,-96.595800');
      expect(msg).toContain('*Voy a:* Hospital');
      expect(msg).toContain('*Zona:* Viaje en el centro ($30 por viaje)');
      expect(msg).toContain('*Equipaje:* llevo mochila o bolsa');
      expect(msg).toContain('*Pasajero:* Ana');
      expect(msg).toContain('nombre del conductor, la placa');
      expect(msg).not.toContain('*Pago:*');
    });

    it('solo con reservación exige hora aunque diga "ahora"', () => {
      const reserva = { ...viaje, soloProgramado: true };
      expect(camposFaltantes(datosViaje, reserva)).toEqual(['a qué hora lo necesitas']);
    });

    it('dice la fecha si no es hoy', () => {
      const hoy = new Date(2026, 10, 6);
      const d = { ...datosViaje, cuando: 'programado' as const, hora: '09:00' };
      expect(textoCuando({ ...d, fecha: '2026-11-06' }, viaje, hoy)).toBe('hoy a las 09:00');
      expect(textoCuando({ ...d, fecha: '2026-11-08' }, viaje, hoy)).toBe('el domingo, 8 de noviembre a las 09:00');
    });

    it('si la opción no existe usa la primera', () => {
      expect(opcionDe([viaje], 'x').id).toBe(5);
    });
  });

  describe('comida a domicilio', () => {
    const comida: TipoEncargo = {
      id: 6, titulo: 'Comida a domicilio', ayuda: null, ejemplo: null, etiquetaRecoger: 'Lugar de comida',
      recogerObligatorio: false, manejaDinero: true, modo: 'COMIDA', icono: 'plato', soloProgramado: false,
    };
    const platillo = (id: number, nombre: string, precio: number) =>
      ({ id, nombre, descripcion: null, precio, imagenUrl: null, orden: id, disponible: true });
    const fonda = {
      id: 1, nombre: 'Fonda Lupita', descripcion: null, horario: null, direccion: null, imagenUrl: null, orden: 1,
      visible: true, platillos: [platillo(1, 'Comida corrida', 85), platillo(2, 'Agua fresca', 30)],
    };
    const pedido: PedidoComida = {
      restaurante: fonda,
      lineas: [{ platillo: fonda.platillos[0], cantidad: 2 }, { platillo: fonda.platillos[1], cantidad: 1 }],
    };
    const datos = { ...ENCARGO_VACIO, tipo: '6', entregar: 'Av. Juárez 10', zona: '34', nombre: 'Luis', telefono: '9511234567', detalle: 'sin cebolla' };

    it('pide al menos un platillo, no un detalle', () => {
      expect(camposFaltantes({ ...datos, detalle: '' }, comida, pedido)).toEqual([]);
      expect(camposFaltantes(datos, comida, { restaurante: fonda, lineas: [] })).toEqual(['qué platillos quieres']);
    });

    it('arma el pedido con cantidades, subtotal y total aproximado', () => {
      expect(subtotalComida(pedido)).toBe(200);
      const msg = armarMensajeEncargo(datos, centro, 500, comida, pedido);
      expect(msg).toContain('quiero pedir comida');
      expect(msg).toContain('*Lugar:* Fonda Lupita');
      expect(msg).toContain('• 2 × Comida corrida — $170');
      expect(msg).toContain('• 1 × Agua fresca — $30');
      expect(msg).toContain('*Subtotal de la comida:* $200');
      expect(msg).toContain('*Indicaciones:* sin cebolla');
      expect(msg).toContain('*Total aproximado:* $230 (comida + envío)');
      expect(msg).toContain('El repartidor adelanta la comida');
    });
  });

  it('incluye folio y teléfono, y prepara los datos del pedido', () => {
    const msg = armarMensajeEncargo(completo, centro, 500, undefined, undefined, 'ENC-00012');
    expect(msg.split('\n')[2]).toBe('*Folio:* ENC-00012');
    expect(msg).toContain('*Teléfono:* 951 123 4567');
    expect(telefonoValido('+52 951 123 4567')).toBe(true);
    expect(telefonoValido('123')).toBe(false);
    const datos = datosDelPedido(completo, opcionDe(TIPOS_ENCARGO, completo.tipo), 'encarguitos', msg, centro);
    expect(datos).toMatchObject({ negocio: 'encarguitos', modo: 'MANDADO', zona: 'Centro', total: null });
  });
});
