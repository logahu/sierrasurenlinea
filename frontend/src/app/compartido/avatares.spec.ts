import { TestBed } from '@angular/core/testing';
import { Avatar } from './avatar';
import { DIBUJOS, dibujoDe, esFoto, fondoDeIniciales, inicialesDe } from './avatares';

describe('avatares', () => {
  it('reconoce dibujos, fotos e iniciales', () => {
    expect(DIBUJOS.map((d) => d.id)).toEqual(['flor', 'maguey', 'sol', 'cerro', 'colibri', 'mariposa', 'nopal', 'luna', 'taza', 'moto', 'estrella', 'corazon']);
    expect(dibujoDe('avatar:maguey')?.nombre).toBe('Maguey');
    expect(dibujoDe('avatar:dragon')).toBeNull();
    expect(dibujoDe('https://fotos/x.webp')).toBeNull();
    expect(esFoto('https://fotos.ejemplo.mx/perfiles/usuarios/1/a.webp')).toBe(true);
    expect(esFoto('avatar:sol')).toBe(false);
    expect(esFoto(null)).toBe(false);
    expect(inicialesDe('ana maría López')).toBe('AM');
    expect(inicialesDe('')).toBe('?');
    expect(fondoDeIniciales('Rosa')).toBe(fondoDeIniciales('Rosa'));
  });

  it('el componente muestra la foto, el dibujo o las iniciales', () => {
    const f = TestBed.createComponent(Avatar);
    const el = f.nativeElement as HTMLElement;
    f.componentRef.setInput('nombre', 'Rosa Pérez');
    f.detectChanges();
    expect(el.textContent?.trim()).toBe('RP');

    f.componentRef.setInput('avatar', 'avatar:sol');
    f.detectChanges();
    expect(el.querySelector('svg')).not.toBeNull();
    expect(el.textContent?.trim()).toBe('');

    f.componentRef.setInput('avatar', 'https://fotos.ejemplo.mx/perfiles/clientes/3/a.webp');
    f.detectChanges();
    expect(el.querySelector('img')?.getAttribute('src')).toContain('/perfiles/clientes/3/');
  });
});
