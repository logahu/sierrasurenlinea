# Tianguis Sierra Sur — Instrucciones de implementación (Fases 1 y 2)

## Contexto

- Sitio: **sierrasurenlinea.com.mx**, repositorio GitHub `logahu/sierrasurenlinea`.
- Stack: backend **Quarkus** (desplegado en Render), frontend **Angular PWA** (Cloudflare Workers), fotos en **Cloudflare R2**.
- El sitio ya es multi-negocio (florería TuRamoHoy, Belleza, inflables, vinatería, Estudio Melgarejo, Encarguitos), con portada estilo **Directorio** (buscador, filtros por giro, tarjetas), logo «pin conectado» y panel de administración en `/admin` (login con correo y contraseña, un encargado por negocio).
- Objetivo: agregar una nueva sección de compra-venta de artículos de segunda mano llamada **Tianguis Sierra Sur**.

## Reglas de trabajo

1. **Antes de escribir código, revisa el repositorio**: estructura de módulos, entidades, convenciones de nombres, cómo está hecha la autenticación del panel, cómo se suben las fotos a R2 y cómo se registran los negocios/giros. Reutiliza lo existente; no dupliques servicios ni componentes.
2. Sigue el estilo de código, el sistema de diseño y los colores actuales del sitio.
3. Trabaja en una rama nueva: `feature/tianguis`. Commits pequeños y descriptivos.
4. **Pide confirmación antes de borrar cualquier archivo** del proyecto (los archivos temporales o de prueba que tú mismo crees sí puedes borrarlos).
5. Si algo de este documento choca con lo que ya existe en el repo, detente y pregunta antes de decidir.
6. Al terminar cada fase: compila, ejecuta las pruebas y resume qué cambió.

## Identidad de la sección

- Nombre: **Tianguis Sierra Sur**
- Subtítulo: *Compra y vende de segunda mano*
- Ruta pública: `/tianguis`; ficha: `/tianguis/:id-slug`; categoría: `/tianguis/c/:categoriaSlug`
- Debe aparecer como un giro más en la portada Directorio y en los filtros por giro.
- Metadatos SEO (title/description/Open Graph) con las palabras "segunda mano", "Miahuatlán" y "Sierra Sur".

---

## FASE 1 — Catálogo administrado (MVP)

Solo el administrador o el encargado del Tianguis da de alta anuncios desde `/admin`. El público solo consulta y contacta por WhatsApp.

### 1.1 Modelo de datos (backend)

Adapta nombres y anotaciones a las convenciones del repo (Panache o repositorios, según lo que ya se use).

**CategoriaTianguis**
- `id`, `nombre`, `slug`, `icono`, `orden`, `activa`
- `camposAtributos`: definición JSON de los campos específicos de la categoría (nombre, etiqueta, tipo, requerido).

Semilla inicial (por migración o import):

| Categoría | Atributos sugeridos |
|---|---|
| Vehículos | marca, modelo, año, km, transmisión, combustible, tipo (SUV/pickup/sedán) |
| Motos | marca, modelo, año, km, cilindrada |
| Celulares y electrónica | marca, modelo, almacenamiento, estado de batería, IMEI limpio (sí/no) |
| Muebles y hogar | material, medidas |
| Herramientas | marca, tipo (eléctrica/manual) |
| Ropa, calzado y bebé | talla, género |
| Otros | — |

**Vendedor**
- `id`, `nombre`, `whatsapp` (10 dígitos, normalizado con lada 52), `verificado` (bool, lo marca el admin), `fechaRegistro`, `notasInternas`.

**Anuncio**
- `id`, `titulo` (máx. 80), `descripcion` (máx. 2000), `precio` (BigDecimal, MXN), `negociable` (bool)
- `condicion`: enum `NUEVO_SIN_USO`, `SEMINUEVO`, `USADO`, `REPARADO`
- `estado`: enum `PENDIENTE`, `PUBLICADO`, `VENDIDO`, `VENCIDO`, `RECHAZADO`, `PAUSADO`
- `modalidad`: enum `CLASIFICADO`, `CONSIGNACION`, `PROPIO`
- `categoria` (ManyToOne), `vendedor` (ManyToOne)
- `fotos`: lista ordenada de claves R2 (mínimo 1, máximo 8; la primera es la portada)
- `atributos`: mapa clave-valor guardado como JSON, validado contra `camposAtributos` de la categoría
- `ubicacion`: texto corto (localidad/colonia; **nunca dirección exacta**)
- `destacado` (bool; reservado para Fase 3, en Fase 1 solo se guarda)
- `motivoRechazo`, `fechaCreacion`, `fechaPublicacion`, `fechaVencimiento`, `fechaVendido`, `vistas`

