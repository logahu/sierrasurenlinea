import { CampoAtributo, Gestion } from './tianguis.model';
import { faltantes, publicacionVacia } from './formulario-anuncio';
import { explicacion } from './mi-anuncio-page';

const MARCA: CampoAtributo = { nombre: 'marca', etiqueta: 'Marca', tipo: 'TEXTO', requerido: true };

describe('publicar por pasos', () => {
  it('dice qué falta en cada paso', () => {
    const p = publicacionVacia();
    expect(faltantes(0, p, [])).toEqual(['la categoría']);
    expect(faltantes(1, { ...p, categoria: 'vehiculos' }, [MARCA])).toEqual(['el título', 'la descripción', 'el precio', 'la localidad o colonia', 'marca']);
    const datos = { ...p, titulo: 'Tsuru', descripcion: 'Bien', precio: 0, ubicacion: 'Centro', atributos: { marca: 'Nissan' } };
    expect(faltantes(1, datos, [MARCA])).toEqual([]);
    expect(faltantes(2, datos, [])).toEqual(['al menos una foto']);
    expect(faltantes(3, { ...datos, vendedorNombre: 'Ana', vendedorWhatsapp: '951 12' }, [])).toEqual(['tu WhatsApp (10 dígitos)']);
    expect(faltantes(3, { ...datos, vendedorNombre: 'Ana', vendedorWhatsapp: '951 123 4567' }, [])).toEqual([]);
    expect(faltantes(4, datos, [])).toEqual(['aceptar las reglas']);
    expect(faltantes(4, { ...datos, aceptaReglas: true }, [])).toEqual([]);
  });

  it('explica cada estado al vendedor', () => {
    const g = { estado: 'PAUSADO', pausadoPor: 'REPORTES' } as Gestion;
    expect(explicacion(g)).toContain('reportaron');
    expect(explicacion({ ...g, pausadoPor: 'VENDEDOR' })).toContain('Lo pausaste');
    expect(explicacion({ ...g, estado: 'RECHAZADO' })).toContain('motivo');
    expect(explicacion({ ...g, estado: 'VENCIDO' })).toContain('Renuévalo');
  });
});
