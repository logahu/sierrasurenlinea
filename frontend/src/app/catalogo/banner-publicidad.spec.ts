import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { VisitasService } from '../visitas';
import { BannerPublicidad } from './banner-publicidad';
import { Anuncio } from './catalogo.model';
import { CatalogoService } from './catalogo.service';

const anuncio = (id: number, extra: Partial<Anuncio> = {}): Anuncio => ({
  id, titulo: 'Anuncio ' + id, texto: 'Texto', imagenUrl: null, enlace: '/turamohoy', negocioSlug: null,
  colorFondo: null, posicion: 'PORTADA_ARRIBA', ...extra,
});

function montar(anuncios: Anuncio[]) {
  const registrados: string[] = [];
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: '**', children: [] }]),
      { provide: CatalogoService, useValue: { anuncios: () => of(anuncios) } },
      { provide: VisitasService, useValue: { registrar: (r: string) => (registrados.push(r), of(1)) } },
    ],
  });
  const f = TestBed.createComponent(BannerPublicidad);
  f.componentRef.setInput('posicion', 'PORTADA_ARRIBA');
  f.detectChanges();
  return { f, el: f.nativeElement as HTMLElement, registrados };
}

describe('BannerPublicidad', () => {
  beforeEach(() => localStorage.clear());

  it('sin anuncios vigentes no muestra nada', () => {
    const { el } = montar([]);
    expect(el.textContent?.trim()).toBe('');
  });

  it('dice «Publicidad», se oculta con × y vuelve con «Mostrar publicidad»', () => {
    const { f, el } = montar([anuncio(1)]);
    expect(el.querySelector('.etiqueta')?.textContent).toContain('Publicidad');
    expect(el.textContent).toContain('Anuncio 1');

    (el.querySelector('button.cerrar') as HTMLButtonElement).click();
    f.detectChanges();
    expect(el.querySelector('.banner')).toBeNull();
    const mostrar = el.querySelector('.mostrar button') as HTMLButtonElement;
    expect(mostrar.textContent).toContain('Mostrar publicidad');
    expect(localStorage.getItem('ssl:publicidad-oculta')).not.toBeNull();

    mostrar.click();
    f.detectChanges();
    expect(el.querySelector('.banner')).not.toBeNull();
  });

  it('cuenta el clic y pasa de anuncio con los puntos', async () => {
    const { f, el, registrados } = montar([anuncio(1), anuncio(2, { enlace: 'https://example.com' })]);
    (el.querySelector('a.contenido') as HTMLAnchorElement).click();
    await f.whenStable();
    expect(registrados).toEqual(['/anuncio/1']);

    const puntos = el.querySelectorAll<HTMLButtonElement>('.puntos button');
    expect(puntos).toHaveLength(2);
    puntos[1].click();
    f.detectChanges();
    const externo = el.querySelector('a.contenido') as HTMLAnchorElement;
    expect(el.textContent).toContain('Anuncio 2');
    expect(externo.getAttribute('target')).toBe('_blank');
    expect(externo.getAttribute('rel')).toContain('sponsored');
  });
});
