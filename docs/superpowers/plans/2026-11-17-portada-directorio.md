# Plan: portada «Directorio» (estilo A)

Spec: `docs/superpowers/specs/2026-11-17-portada-directorio-design.md` (aprobada; reemplaza a la opción B).
Rama: `feature/portada-directorio`, desde `main`. Sin merge hasta que Hugo revise el PR.

## Punto de partida

La opción B ya está en `main` (PR #5). Se **reutiliza** su backend:
`giro`, `negocio.giro_id`, `anuncio` (V29), `GET /api/giros` con conteo, `GET /api/negocios?giro=`,
`GET /api/anuncios?posicion=`, `/api/admin/anuncios`, selector de giro y pantalla «Publicidad»
en el panel, clics por `/api/visitas` con `ruta = /anuncio/{id}` y el componente `BannerPublicidad`.

Se **reemplaza** la portada de calles (`inicio-page`, `calles.ts`, estilos de la calle).

## Decisiones del constructor

- **Migración V32** (la V31 es `agenda_bloqueos`):
  - `negocio.creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP`; los existentes quedan con la
    fecha de la migración.
  - Posición `ENTRE_CALLES` → **`DIRECTORIO`**. Los anuncios que hubiera en `ENTRE_CALLES` pasan a
    `PORTADA_ARRIBA` (siguen viéndose; ya no hay «entre calles»). Se cambia el CHECK.
- `DIRECTORIO` **exige negocio**; la tarjeta de ese negocio sube al principio con «Patrocinado».
  Si un negocio tiene varios anuncios de directorio vigentes, cuenta el de menor `orden`.
- `NegocioDto` agrega `creadoEn`, `patrocinado` y `giro.icono`.
- `GET /api/negocios` (portada) devuelve **primero los patrocinados** (por `orden` del anuncio) y
  luego el resto por `negocio.orden`: es el orden «Recomendados». «Nuevos» y «A–Z» los ordena el
  frontend (ya tiene todos los negocios; son pocos).
- **Búsqueda** en el frontend: nombre, eslogan y nombre del giro; sin acentos ni mayúsculas;
  debounce 200 ms; el texto queda en la URL al dejar de escribir.
- **URL**: `/?giro=flores&q=rosas&orden=nuevos` (solo lo que no es el valor por omisión),
  con `replaceUrl` para no llenar el historial al escribir.
- **Conteo de los chips**: negocios visibles por giro, calculado en el frontend sobre la lista ya
  cargada (así los probadores ven el conteo correcto); los giros sin negocios no se muestran.
- **Etiqueta «Nuevo»**: `creadoEn` en los últimos 30 días.
- **Tarjeta**: «giro · Venta/Renta/Servicio/Citas» según `tipo` y `modoPedido` (CITA → Citas,
  RENTA → Renta, SERVICIO → Servicio, lo demás → Venta).
- **Banner**: el `BannerPublicidad` existente ya hace carrusel, ×, 7 días y «Mostrar publicidad»;
  se revisa contra la spec (6 s, pausa al pasar el mouse y con `prefers-reduced-motion`).
- Iconos de giro: los SVG en línea de las maquetas (flor, belleza, fiesta, bebida, comida, auto, moto)
  y uno genérico.

## Pasos

Cada paso termina con pruebas en verde, commit y push. `mvn` no está disponible en este entorno:
las pruebas de Quarkus corren en la CI de GitHub (H2 y PostgreSQL) en cada push; `npm test` y
`ng build` se corren aquí antes de cada commit.

1. **Spec y plan** en `docs/superpowers/`.
2. **Backend**
   - `V32__portada_directorio.sql`; `Negocio.creadoEn`; `Anuncio.DIRECTORIO` (exige negocio).
   - `NegocioDto.creadoEn/patrocinado/giro.icono`; `listar` con patrocinados primero.
   - `GET /api/anuncios` acepta `DIRECTORIO`.
   - Pruebas `@QuarkusTest`: creado_en presente; `DIRECTORIO` sin negocio → 400; patrocinados
     primero y marcados; un patrocinio vencido o pausado ya no sube; `ENTRE_CALLES` ya no se acepta.
3. **Panel**: «Publicidad» ofrece *Portada (banner)* y *Directorio (patrocinado)*; en directorio el
   negocio es obligatorio y se explica el efecto.
4. **Frontend: lógica pura** (`directorio.ts`): normalizar texto, filtrar por giro y búsqueda,
   ordenar (recomendados / nuevos / A–Z), conteo por giro, «Nuevo», texto «giro · tipo»,
   iniciales, leer/escribir filtros de la URL. Pruebas Vitest.
5. **Frontend: `inicio-page`** nueva: banner → título → buscador + orden → chips → resumen
   (`aria-live`) → cuadrícula → estado vacío con «Limpiar». Conserva aviso de obra, servidor
   despertando, «Cómo pedir» y «Lo más pedido». Se borra `calles.ts` y los estilos de la calle.
6. **`BannerPublicidad`**: ajustes contra la spec + pruebas (ocultar / mostrar).
7. **Revisión visual** en celular y escritorio, claro y oscuro, con capturas; contraste 4.5:1.
8. **PR** con resumen y capturas. Sin merge.
