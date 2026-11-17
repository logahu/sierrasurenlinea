# Plan: portada «calles por giro» y banners de publicidad

Spec: `docs/superpowers/specs/2026-11-17-portada-calles-por-giro-design.md` (opción B, aprobada).
Rama: `feature/portada-calles-por-giro`. Sin merge hasta que Hugo revise el PR.

## Decisiones del constructor

- **Migración V29**, no V28: la V28 ya es `V28__estudio_melgarejo_portada.sql`.
- Los negocios se asignan por slug (incluye el slug viejo `cosmeticos` por si acaso);
  cualquiera que no coincida queda en **servicios** antes de poner `giro_id NOT NULL`.
- **Fotos de anuncios**: se suben con el componente de fotos existente en la carpeta del
  negocio enlazado; si el anuncio no enlaza negocio, en la del primer negocio por orden.
  Un anuncio acepta cualquier foto subida (no borrada) o una imagen de ejemplo `img/…`.
  `Foto.usos()` cuenta los anuncios, para que no se pueda borrar una foto en uso.
- **Clics**: `POST /api/visitas` con `ruta = /anuncio/{id}`; se amplía `RUTA_VALIDA` para
  aceptar `/anuncio/{id}` y `/giro/{slug}` (la página nueva también cuenta visitas).
- **Enlace del anuncio**: ruta interna que empiece con `/` o URL `https://`; nada más.
- **Iconos de giro**: nombre corto en la tabla (`flor`, `belleza`, `fiesta`, `bebida`,
  `comida`, `auto`, `moto`) y SVG en línea en el frontend; uno genérico si no se conoce.
- **Orden de las calles**: por `giro.orden`; dentro de cada calle, por `negocio.orden`.
  Los giros sin negocios visibles no se muestran (ni chip ni calle).
- **Bitácora**: nueva entidad `ANUNCIO`; cambiar de giro un negocio queda en su bitácora.

## Pasos

Cada paso termina con pruebas en verde, commit y push (la CI corre `mvn verify` y las
pruebas contra PostgreSQL; `mvn` no se puede correr en este entorno).

1. **Spec y plan** en `docs/superpowers/`.
2. **Backend: giros**
   - `V29__giros_y_anuncios.sql`: tabla `giro` + 7 giros, `negocio.giro_id` asignado y NOT NULL,
     tabla `anuncio`. Probar la migración en PostgreSQL embebido (PGlite) contra todas las previas.
   - Entidad `Giro`, `Negocio.giro`; `GiroDto`; `GET /api/giros` (con conteo de negocios visibles).
   - `NegocioDto.giro {slug, nombre}`; `GET /api/negocios?giro=` (giro inexistente → lista vacía).
   - Panel: `NegocioAdminDto.giro`, `NegocioEdicion.giro` (solo el dueño), bitácora.
   - Pruebas: `GirosTest` (orden, conteo, filtro, asignación inicial, cambio de giro por dueño
     y que el encargado no pueda).
3. **Backend: anuncios**
   - Entidad `Anuncio`; `GET /api/anuncios?posicion=` (activos y vigentes, en orden).
   - `AdminAnuncioResource` (`/api/admin/anuncios`, solo DUENO): listar, crear, editar,
     activar/pausar; validación de enlace, fechas, posición, color, imagen.
   - `Foto.usos()` con anuncios; `RUTA_VALIDA` con `/anuncio/{id}` y `/giro/{slug}`.
   - Pruebas: `AnunciosTest` (vigencia por fechas, pausados ocultos, posición, permisos,
     validaciones), visitas con las rutas nuevas.
4. **Frontend: modelo y portada**
   - Modelos `Giro`, `Anuncio`; `CatalogoService.giros()` y `anuncios(posicion)`.
   - Funciones puras (`calles-por-giro.ts`): agrupar por giro, límite de 6 con «+N», filtro.
   - `inicio-page`: banner arriba → chips con conteo (`?giro=`) → calles deslizables con
     fachadas (toldo del color del negocio) → banner entre calles (después de la 2.ª) →
     «Cómo pedir» → «Lo más pedido». Conserva aviso de obra, carga lenta y modo oscuro.
   - `giro-page` en `/giro/:slug`: todas las fachadas del giro en cuadrícula.
5. **Frontend: BannerPublicidad**: carrusel cada 6 s (quieto con `prefers-reduced-motion`
   o con el foco/cursor encima), etiqueta «Publicidad», × que oculta 7 días en
   `localStorage`, enlace «Mostrar publicidad»; registra el clic.
6. **Frontend: panel**: selector de giro en Datos del negocio (dueño); pantalla
   **Publicidad** (`/admin/publicidad`, solo dueño) con lista, alta/edición, pausar,
   fechas y foto.
7. **Pruebas Vitest**: agrupado/filtro, límite de 6 + «Ver todos», ocultar y volver a
   mostrar el banner (7 días), vigencia en el cliente.
8. **Verificación**: `ng build` de producción, `ng test`, capturas en claro/oscuro y
   celular/escritorio con datos simulados, contraste de los colores nuevos.
9. **PR** con resumen y capturas. Sin merge.
