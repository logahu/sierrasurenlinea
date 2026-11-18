# Portada «Directorio» (estilo A) con giros, buscador y publicidad

Fecha: 2026-11-17 · Estado: aprobado por Hugo · Reemplaza a
`2026-11-17-portada-calles-por-giro-design.md` (opción B)

## Intención

La portada actual es una sola «calle» de fachadas y no escala. Hugo eligió el
**estilo A** de las maquetas (`maquetas-sierrasur.html`, pestaña «A · Directorio»):
buscador, filtros por giro y una cuadrícula de tarjetas iguales para todos los
negocios. Debe aguantar decenas o cientos de negocios y llevar **banners de
publicidad que el visitante puede ocultar**.

## Metas

- Portada tipo directorio: banner → título → buscador + orden → chips de giro con
  conteo → resumen («14 negocios») → cuadrícula de tarjetas.
- Filtrar por giro y buscar por texto sin recargar la página.
- Banners administrables desde el panel y ocultables por el visitante.
- Conservar: «Cómo pedir», «Lo más pedido», estados PUBLICO/PRUEBAS, aviso de
  obra, mensaje de servidor despertando, modo oscuro, PWA.

## Fuera de alcance

- Plantillas de diseño por negocio (después).
- «Abierto ahora» y el orden «Abiertos ahora»: el horario hoy es texto libre
  (`horario`), no se puede calcular. Se muestra el texto del horario; el cálculo
  queda para cuando exista un horario estructurado.
- Las calles de fachadas (opción B). Si ya existe código de B, se reemplaza su
  portada; lo de backend (giros y anuncios) se reutiliza.

## Anti-metas

- Publicidad que se confunda con contenido: siempre con etiqueta «Publicidad» o «Patrocinado».
- Publicidad imposible de quitar: × la oculta y queda «Mostrar publicidad».
- Agregar un giro o negocio que requiera deploy.

## Enfoques considerados

| | Qué es | Resultado |
|---|---|---|
| **A · Directorio (elegida)** | Buscador + chips + cuadrícula | Escala mejor y es lo que la gente conoce de apps de delivery. |
| B · Calles por giro | Una calle deslizable por giro | Descartada: más carácter, pero se satura. |
| C · Secciones | Portada tipo app | Descartada: mucho contenido que mantener. |

## Diseño

### Backend (Quarkus)

1. **Giros** (si no existen ya por la opción B): tabla `giro` (`id`, `slug`,
   `nombre`, `icono`, `orden`) y `negocio.giro_id` (FK, NOT NULL), en una migración
   Flyway nueva con el siguiente número libre. Giros iniciales: Flores y regalos,
   Belleza, Fiestas y eventos, Bebidas, Comida, Autos, Mandados y servicios.
   Asignación: TuRamoHoy→flores, Belleza y Estudio Melgarejo→belleza,
   Inflables→fiestas, Vinatería→bebidas, Autos→autos, Encarguitos→servicios.
2. **Fecha de alta**: `negocio.creado_en` (timestamp; los existentes con la fecha
   de la migración). Sirve para la etiqueta «Nuevo» (≤ 30 días) y el orden «Nuevos».
3. `GET /api/giros`; `NegocioDto` agrega `giro {slug, nombre, icono}` y `creadoEn`;
   `GET /api/negocios?giro=` filtra.
4. **Anuncios**: tabla `anuncio` (`id`, `titulo`, `texto`, `imagen_url`, `enlace`,
   `negocio_id` opcional, `color_fondo`, `posicion`, `inicio`, `fin`, `activo`, `orden`).
   Posiciones: `PORTADA_ARRIBA` (banner) y `DIRECTORIO` (requiere `negocio_id`:
   esa tarjeta sube al principio con la etiqueta «Patrocinado»).
   `GET /api/anuncios?posicion=` devuelve solo los activos y vigentes.
   Clics: contador de visitas existente con `ruta = anuncio/{id}`.
5. Panel `/admin`: selector de giro en los datos del negocio; pantalla nueva
   **Publicidad** (alta/edición, activar/pausar, fechas, imagen con el componente
   de fotos existente). Solo el dueño del sitio.
6. Pruebas `@QuarkusTest`: filtro por giro, vigencia de anuncios, orden de patrocinados.

### Frontend (Angular)

1. `inicio-page` nueva estructura:
   - `BannerPublicidad` (`PORTADA_ARRIBA`).
   - Título «Los negocios de Miahuatlán, a un mensaje de distancia» + subtítulo.
   - Buscador (busca en nombre, eslogan y giro; sin acentos ni mayúsculas;
     debounce 200 ms) + selector de orden: Recomendados (patrocinados, luego
     `orden`), Nuevos, A–Z.
   - Chips de giro con icono SVG en línea y conteo; «Todos» primero; fila
     deslizable en celular.
   - Resumen «N negocios»; estado vacío «No encontramos negocios con esa búsqueda»
     con botón para limpiar.
   - Cuadrícula `repeat(auto-fill, minmax(230px, 1fr))`; 2 columnas en celular.
   - Después: «Cómo pedir» y «Lo más pedido» como hoy.
2. **Tarjeta de negocio**: portada (`portadaUrl`) sobre fondo del color del negocio
   al 14 %; sin foto, iniciales en un cuadro de su color. Etiquetas arriba a la
   izquierda: Patrocinado, Nuevo, +18, «en pruebas». Cuerpo: nombre, «giro · tipo»
   (Venta/Renta/Servicio/Citas), eslogan (2 líneas, oculto en celular) y horario.
   Toda la tarjeta es un enlace a `/:slug`.
3. Giro, búsqueda y orden se reflejan en la URL (`/?giro=flores&q=rosas&orden=nuevos`).
4. `BannerPublicidad`: carrusel (6 s, se detiene con `prefers-reduced-motion` y al
   pasar el mouse), etiqueta «Publicidad», × que guarda la preferencia 7 días en
   `localStorage` (con try/catch), enlace «Mostrar publicidad». Sin anuncios: nada.
5. Estilo: paleta base del sitio (`styles.scss`: follaje, cempasúchil, rosa,
   Fraunces + DM Sans); se retira la paleta propia de la «calle» de `inicio-page.scss`.
6. Accesibilidad: chips con `aria-pressed`, buscador con `<label>`, resultados
   con `aria-live="polite"`, foco visible, contraste 4.5:1 en claro y oscuro.
7. Pruebas Vitest: filtro por giro, búsqueda sin acentos, orden, patrocinados
   primero, ocultar/mostrar banner.

## Lo que decide quien construya

Nombres de clases y componentes, iconos de cada giro, animaciones menores, tamaño
exacto de las tarjetas.
