# Portada «calles por giro» y banners de publicidad

Fecha: 2026-11-17 · Estado: aprobado por Hugo

## Intención

La portada actual es una sola «calle» de fachadas. Con 6–7 negocios funciona,
pero el sitio va a crecer y ya no se podrá recorrer. Hugo eligió la **opción B**
de las maquetas: conservar la idea de las fachadas, pero con **una calle por giro**
(Flores y regalos, Belleza, Fiestas y eventos, Bebidas, Comida, Autos, Mandados y
servicios), filtros por giro y **banners de publicidad que el visitante puede ocultar**.

## Metas

- Portada agrupada por giro, con filtros (chips) que muestran solo una calle.
- Aguantar decenas de negocios por giro sin saturarse.
- Banners de publicidad administrables y ocultables por el visitante.
- Mantener lo que ya hay: «Cómo pedir», «Lo más pedido», estados PUBLICO/PRUEBAS,
  aviso de obra, carga lenta del servidor, modo oscuro.

## Fuera de alcance (por ahora)

- Plantillas de diseño por negocio (se verán después).
- El bloque de accesos de la opción C y la opción híbrida.
- Buscador de texto (B no lo incluye; se puede agregar después).

## Anti-metas

- Que la publicidad se confunda con el contenido: siempre lleva la etiqueta «Publicidad».
- Que un visitante no pueda quitarla: la × la oculta y queda «Mostrar publicidad».
- Que agregar un giro o un negocio requiera deploy.

## Enfoques considerados

| | Qué es | Pros / contras |
|---|---|---|
| A · Directorio | Buscador + cuadrícula | Escala mejor; pierde el carácter de «calle». |
| **B · Calles por giro (elegida)** | Una calle deslizable por giro + chips | Conserva la identidad del sitio; se satura si una calle crece sin límite (se resuelve con «Ver todos»). |
| C · Secciones | Portada tipo app | Más rica; más contenido que mantener. |

## Diseño

### Backend (Quarkus)

1. **Giro como catálogo**: tabla `giro` (`id`, `slug`, `nombre`, `icono`, `orden`)
   con migración `V29__giros_y_anuncios.sql` (V28 ya la usa la portada de Estudio
   Melgarejo) que crea los 7 giros iniciales. `negocio` recibe
   `giro_id` (FK, NOT NULL) y la migración asigna los negocios actuales
   (TuRamoHoy→flores, Belleza y Estudio Melgarejo→belleza, Inflables→fiestas,
   Vinatería→bebidas, Autos→autos, Encarguitos→servicios).
   Tabla y no enum, para crear giros sin deploy.
2. `GET /api/giros` (orden). `NegocioDto` agrega `giro: {slug, nombre}`.
   `GET /api/negocios?giro={slug}` filtra.
3. **Anuncios**: tabla `anuncio` (`id`, `titulo`, `texto`, `imagen_url`, `enlace`
   — ruta interna o URL —, `negocio_id` opcional, `color_fondo`, `posicion`
   `PORTADA_ARRIBA | ENTRE_CALLES`, `inicio`, `fin`, `activo`, `orden`).
   `GET /api/anuncios?posicion=` devuelve solo los vigentes y activos.
   Clics: se registran con el contador de visitas existente (`ruta = anuncio/{id}`).
4. Panel `/admin`: el formulario del negocio gana el selector de giro; nueva
   pantalla **Publicidad** (lista, alta/edición, activar/pausar, fechas, foto con
   el componente de fotos existente). Solo el dueño del sitio.
5. Pruebas con `@QuarkusTest` como las actuales: filtro por giro, vigencia de anuncios.

### Frontend (Angular)

1. `inicio-page` se reorganiza: encabezado → banner `PORTADA_ARRIBA` → chips de giro
   (con conteo) → una sección «Calle de …» por giro con negocios → «Cómo pedir» →
   «Lo más pedido». Un banner `ENTRE_CALLES` después de la 2.ª calle.
2. Cada calle: fila deslizable (scroll-snap) con hasta **6 fachadas**; si hay más,
   una tarjeta «+N Ver todos» que lleva a **`/giro/:slug`**, página nueva con todas
   las fachadas del giro en cuadrícula.
3. Los chips filtran en el cliente (la lista completa ya llega) y reflejan el giro
   en la URL (`/?giro=flores`) para poder compartir el enlace.
4. Fachadas: se reutiliza el estilo actual (rótulo, ventana, avisos «Se rentan»,
   «+18», «en pruebas»), con el toldo del color del negocio.
5. Componente `BannerPublicidad`: carrusel simple (cambia cada 6 s, se detiene con
   `prefers-reduced-motion`), etiqueta «Publicidad», botón × que guarda la
   preferencia en `localStorage` por 7 días; enlace «Mostrar publicidad».
   Sin anuncios vigentes no se muestra nada.
6. Accesible: chips como `role="tablist"`/botones con `aria-pressed`, filas con
   `aria-label`, foco visible; contraste 4.5:1 en claro y oscuro.
7. Pruebas Vitest: filtrado por giro, límite de 6 + «Ver todos», ocultar banner.

## Lo que decide quien construya

Nombres exactos de clases/componentes, iconos de cada giro (SVG en línea,
sin dependencias), animaciones menores.
