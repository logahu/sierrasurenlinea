import { DOCUMENT } from '@angular/common';
import { Directive, ElementRef, OnDestroy, OnInit, Renderer2, inject } from '@angular/core';

const OJO =
  '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
const OJO_TACHADO =
  '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2"/><path stroke="currentColor" stroke-width="2" d="M3 3l18 18"/></svg>';

/**
 * Agrega a un campo de contraseña un botón con un ojo para ver u ocultar lo escrito.
 * Uso: <input type="password" verContrasena />
 */
@Directive({ selector: 'input[verContrasena]' })
export class VerContrasena implements OnInit, OnDestroy {
  private readonly campo = inject(ElementRef<HTMLInputElement>).nativeElement as HTMLInputElement;
  private readonly r = inject(Renderer2);
  private readonly documento = inject(DOCUMENT);
  private boton?: HTMLButtonElement;
  private envoltura?: HTMLSpanElement;
  private quitarClic?: () => void;

  ngOnInit(): void {
    const padre = this.campo.parentNode;
    if (!padre) return;
    this.envoltura = this.r.createElement('span');
    this.r.addClass(this.envoltura, 'campo-contrasena');
    this.r.insertBefore(padre, this.envoltura, this.campo);
    this.r.appendChild(this.envoltura, this.campo);

    this.boton = this.documento.createElement('button');
    this.boton.type = 'button';
    this.boton.className = 'ojo-contrasena';
    this.pintar(false);
    this.r.appendChild(this.envoltura, this.boton);
    this.quitarClic = this.r.listen(this.boton, 'click', () => {
      const visible = this.campo.type === 'password';
      this.campo.type = visible ? 'text' : 'password';
      this.pintar(visible);
      this.campo.focus();
    });
  }

  ngOnDestroy(): void {
    this.quitarClic?.();
  }

  private pintar(visible: boolean): void {
    if (!this.boton) return;
    this.boton.innerHTML = visible ? OJO_TACHADO : OJO;
    this.boton.setAttribute('aria-label', visible ? 'Ocultar contraseña' : 'Mostrar contraseña');
    this.boton.setAttribute('aria-pressed', String(visible));
    this.boton.title = visible ? 'Ocultar contraseña' : 'Mostrar contraseña';
  }
}
