import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { VisitasService } from '../visitas';
import { Giro, Negocio } from './catalogo.model';
import { CatalogoService } from './catalogo.service';
import { InicioPage } from './inicio-page';

const giro = (slug: string, nombre: string, orden: number): Giro => ({ slug, nombre, icono: null, orden, negocios: 0 });
const GIROS = [giro('flores', 'Flores y regalos', 1), giro('belleza', 'Belleza', 2), giro('comida', 'Comida', 5)];
const neg = (id: number, slug: string, nombre: string, g: Giro, extra: Partial<Negocio> = {}): Negocio =>
  ({
    id, slug, nombre, eslogan: null, descripcion: null, tipo: 'VENTA', colorPrimario: '#d6336c', portadaUrl: '',
    whatsapp: '', telefono: null, direccion: null, horario: null, soloMayoresEdad: false,
    giro: { slug: g.slug, nombre: g.nombre }, creadoEn: '2026-01-01T00:00:00', ...extra,
  }) as Negocio;
const NEGOCIOS = [
  neg(1, 'turamohoy', 'TuRamoHoy', GIROS[0], { eslogan: 'Flores frescas' }),
  neg(2, 'belleza', 'Belleza', GIROS[1], { eslogan: 'Maquillaje y perfumes' }),
  neg(3, 'melgarejo', 'Estudio Melgarejo', GIROS[1], { patrocinado: true, eslogan: 'Salón de belleza', estado: 'PRUEBAS' }),
];

function montar(params: { giro?: string; q?: string; orden?: string } = {}) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: '**', children: [] }]),
      {
        provide: CatalogoService,
        useValue: { giros: () => of(GIROS), negocios: () => of(NEGOCIOS), destacados: () => of([]), anuncios: () => of([]) },
      },
      { provide: VisitasService, useValue: { registrar: () => of(1) } },
    ],
  });
  const f = TestBed.createComponent(InicioPage);
  for (const [k, v] of Object.entries(params)) f.componentRef.setInput(k, v);
  f.detectChanges();
  const el = f.nativeElement as HTMLElement;
  const nombres = () => [...el.querySelectorAll('.rejilla .nombre')].map((x) => x.textContent?.trim());
  return { f, el, nombres };
}

describe('InicioPage (directorio)', () => {
  afterEach(() => vi.useRealTimers());

  it('muestra chips con conteo (sin giros vacíos), patrocinados primero y etiquetas', () => {
    const { el, nombres } = montar();
    const chips = [...el.querySelectorAll('.giros .chip')].map((c) => c.textContent?.replace(/\s+/g, ' ').trim());
    expect(chips).toEqual(['Todos 3', 'Flores y regalos 1', 'Belleza 2']);
    expect(el.querySelector('.giros .chip')?.getAttribute('aria-pressed')).toBe('true');
    expect(nombres()).toEqual(['Estudio Melgarejo', 'TuRamoHoy', 'Belleza']);
    const etiquetas = el.querySelector('.rejilla li')?.querySelector('.etiquetas')?.textContent;
    expect(etiquetas).toContain('Patrocinado');
    expect(etiquetas).toContain('en pruebas');
    expect(el.querySelector('.resumen')?.getAttribute('aria-live')).toBe('polite');
    expect(el.querySelector('.resumen')?.textContent).toContain('3 negocios');
  });

  it('filtra por giro, búsqueda y orden desde la URL', () => {
    const { el, nombres } = montar({ giro: 'belleza', q: 'SALON', orden: 'az' });
    expect(nombres()).toEqual(['Estudio Melgarejo']);
    expect(el.querySelector('.resumen')?.textContent).toMatch(/1 negocio\s+en Belleza\s+para «SALON»/);
    const pulsado = [...el.querySelectorAll('.giros .chip')].find((c) => c.getAttribute('aria-pressed') === 'true');
    expect(pulsado?.textContent).toContain('Belleza');
    expect((el.querySelector('#buscar-negocio') as HTMLInputElement).value).toBe('SALON');
  });

  it('sin resultados muestra el estado vacío y «Limpiar» quita los filtros', () => {
    const { el } = montar({ q: 'mezcal' });
    expect(el.querySelector('.vacio')?.textContent).toContain('No encontramos negocios con esa búsqueda');
    const router = TestBed.inject(Router);
    const ir = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    (el.querySelector('.vacio button') as HTMLButtonElement).click();
    expect(ir).toHaveBeenCalledWith([], { queryParams: { giro: null, q: null, orden: null }, replaceUrl: true });
  });

  it('al escribir espera 200 ms y pone la búsqueda en la URL', () => {
    vi.useFakeTimers();
    const { el } = montar({ orden: 'nuevos' });
    const router = TestBed.inject(Router);
    const ir = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const input = el.querySelector('#buscar-negocio') as HTMLInputElement;
    input.value = 'ros';
    input.dispatchEvent(new Event('input'));
    input.value = 'rosas';
    input.dispatchEvent(new Event('input'));
    vi.advanceTimersByTime(150);
    expect(ir).not.toHaveBeenCalled();
    vi.advanceTimersByTime(60);
    expect(ir).toHaveBeenCalledTimes(1);
    expect(ir).toHaveBeenCalledWith([], { queryParams: { giro: null, q: 'rosas', orden: 'nuevos' }, replaceUrl: true });
  });
});
