import { environment } from '../../environments/environment';
import { esCatalogo, esPeticionDelCliente } from './cliente-sesion';
import { destinoSeguro } from './destino';

describe('cuenta del cliente', () => {
  const api = environment.apiUrl;

  it('manda el token solo a su cuenta y al envío de pedidos', () => {
    expect(esPeticionDelCliente('GET', `${api}/clientes/yo`)).toBe(true);
    expect(esPeticionDelCliente('GET', `${api}/clientes/pedidos`)).toBe(true);
    expect(esPeticionDelCliente('POST', `${api}/pedidos`)).toBe(true);
    expect(esPeticionDelCliente('POST', `${api}/pedidos/carrito`)).toBe(true);
    expect(esPeticionDelCliente('POST', `${api}/clientes/entrar`)).toBe(false);
    expect(esPeticionDelCliente('POST', `${api}/clientes/registro`)).toBe(false);
    expect(esPeticionDelCliente('GET', `${api}/negocios`)).toBe(false);
    expect(esPeticionDelCliente('GET', `${api}/admin/pedidos`)).toBe(false);
    expect(esPeticionDelCliente('GET', `https://otro.example/clientes/yo`)).toBe(false);
  });

  it('solo regresa a páginas del sitio', () => {
    expect(destinoSeguro('/encarguitos')).toBe('/encarguitos');
    expect(destinoSeguro(undefined)).toBe('/cuenta');
    expect(destinoSeguro('https://malo.example')).toBe('/cuenta');
    expect(destinoSeguro('//malo.example')).toBe('/cuenta');
    expect(destinoSeguro('/admin/usuarios')).toBe('/cuenta');
  });

  it('reconoce las lecturas del catálogo (los probadores mandan ahí su sesión)', () => {
    expect(esCatalogo('GET', `${api}/negocios`)).toBe(true);
    expect(esCatalogo('GET', `${api}/negocios/belleza/productos?categoria=x`)).toBe(true);
    expect(esCatalogo('GET', `${api}/productos/5`)).toBe(true);
    expect(esCatalogo('POST', `${api}/visitas`)).toBe(false);
    expect(esCatalogo('GET', `${api}/admin/negocios`)).toBe(false);
  });
});
