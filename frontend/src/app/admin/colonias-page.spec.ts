import { ColoniaAdmin } from './admin.model';
import { filtrarColonias } from './colonias-page';

const c = (id: number, nombre: string, tipo: string, zona: string | null, estado: ColoniaAdmin['estado'] = 'ACTIVA'): ColoniaAdmin => ({
  id, nombre, tipo, zona, estado, codigoPostal: '70805', origen: 'SEPOMEX', solicitudes: 0, creada: '2026-11-13T00:00:00Z', pedidos: 0,
});
const lista = [c(1, 'Benito Juárez', 'Colonia', 'Centro'), c(2, 'Arriba', 'Barrio', null), c(3, 'El Tunillo', 'Ranchería', 'Fuera'), c(4, 'Las Flores', 'Colonia', null, 'SOLICITADA')];

describe('filtrarColonias', () => {
  it('solo muestra las activas y busca sin acentos', () => {
    expect(filtrarColonias(lista, '', '', '').map((x) => x.id)).toEqual([1, 2, 3]);
    expect(filtrarColonias(lista, 'juarez', '', '').map((x) => x.id)).toEqual([1]);
  });
  it('filtra por tipo y por tarifa (o sin tarifa)', () => {
    expect(filtrarColonias(lista, '', 'Barrio', '').map((x) => x.id)).toEqual([2]);
    expect(filtrarColonias(lista, '', '', 'centro').map((x) => x.id)).toEqual([1]);
    expect(filtrarColonias(lista, '', '', '_sin').map((x) => x.id)).toEqual([2]);
  });
});
