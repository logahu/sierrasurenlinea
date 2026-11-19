import { faltanEnPanel } from './anuncio-form-page';
import { nombreDeCampo } from './categorias-tianguis';
import { agrupar } from './reportes-tianguis';
import { AnuncioEdicion, ReporteAdmin } from './tianguis-admin.api';

const r = (id: number, anuncioId: number): ReporteAdmin => ({
  id, anuncioId, anuncioTitulo: 'A' + anuncioId, anuncioEstado: 'PAUSADO', motivo: 'FRAUDE', motivoTexto: 'Fraude',
  comentario: null, fecha: '2026-11-19T10:00:00', atendido: false,
});

describe('panel del tianguis', () => {
  it('agrupa los reportes por anuncio, los más reportados primero', () => {
    const g = agrupar([r(1, 5), r(2, 7), r(3, 7), r(4, 7)]);
    expect(g.map((x) => [x.anuncioId, x.reportes.length])).toEqual([[7, 3], [5, 1]]);
  });

  it('arma el nombre interno de un campo desde su etiqueta', () => {
    expect(nombreDeCampo('Kilometraje')).toBe('kilometraje');
    expect(nombreDeCampo('Estado de batería')).toBe('estadoDeBateria');
    expect(nombreDeCampo('  Año (modelo) ')).toBe('anoModelo');
  });

  it('pide lo necesario antes de guardar', () => {
    const e: AnuncioEdicion = {
      categoria: 'vehiculos', titulo: 'Tsuru', descripcion: 'Bien', precio: 1000, negociable: false, condicion: 'USADO',
      modalidad: 'CLASIFICADO', atributos: { marca: 'Nissan' }, ubicacion: 'Centro', fotos: ['img/a.svg'], destacado: false,
      vendedorId: 3, vendedorNombre: null, vendedorWhatsapp: null, publicar: false,
    };
    const req = [{ nombre: 'marca', etiqueta: 'Marca' }];
    expect(faltanEnPanel(e, req, false)).toEqual([]);
    expect(faltanEnPanel({ ...e, vendedorId: null }, req, false)).toEqual(['el vendedor']);
    expect(faltanEnPanel({ ...e, vendedorNombre: 'Ana', vendedorWhatsapp: '9511234567' }, req, true)).toEqual([]);
    expect(faltanEnPanel({ ...e, fotos: [], atributos: {}, precio: NaN }, req, false)).toEqual(['el precio', 'al menos una foto', 'marca']);
  });
});
