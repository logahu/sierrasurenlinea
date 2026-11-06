# Sierra Sur en Línea

Sitio web y app (PWA) con varios negocios de Miahuatlán de Porfirio Díaz, Oax.
Cada negocio tiene su página, su color, su catálogo y su WhatsApp:

| Negocio | Ruta | Tipo |
|---|---|---|
| TuRamoHoy (florería) | `/turamohoy` | Venta |
| Cosméticos | `/cosmeticos` | Venta |
| Renta de Inflables | `/inflables` | Renta (precio por día / por evento) |
| Vinatería | `/vinateria` | Venta, solo mayores de 18 |
| Encarguitos | `/encarguitos` | Servicio: mandados en moto con formulario ("lista del mandado") y tarifas por zona |

```
turamohoy/
├── backend/    Quarkus 3.40 · REST + Hibernate Panache · PostgreSQL (Neon) + Flyway
└── frontend/   Angular 22 · PWA instalable en el celular
```

## Requisitos
- JDK 17 o superior (recomendado 21)
- Maven 3.9+
- Node.js 22+ y npm

## Levantar en local

**1. Backend** (puerto 8080)
```bash
cd backend
mvn quarkus:dev
```
- En local usa H2 en memoria (no hay que instalar nada); en producción, PostgreSQL en Neon.
- API: http://localhost:8080/api/negocios
- Swagger UI: http://localhost:8080/q/swagger-ui
- Pruebas: `mvn test`

**2. Frontend** (puerto 4200, redirige `/api` al backend con `proxy.conf.json`)
```bash
cd frontend
npm install
npm start
```
Abre http://localhost:4200

## API
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/negocios` | Negocios en orden, con contacto |
| GET | `/api/negocios/{slug}` | Un negocio con sus categorías |
| GET | `/api/negocios/{slug}/productos?categoria={slug}` | Productos del negocio (filtro opcional) |
| GET | `/api/productos/{id}` | Detalle de un producto |
| GET | `/api/productos` · `/api/categorias` | Todo, de todos los negocios |
| POST | `/api/visitas` | Registra una visita a una página (`{ruta, contar}`) y devuelve su total |
| GET | `/api/visitas` | Visitas de todas las páginas (solo el dueño, con sesión) |

### Panel de administración (`/admin`)
Requieren `Authorization: Bearer <token>` (lo obtiene `/api/auth/entrar`).

| Método | Ruta | Quién | Descripción |
|---|---|---|---|
| POST | `/api/auth/entrar` | cualquiera | Correo y contraseña → token de 8 h. 5 intentos fallidos bloquean la cuenta 15 min |
| GET | `/api/auth/yo` | con sesión | Mis datos |
| PUT | `/api/auth/contrasena` | con sesión | Cambiar mi contraseña (`{actual, nueva}`) |
| GET/PUT | `/api/admin/negocios[/{slug}]` | dueño; encargado solo el suyo | Ver y editar contacto, horario, presentación; el dueño también nombre, color y si se muestra |
| GET/POST/PUT | `/api/admin/usuarios[/{id}]` | dueño | Encargados: alta, quitar o devolver acceso, contraseña nueva |
| GET/POST/PUT | `/api/admin/negocios/{slug}/categorias[/{id}]` | dueño; encargado el suyo | Categorías: alta, renombrar, orden |
| GET/POST/PUT | `/api/admin/negocios/{slug}/productos[/{id}]` | dueño; encargado el suyo | Productos o tarifas: alta y edición (incluye ocultos) |
| PUT | `/api/admin/negocios/{slug}/productos/{id}/disponible` | dueño; encargado el suyo | Mostrar u ocultar en el sitio |

Roles: **dueño** (todo) y **encargado** (uno por negocio, solo el suyo). En local entras con
`dueno@sierrasur.local` / `dueno-local-123`. En producción, ver [DEPLOY.md](DEPLOY.md), sección 2.2.

### Visitas
Cada página muestra en el pie, a la derecha y en tono tenue, un "folio" como
`SSL-000184`: es su número de visitas (cada visitante cuenta una vez por sesión).
Para ver todas juntas: `GET /api/visitas` con la sesión del dueño (en la fase 4 se verán en el panel).

## Base de datos
- **Producción:** PostgreSQL en [Neon](https://neon.com) (plan gratuito). La conexión se
  configura con variables de entorno en Render; ver [DEPLOY.md](DEPLOY.md).
- **Esquema y datos:** migraciones de Flyway en `backend/src/main/resources/db/migration`
  (`V1__esquema_inicial.sql`, `V2__datos_iniciales.sql`). Se aplican solas al arrancar.
- **Datos de contacto, productos, precios, categorías y tarifas**: desde el panel, en `/admin`.
- **Cambios de estructura** (tablas, columnas, datos masivos): crea una migración nueva
  con el siguiente número, p. ej. `V3__whatsapp_reales.sql`. **No edites** migraciones que
  ya se aplicaron: Flyway las detecta y el backend no arranca.

## Personalizar los negocios
Lo que define a cada negocio (en las migraciones, ver arriba):
- **Nombre, eslogan, color, WhatsApp, teléfono, dirección y horario**: tabla `negocio`.
  El WhatsApp va con lada internacional y sin espacios (`5219511234567`).
  Todos usan por ahora el `525540485363`; se cambia por negocio desde el panel.
- **Agregar un negocio nuevo**: un `INSERT` en `negocio` y sus categorías; el menú y la
  portada lo muestran solos. `tipo` es `VENTA` o `RENTA`; `solo_mayores_edad` muestra el aviso +18.
- **Productos de renta**: `unidad_precio` (`por día`, `por evento`) y `caracteristicas`
  separadas por `|` (`Medidas: 4 × 4 m|Capacidad: 8 niños`).

## Diseño de cada negocio
La portada tiene su propio estilo ("la calle de los rótulos") y cada negocio tiene un
tema visual en `frontend/src/app/catalogo/temas/` (`_turamohoy.scss`, `_cosmeticos.scss`,
`_inflables.scss`, `_vinateria.scss`). El tema se elige por el `slug` del negocio; un
negocio nuevo usa el estilo base hasta que se le cree su archivo de tema y se agregue
en `catalogo-page.scss` y `producto-page.scss`.

## Cambiar las imágenes
Las imágenes de ejemplo están en `frontend/public/img/*.svg`. Pon tus fotos
(idealmente cuadradas, 800×800, en `.jpg` o `.webp`) en esa carpeta y
actualiza `imagen_url` (productos) o `portada_url` (negocios) con una migración nueva.

## Calidad
Cada push corre **GitHub Actions** (`.github/workflows/ci.yml`): compila y prueba el
backend con Maven (con H2 y contra un PostgreSQL real) y el frontend con Angular.

## Próximas fases
1. ✅ Catálogo con imágenes
2. ✅ Varios negocios con contacto por WhatsApp
3. Panel de administración: ✅ fase 1 (acceso, encargados, datos de cada negocio),
   ✅ fase 2 (catálogo, categorías y tarifas); faltan fotos (Cloudflare R2), visitas y bitácora
4. Carrito y pedidos (con fecha y dirección de entrega; disponibilidad de inflables)
5. Pagos (Mercado Pago, transferencia, contra entrega)
6. ✅ Dominio propio: `sierrasurenlinea.com.mx` (ver DEPLOY.md, sección Dominio)

## Publicar en internet
Ver [DEPLOY.md](DEPLOY.md): frontend en Cloudflare y backend en Render, ambos gratis.
