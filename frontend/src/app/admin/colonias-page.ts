import { Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { Observable, finalize } from 'rxjs';
import { AdminApi } from './admin.api';
import { ColoniaAdmin, DatosColonia } from './admin.model';
import { mensajeDeError } from './autorizacion';
import { TIPOS_COLONIA, clave, plural } from '../colonias/colonias';

/** Sin tarifa asignada (filtro). */
const SIN_TARIFA = '_sin';

/** Filtra el catálogo (solo las activas). */
export function filtrarColonias(lista: ColoniaAdmin[], q: string, tipo: string, tarifa: string): ColoniaAdmin[] {
  const texto = clave(q);
  return lista.filter(
    (c) =>
      c.estado === 'ACTIVA' &&
      (!texto || clave(`${c.nombre} ${c.codigoPostal ?? ''} ${c.zona ?? ''}`).includes(texto)) &&
      (!tipo || c.tipo === tipo) &&
      (!tarifa || (tarifa === SIN_TARIFA ? !c.zona : clave(c.zona) === clave(tarifa))),
  );
}

/**
 * Colonias, barrios y comunidades que se ofrecen al hacer un pedido. Aquí se agregan,
 * se les asigna la tarifa de Encarguitos, se eliminan y se revisan las que escriben los
 * clientes en «Otra».
 */
@Component({
  selector: 'app-colonias-page',
  imports: [DatePipe],
  template: `
    <h1>Colonias</h1>
    <p class="ayuda">
      Las que eligen los clientes al pedir. Asigna a cada una su <strong>tarifa de Encarguitos</strong> y el precio del
      mandado o viaje se pondrá solo. Si un cliente escribe una que no está, aparece aquí abajo para que la agregues.
    </p>

    @if (solicitudes().length) {
      <section class="solicitudes" aria-labelledby="titulo-solicitudes">
        <h2 id="titulo-solicitudes">📍 Pedidas por clientes <span class="cuenta">{{ solicitudes().length }}</span></h2>
        <p class="ayuda">Revisa el nombre (corrige la ortografía si hace falta), elige el tipo y su tarifa, y agrégala.</p>
        @for (c of solicitudes(); track c.id) {
          <form class="solicitud" (submit)="$event.preventDefault(); guardar(c, sn.value, st.value, '', sz.value)">
            <div class="quien">
              <strong>«{{ c.nombre }}»</strong>
              <small>{{ c.solicitudes }} {{ c.solicitudes === 1 ? 'pedido' : 'pedidos' }} · desde {{ c.creada | date: 'd MMM' }}</small>
            </div>
            <input #sn type="text" maxlength="100" [value]="c.nombre" aria-label="Nombre" />
            <select #st aria-label="Tipo">
              @for (t of tipos; track t) { <option [value]="t" [selected]="t === 'Colonia'">{{ t }}</option> }
            </select>
            <select #sz aria-label="Tarifa">
              <option value="">Sin tarifa</option>
              @for (z of zonas(); track z) { <option [value]="z">{{ z }}</option> }
            </select>
            <div class="acciones-fila">
              <button class="btn primario" type="submit" [disabled]="ocupado()">Agregar al catálogo</button>
              <button class="btn secundario" type="button" (click)="eliminar(c)" [disabled]="ocupado()">Descartar</button>
            </div>
            @if (fila() === c.id) { @if (error(); as e) { <p class="error" role="alert">{{ e }}</p> } }
          </form>
        }
      </section>
    }

    <div class="encabezado">
      <p class="ayuda">{{ activas().length }} en el catálogo · {{ sinTarifa() }} sin tarifa</p>
      <button type="button" class="btn primario" (click)="agregando.set(!agregando())" [attr.aria-expanded]="agregando()">
        {{ agregando() ? 'Cerrar' : '＋ Agregar colonia' }}
      </button>
    </div>
    @if (agregando()) {
      <form class="ficha nueva" (submit)="$event.preventDefault(); crear(nn.value, nt.value, nc.value, nz.value)">
        <label>Nombre <input #nn type="text" maxlength="100" placeholder="Ej. Las Flores" /></label>
        <label>Tipo
          <select #nt>@for (t of tipos; track t) { <option [value]="t" [selected]="t === 'Colonia'">{{ t }}</option> }</select>
        </label>
        <label>C.P. <small>(opcional)</small> <input #nc type="text" inputmode="numeric" maxlength="5" placeholder="70805" /></label>
        <label>Tarifa
          <select #nz>
            <option value="">Sin tarifa</option>
            @for (z of zonas(); track z) { <option [value]="z">{{ z }}</option> }
          </select>
        </label>
        <button class="btn primario" type="submit" [disabled]="ocupado()">Agregar</button>
        @if (fila() === 0) {
          @if (aviso(); as a) { <p class="exito" role="status">{{ a }}</p> }
          @if (error(); as e) { <p class="error" role="alert">{{ e }}</p> }
        }
      </form>
    }

    <section class="filtros" aria-label="Filtros">
      <input type="search" class="buscador" placeholder="🔍 Buscar colonia, código postal o tarifa"
             [value]="q()" (input)="q.set($any($event.target).value)" aria-label="Buscar colonia" />
      <div class="chips" role="group" aria-label="Tipo">
        <button type="button" class="chip" [class.elegido]="!tipo()" (click)="tipo.set('')">Todas <b>{{ porTipo()[''] ?? 0 }}</b></button>
        @for (t of tiposConColonias(); track t) {
          <button type="button" class="chip" [class.elegido]="tipo() === t" (click)="tipo.set(t)">{{ plural(t) }} <b>{{ porTipo()[t] }}</b></button>
        }
      </div>
      <div class="selects">
        <select aria-label="Tarifa" (change)="tarifa.set($any($event.target).value)">
          <option value="" [selected]="!tarifa()">Todas las tarifas</option>
          <option [value]="sinTarifaValor" [selected]="tarifa() === sinTarifaValor">Sin tarifa</option>
          @for (z of zonas(); track z) { <option [value]="z" [selected]="tarifa() === z">{{ z }}</option> }
        </select>
        @if (q() || tipo() || tarifa()) { <button type="button" class="limpiar" (click)="limpiar()">Limpiar filtros</button> }
      </div>
    </section>
    <p class="resultado" role="status">{{ lista().length }} de {{ activas().length }}</p>
    @if (fila() !== null && fila() !== 0 && !esSolicitud()) {
      @if (aviso(); as a) { <p class="exito" role="status">{{ a }}</p> }
    }

    <table class="tabla-colonias">
      <thead><tr><th>Nombre</th><th class="solo-pc">Tipo</th><th class="solo-pc">C.P.</th><th>Tarifa</th><th class="solo-pc">Pedidos</th><th></th></tr></thead>
      <tbody>
        @for (c of lista(); track c.id) {
          <tr [class.abierto]="abierta() === c.id">
            <td>
              <strong>{{ c.nombre }}</strong>
              <small class="solo-cel">{{ c.tipo }}@if (c.codigoPostal) { · {{ c.codigoPostal }} } · {{ c.pedidos }} {{ c.pedidos === 1 ? 'pedido' : 'pedidos' }}</small>
            </td>
            <td class="solo-pc">{{ c.tipo }}</td>
            <td class="solo-pc">{{ c.codigoPostal ?? '—' }}</td>
            <td>
              <select class="tarifa" [class.vacia]="!c.zona" aria-label="Tarifa de {{ c.nombre }}"
                      (change)="guardar(c, c.nombre, c.tipo, c.codigoPostal ?? '', $any($event.target).value)" [disabled]="ocupado()">
                <option value="" [selected]="!c.zona">Sin tarifa</option>
                @for (z of zonas(); track z) { <option [value]="z" [selected]="z === c.zona">{{ z }}</option> }
                @if (c.zona && !zonas().includes(c.zona)) { <option [value]="c.zona" selected>{{ c.zona }} (ya no existe)</option> }
              </select>
            </td>
            <td class="solo-pc">{{ c.pedidos }}</td>
            <td class="flecha">
              <button type="button" class="abre" (click)="abrir(c.id)" [attr.aria-expanded]="abierta() === c.id" aria-label="Más acciones">
                {{ abierta() === c.id ? '▴' : '▾' }}
              </button>
            </td>
          </tr>
          @if (abierta() === c.id) {
            <tr class="detalle"><td colspan="6">
              <form class="edicion" (submit)="$event.preventDefault(); guardar(c, en.value, et.value, ec.value, c.zona ?? '')">
                <label>Nombre <input #en type="text" maxlength="100" [value]="c.nombre" /></label>
                <label>Tipo
                  <select #et>@for (t of tipos; track t) { <option [value]="t" [selected]="t === c.tipo">{{ t }}</option> }</select>
                </label>
                <label>C.P. <input #ec type="text" inputmode="numeric" maxlength="5" [value]="c.codigoPostal ?? ''" /></label>
                <button class="btn primario" type="submit" [disabled]="ocupado()">Guardar</button>
              </form>
              <div class="acciones-fila">
                @if (confirmando() === c.id) {
                  <span>¿Eliminar «{{ c.nombre }}»? Los pedidos que ya la tienen no cambian.</span>
                  <button type="button" class="btn primario" (click)="eliminar(c)" [disabled]="ocupado()">Sí, eliminar</button>
                  <button type="button" class="btn secundario" (click)="confirmando.set(null)">Cancelar</button>
                } @else {
                  <button type="button" class="btn secundario" (click)="confirmando.set(c.id)">🗑️ Eliminar</button>
                }
              </div>
              @if (fila() === c.id) {
                @if (aviso(); as a) { <p class="exito" role="status">{{ a }}</p> }
                @if (error(); as e) { <p class="error" role="alert">{{ e }}</p> }
              }
            </td></tr>
          }
        } @empty {
          <tr><td colspan="6" class="ayuda vacio">{{ datos.isLoading() ? 'Cargando… (si el servidor estaba dormido, tarda hasta un minuto)' : datos.error() ? 'No se pudieron cargar.' : 'Ninguna coincide con los filtros.' }}</td></tr>
        }
      </tbody>
    </table>
    @if (datos.error(); as e) {
      <p class="error" role="alert">
        No se pudieron cargar las colonias ({{ mensaje(e) }}).
        <button type="button" class="btn secundario" (click)="datos.reload()">Reintentar</button>
      </p>
    }
  `,
  styles: `
    .solicitudes { border: 1px solid #fdba74; background: #fff7ed; border-radius: .75rem; padding: .75rem 1rem; margin-bottom: 1.25rem; }
    .solicitudes h2 { margin: 0 0 .25rem; font-size: 1.05rem; color: #7c2d12; }
    .cuenta { background: #ea580c; color: #fff; border-radius: 999px; padding: 0 .5rem; font-size: .8rem; margin-left: .25rem; }
    .solicitud { display: grid; gap: .5rem; grid-template-columns: 2fr 1fr 1fr; align-items: center; padding: .6rem 0; border-top: 1px solid #fed7aa; }
    .solicitud .quien { grid-column: 1 / -1; }
    .solicitud .quien small { display: block; color: var(--tinta-suave); }
    .solicitud .acciones-fila { margin: 0; grid-column: 1 / -1; }
    .solicitud .error { grid-column: 1 / -1; }
    .encabezado { display: flex; justify-content: space-between; align-items: center; gap: .75rem; flex-wrap: wrap; margin-bottom: .75rem; }
    .encabezado p { margin: 0; }
    .nueva, .edicion { display: grid; gap: .6rem; grid-template-columns: 2fr 1fr .8fr 1fr auto; align-items: end; margin-bottom: 1rem; }
    .edicion { grid-template-columns: 2fr 1fr .8fr auto; margin-bottom: .5rem; }
    .nueva label, .edicion label { display: grid; gap: .25rem; font-size: .85rem; font-weight: 600; }
    .nueva .exito, .nueva .error { grid-column: 1 / -1; margin: 0; }
    .filtros { display: grid; gap: .6rem; padding: .75rem; border: 1px solid var(--linea); border-radius: .75rem; background: var(--superficie); }
    .buscador { width: 100%; padding: .6rem .8rem; font-size: 1rem; }
    .chips { display: flex; flex-wrap: wrap; gap: .4rem; }
    .chip { border: 1px solid var(--linea); background: var(--superficie); color: var(--tinta); border-radius: 999px; padding: .3rem .75rem; font-size: .85rem; cursor: pointer; }
    .chip b { color: var(--tinta-suave); font-weight: 600; margin-left: .15rem; }
    .chip.elegido { border-color: var(--follaje); color: var(--follaje); font-weight: 600; background: color-mix(in srgb, var(--follaje) 10%, var(--superficie)); }
    .selects { display: flex; flex-wrap: wrap; gap: .5rem; align-items: center; }
    .selects select { width: auto; padding: .4rem .5rem; font-size: .85rem; }
    .limpiar { background: none; border: 0; color: var(--follaje); text-decoration: underline; cursor: pointer; font-size: .85rem; }
    .resultado { margin: .6rem .15rem; font-size: .85rem; color: var(--tinta-suave); }
    .tabla-colonias { width: 100%; border-collapse: separate; border-spacing: 0; border: 1px solid var(--linea); border-radius: .75rem; overflow: hidden; background: var(--superficie); }
    .tabla-colonias th { text-align: left; font-size: .72rem; text-transform: uppercase; letter-spacing: .04em; color: var(--tinta-suave); padding: .55rem .7rem; border-bottom: 1px solid var(--linea); background: var(--fondo-alt); }
    .tabla-colonias td { padding: .45rem .7rem; border-bottom: 1px solid var(--linea); vertical-align: middle; }
    .tabla-colonias tbody tr:last-child td { border-bottom: 0; }
    tr.abierto td, .detalle td { background: color-mix(in srgb, var(--follaje) 6%, var(--superficie)); }
    .tarifa { width: auto; min-width: 8rem; padding: .3rem .4rem; font-size: .85rem; }
    .tarifa.vacia { color: var(--tinta-suave); border-style: dashed; }
    .flecha { width: 2rem; text-align: right; }
    .abre { background: none; border: 0; color: var(--tinta-suave); font-size: 1rem; cursor: pointer; padding: .2rem; }
    .vacio { text-align: center; padding: 1.25rem !important; }
    .solo-cel { display: none; }
    @media (max-width: 640px) {
      .solo-pc { display: none; }
      .solo-cel { display: block; color: var(--tinta-suave); font-size: .78rem; margin-top: .1rem; }
      .solicitud, .nueva, .edicion { grid-template-columns: 1fr 1fr; }
      .solicitud input, .nueva label:first-child, .edicion label:first-child { grid-column: 1 / -1; }
      .encabezado .btn { width: 100%; }
      .tarifa { min-width: 0; max-width: 9.5rem; }
    }
  `,
})
export class ColoniasPage {
  private readonly api = inject(AdminApi);
  protected readonly tipos = TIPOS_COLONIA;
  protected readonly plural = plural;
  protected readonly sinTarifaValor = SIN_TARIFA;

  protected readonly datos = rxResource({ stream: () => this.api.colonias() });
  /** value() lanza un error si la carga falló: se lee solo cuando hay datos. */
  private readonly cargado = computed(() => (this.datos.hasValue() ? this.datos.value() : undefined));
  private readonly todas = computed(() => this.cargado()?.colonias ?? []);
  protected readonly zonas = computed(() => this.cargado()?.zonas ?? []);
  protected readonly solicitudes = computed(() =>
    this.todas().filter((c) => c.estado === 'SOLICITADA').sort((a, b) => b.solicitudes - a.solicitudes),
  );
  protected readonly activas = computed(() => this.todas().filter((c) => c.estado === 'ACTIVA'));
  protected readonly sinTarifa = computed(() => this.activas().filter((c) => !c.zona).length);

  protected readonly q = signal('');
  protected readonly tipo = signal('');
  protected readonly tarifa = signal('');
  protected readonly lista = computed(() => filtrarColonias(this.todas(), this.q(), this.tipo(), this.tarifa()));
  /** Cuántas hay de cada tipo con la búsqueda y la tarifa aplicadas ('' = todas). */
  protected readonly porTipo = computed(() => {
    const base = filtrarColonias(this.todas(), this.q(), '', this.tarifa());
    const r: Record<string, number> = { '': base.length };
    for (const c of base) r[c.tipo] = (r[c.tipo] ?? 0) + 1;
    return r;
  });
  protected readonly tiposConColonias = computed(() => this.tipos.filter((t) => this.activas().some((c) => c.tipo === t)));

  protected readonly agregando = signal(false);
  protected readonly abierta = signal<number | null>(null);
  protected readonly confirmando = signal<number | null>(null);
  protected readonly ocupado = signal(false);
  /** Dónde se muestra el aviso: id de la colonia, 0 = formulario de agregar. */
  protected readonly fila = signal<number | null>(null);
  protected readonly aviso = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly esSolicitud = computed(() => this.solicitudes().some((c) => c.id === this.fila()));

  protected mensaje(e: unknown): string {
    return mensajeDeError((e as { cause?: unknown })?.cause ?? e);
  }

  protected abrir(id: number): void {
    this.confirmando.set(null);
    this.abierta.set(this.abierta() === id ? null : id);
  }

  protected limpiar(): void {
    this.q.set('');
    this.tipo.set('');
    this.tarifa.set('');
  }

  protected crear(nombre: string, tipo: string, codigoPostal: string, zona: string): void {
    this.ejecutar(0, this.api.crearColonia({ nombre, tipo, codigoPostal: codigoPostal.trim(), zona }), (c) => {
      this.agregando.set(true);
      return `Listo: «${c.nombre}» ya aparece al hacer pedidos.`;
    });
  }

  protected guardar(c: ColoniaAdmin, nombre: string, tipo: string, codigoPostal: string, zona: string): void {
    const d: DatosColonia = { nombre, tipo, codigoPostal: codigoPostal.trim(), zona };
    const solicitada = c.estado === 'SOLICITADA';
    this.ejecutar(c.id, this.api.editarColonia(c.id, d), (r) =>
      solicitada
        ? `«${r.nombre}» ya está en el catálogo.`
        : zona !== (c.zona ?? '') && nombre === c.nombre
          ? `«${r.nombre}»: ${r.zona ? 'tarifa ' + r.zona : 'sin tarifa'}.`
          : `Se guardó «${r.nombre}».`,
    );
  }

  protected eliminar(c: ColoniaAdmin): void {
    const solicitada = c.estado === 'SOLICITADA';
    this.ejecutar(c.id, this.api.eliminarColonia(c.id), () =>
      solicitada ? `Se descartó «${c.nombre}».` : `Se eliminó «${c.nombre}».`,
    );
  }

  private ejecutar<T>(fila: number, accion: Observable<T>, exito: (r: T) => string): void {
    this.fila.set(fila);
    this.aviso.set(null);
    this.error.set(null);
    this.ocupado.set(true);
    accion.pipe(finalize(() => this.ocupado.set(false))).subscribe({
      next: (r) => {
        this.aviso.set(exito(r));
        this.confirmando.set(null);
        if (fila !== 0) this.fila.set(-1);   // el aviso se muestra arriba de la tabla
        this.datos.reload();
      },
      error: (e) => this.error.set(mensajeDeError(e)),
    });
  }
}