Índices: `(estado, categoria_id, fechaPublicacion)`, `(estado, precio)`.

### 1.2 API pública

- `GET /api/tianguis/categorias` — categorías activas con conteo de anuncios publicados.
- `GET /api/tianguis/anuncios` — solo `PUBLICADO` (y `VENDIDO` con menos de 7 días). Parámetros: `q`, `categoria`, `condicion`, `precioMin`, `precioMax`, `orden` (`recientes`, `precioAsc`, `precioDesc`), `page`, `size` (máx. 24).
- `GET /api/tianguis/anuncios/{id}` — detalle; incrementa `vistas`. No exponer `notasInternas` ni datos internos del vendedor; el WhatsApp sí se expone para el botón de contacto.

### 1.3 API de administración (protegida con la autenticación actual del panel)

- CRUD de anuncios, categorías y vendedores.
- `PATCH /api/admin/tianguis/anuncios/{id}/estado` con transiciones válidas.
- Carga de fotos a R2 usando el mecanismo que ya exista; si no existe, URLs prefirmadas. Redimensionar o comprimir en el cliente (máx. ~1600 px, JPEG/WebP) antes de subir.
- Rol: crear el Tianguis como negocio/sección administrable, con acceso para el administrador general y para un encargado asignado, siguiendo el esquema de roles actual.

### 1.4 Frontend público (Angular)

- **Página `/tianguis`**: encabezado con nombre y subtítulo, buscador, chips de categorías, filtros (condición, rango de precio, orden), cuadrícula de tarjetas con paginación o scroll infinito.
- **Tarjeta**: foto de portada, título, precio (formato MXN), etiqueta de condición, localidad, "hace X días"; insignia "Vendido" si aplica.
- **Ficha**: galería con swipe en móvil, precio + "negociable", condición, atributos de la categoría en tabla, descripción, ubicación aproximada, insignia "Vendedor verificado" si aplica, y botón **Contactar por WhatsApp** con mensaje prellenado:
  `Hola, vi tu anuncio "<título>" en Tianguis Sierra Sur (<url>). ¿Sigue disponible?`
- Bloque fijo de **consejos de seguridad** en la ficha: verla en persona, reunirse en lugar público, no dar anticipos a desconocidos.
- Estados vacíos y de carga; diseño responsive y funcional en la PWA.

### 1.5 Panel `/admin` — sección Tianguis

- Lista de anuncios con filtros por estado y categoría, búsqueda, acciones rápidas (publicar, pausar, marcar vendido).
- Formulario de alta/edición: los campos de atributos se generan dinámicamente según la categoría elegida; carga y reordenamiento de fotos.
- Catálogo de vendedores (alta rápida desde el formulario del anuncio).
- Al publicar: `fechaPublicacion = ahora`, `fechaVencimiento = ahora + 30 días`.

### 1.6 Criterios de aceptación — Fase 1

- [ ] Tianguis aparece en la portada y en filtros por giro.
- [ ] El admin crea un anuncio de Vehículos con 3+ fotos y atributos, lo publica y se ve en `/tianguis` y en su ficha.
- [ ] Filtros, búsqueda y orden funcionan combinados.
- [ ] El botón de WhatsApp abre el chat con el mensaje prellenado.
- [ ] Un anuncio `PENDIENTE`, `RECHAZADO` o `PAUSADO` no es visible públicamente (ni por URL directa).
- [ ] Pruebas unitarias de servicio y de recursos REST para listado, filtros y transiciones de estado.

---

## FASE 2 — Publicación abierta con moderación

Cualquier persona puede enviar un anuncio desde el sitio; entra como `PENDIENTE` y un moderador lo aprueba.

