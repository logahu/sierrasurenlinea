import { Component, computed, inject, output, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { AdminApi } from './admin.api';
import { CuentaDePrueba } from './admin.model';
import { mensajeDeError } from './autorizacion';

/** Texto para copiar o guardar: una línea por cuenta, separada por tabuladores (se pega bien en Excel). */
export function textoDeCuentas(cuentas: CuentaDePrueba[], separador = '\t'): string {
  const celda = (v: string | null) => {
    const t = v ?? '';
    return separador === ',' && /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const filas = [['Tipo', 'Nombre', 'Teléfono', 'Contraseña', 'Negocio', 'Estado', 'Dónde entra']];
  for (const c of cuentas) {
    filas.push([
      c.tipo, c.nombre, c.telefono ?? '', c.contrasena ?? '', c.negocio ?? '', c.estado,
      c.tipo === 'Cliente' ? 'sierrasurenlinea.com.mx/cuenta/entrar' : 'sierrasurenlinea.com.mx/admin',
    ]);
  }
  return filas.map((f) => f.map(celda).join(separador)).join('\n');
}

/**
 * Crea (o renueva) las cuentas para probar el sitio: 10 clientes probadores, un encargado por
 * cada negocio sin encargado y 8 repartidores generales, todos con «🧪 PRUEBA» en el nombre.
 * Las contraseñas solo se ven aquí, una vez.
 */
@Component({
  selector: 'app-usuarios-prueba',
  template: `
    <section class="ficha prueba">
      <h2>🧪 Usuarios de prueba</h2>
      <p class="ayuda">
        Crea 10 clientes probadores (ven los negocios en pruebas y sus pedidos llegan marcados como prueba), un encargado
        para cada negocio que no tenga uno y 8 repartidores para todos los negocios. Todos llevan «🧪 PRUEBA» en el
        nombre y teléfonos 555 000 …, que no son de nadie.
      </p>

      @if (paso() === 'confirmar-crear') {
        <p><strong>¿Crear las cuentas?</strong> Si ya existen, reciben una contraseña nueva y vuelven a tener acceso.</p>
        <div class="acciones-fila">
          <button type="button" class="btn primario" (click)="crear()" [disabled]="ocupado()">Sí, crear</button>
          <button type="button" class="btn secundario" (click)="paso.set(null)">Cancelar</button>
        </div>
      } @else if (paso() === 'confirmar-baja') {
        <p><strong>¿Quitar el acceso a todos los usuarios de prueba?</strong> Sus pedidos se conservan en el historial.</p>
        <div class="acciones-fila">
          <button type="button" class="btn primario" (click)="baja()" [disabled]="ocupado()">Sí, quitar acceso</button>
          <button type="button" class="btn secundario" (click)="paso.set(null)">Cancelar</button>
        </div>
      } @else {
        <div class="acciones-fila">
          <button type="button" class="btn primario" (click)="paso.set('confirmar-crear')" [disabled]="ocupado()">
            Crear usuarios de prueba
          </button>
          <button type="button" class="btn secundario" (click)="paso.set('confirmar-baja')" [disabled]="ocupado()">
            Quitar acceso a los usuarios de prueba
          </button>
        </div>
      }
      @if (ocupado()) { <p class="ayuda" role="status">Un momento…</p> }
      @if (aviso(); as a) { <p class="exito" role="status">{{ a }}</p> }
      @if (error(); as e) { <p class="error" role="alert">{{ e }}</p> }

      @if (cuentas().length) {
        <p class="alerta">
          <strong>Copia o descarga las contraseñas ahora:</strong> no se vuelven a mostrar. Si las pierdes, vuelve a pulsar
          «Crear usuarios de prueba» y se generan otras.
        </p>
        <div class="acciones-fila">
          <button type="button" class="btn secundario" (click)="copiar()">{{ copiado() ? '✓ Copiado' : 'Copiar todo' }}</button>
          <button type="button" class="btn secundario" (click)="descargar()">Descargar CSV</button>
        </div>
        <p class="ayuda">
          Los clientes entran en <strong>Mi cuenta</strong> (sierrasurenlinea.com.mx/cuenta/entrar); encargados y
          repartidores, en el panel (sierrasurenlinea.com.mx/admin). Todos con su teléfono.
        </p>
        <div class="tabla-desliza">
          <table>
            <thead>
              <tr><th>Tipo</th><th>Nombre</th><th>Teléfono</th><th>Contraseña</th><th>Estado</th></tr>
            </thead>
            <tbody>
              @for (c of cuentas(); track $index) {
                <tr [class.omitida]="!c.contrasena">
                  <td>{{ c.tipo }}</td>
                  <td>{{ c.nombre }}@if (c.tipo === 'Encargado' && c.negocio && !c.nombre.includes(c.negocio)) { <br /><small>{{ c.negocio }}</small> }</td>
                  <td>{{ c.telefono }}</td>
                  <td><code>{{ c.contrasena ?? '—' }}</code></td>
                  <td>{{ c.estado }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>
  `,
  styles: `
    .prueba { margin-top: 1.5rem; }
    .prueba h2 { margin: 0 0 .25rem; font-size: 1.1rem; }
    .alerta { background: #fff7ed; border: 1px solid #fdba74; border-radius: .5rem; padding: .6rem .8rem; }
    .tabla-desliza { overflow-x: auto; margin-top: .5rem; }
    table { width: 100%; border-collapse: collapse; font-size: .85rem; }
    th, td { text-align: left; padding: .35rem .5rem; border-bottom: 1px solid var(--linea); vertical-align: top; }
    td code { font-size: .9rem; white-space: nowrap; }
    tr.omitida { color: var(--tinta-suave); }
  `,
})
export class UsuariosPrueba {
  private readonly api = inject(AdminApi);
  /** Avisa a la página para que recargue las listas. */
  readonly cambio = output<void>();

  protected readonly paso = signal<'confirmar-crear' | 'confirmar-baja' | null>(null);
  protected readonly ocupado = signal(false);
  protected readonly cuentas = signal<CuentaDePrueba[]>([]);
  protected readonly aviso = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly copiado = signal(false);
  private readonly conContrasena = computed(() => this.cuentas().filter((c) => c.contrasena).length);

  protected crear(): void {
    this.empezar();
    this.api.crearUsuariosDePrueba().pipe(finalize(() => this.ocupado.set(false))).subscribe({
      next: (cuentas) => {
        this.cuentas.set(cuentas);
        const omitidas = cuentas.length - this.conContrasena();
        this.aviso.set(
          `Listo: ${this.conContrasena()} cuentas de prueba con contraseña nueva` +
            (omitidas ? ` (${omitidas} ${omitidas === 1 ? 'omitida' : 'omitidas'}: ver la tabla).` : '.'),
        );
        this.cambio.emit();
      },
      error: (e) => this.error.set(mensajeDeError(e)),
    });
  }

  protected baja(): void {
    this.empezar();
    this.cuentas.set([]);
    this.api.bajaUsuariosDePrueba().pipe(finalize(() => this.ocupado.set(false))).subscribe({
      next: (r) => {
        this.aviso.set(`Listo: ${r.usuarios} del equipo y ${r.clientes} clientes de prueba ya no pueden entrar.`);
        this.cambio.emit();
      },
      error: (e) => this.error.set(mensajeDeError(e)),
    });
  }

  protected copiar(): void {
    navigator.clipboard?.writeText(textoDeCuentas(this.cuentas())).then(
      () => {
        this.copiado.set(true);
        setTimeout(() => this.copiado.set(false), 2000);
      },
      () => this.error.set('No se pudo copiar. Usa «Descargar CSV».'),
    );
  }

  protected descargar(): void {
    // BOM para que Excel lea bien los acentos y el emoji.
    const blob = new Blob(['﻿' + textoDeCuentas(this.cuentas(), ',')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'usuarios-de-prueba.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  private empezar(): void {
    this.paso.set(null);
    this.aviso.set(null);
    this.error.set(null);
    this.ocupado.set(true);
  }
}