### 2.1 Formulario público `/tianguis/publicar`

- Sin cuenta de usuario. Pasos: (1) categoría, (2) datos y atributos, (3) fotos, (4) nombre y WhatsApp del vendedor, (5) aceptar las reglas de publicación.
- Al enviar: se crea o reutiliza el `Vendedor` por WhatsApp y el anuncio queda en `PENDIENTE`. Se muestra un mensaje de confirmación con el **enlace privado de gestión**.
- **Enlace privado de gestión**: token aleatorio seguro (guardar solo su hash) que permite al vendedor ver el estado, editar (vuelve a `PENDIENTE`), marcar vendido, pausar o renovar. Ruta: `/tianguis/mi-anuncio/:token`. Se ofrece un botón para enviárselo por WhatsApp a sí mismo.
- **Antispam**: campo honeypot, límite de envíos por IP y por WhatsApp (por ejemplo, 3 anuncios por día y 10 activos por vendedor), validación de tamaño y tipo de imagen en el servidor.

### 2.2 Reglas de publicación (página `/tianguis/reglas`)

- Prohibido: artículos robados o sin procedencia, armas y municiones, animales, medicamentos, bebidas alcohólicas, contenido para adultos, servicios (no son artículos), celulares con IMEI reportado.
- Fotos reales del artículo; precio real en MXN; un artículo por anuncio.
- El sitio puede rechazar o retirar anuncios sin previo aviso.

### 2.3 Moderación en `/admin`

- Bandeja "Pendientes de revisión" con contador visible en el menú del panel.
- Aprobar → `PUBLICADO` con fechas de publicación y vencimiento.
- Rechazar → `RECHAZADO` con `motivoRechazo` (lista de motivos frecuentes + texto libre), visible en el enlace de gestión del vendedor.
- Marcar vendedor como verificado (después de confirmar su WhatsApp manualmente).
- Bloquear vendedor (sus anuncios pasan a `PAUSADO` y no puede publicar).

### 2.4 Vencimientos

- Tarea programada con `@Scheduled` (una vez al día): `PUBLICADO` con `fechaVencimiento` pasada → `VENCIDO`.
- Desde el enlace de gestión, el vendedor puede **renovar** 30 días más (máximo 3 renovaciones; luego debe republicar).
- `VENDIDO` deja de mostrarse en listados públicos después de 7 días.

### 2.5 Reportes

- Botón **Reportar anuncio** en la ficha: motivo (fraude, artículo prohibido, ya vendido, información falsa, otro) + comentario opcional. Límite por IP.
- Entidad `ReporteAnuncio`: `id`, `anuncio`, `motivo`, `comentario`, `fecha`, `atendido`.
- Con 3 reportes no atendidos, el anuncio pasa automáticamente a `PAUSADO` hasta revisión.
- Bandeja de reportes en `/admin`.

### 2.6 Criterios de aceptación — Fase 2

- [ ] Un visitante publica un anuncio desde el celular en menos de 3 minutos y recibe su enlace de gestión.
- [ ] El anuncio no aparece en público hasta ser aprobado.
- [ ] El rechazo muestra el motivo en el enlace de gestión.
- [ ] Editar un anuncio publicado lo regresa a revisión.
- [ ] La tarea de vencimiento funciona (probar con fecha simulada).
- [ ] Renovar, pausar y marcar vendido funcionan desde el enlace de gestión.
- [ ] Tres reportes pausan el anuncio.
- [ ] Honeypot y límites de envío bloquean envíos abusivos.
- [ ] Pruebas para token de gestión, transiciones de estado, vencimiento y reportes.

---

## Fuera de alcance (no implementar ahora)

- Fase 3: anuncios destacados de pago, botón "¿Te lo llevamos?" con Encarguitos, sello "Revisado por Sierra Sur" para consignación.
- Fase 4: notificaciones push y alertas de búsqueda guardada.
- Cobro en línea de cualquier tipo.

Deja el modelo preparado (por ejemplo, el campo `destacado` y `modalidad`) para no tener que migrar después.

## Entrega

Al terminar, entrega un resumen con: archivos creados o modificados, migraciones, nuevos endpoints, pasos para probar localmente y cualquier decisión tomada que difiera de este documento.
