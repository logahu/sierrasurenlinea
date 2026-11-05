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

## Base de datos
- **Producción:** PostgreSQL en [Neon](https://neon.com) (plan gratuito). La conexión se
  configura con variables de entorno en Render; ver [DEPLOY.md](DEPLOY.md).
- **Esquema y datos:** migraciones de Flyway en `backend/src/main/resources/db/migration`
  (`V1__esquema_inicial.sql`, `V2__datos_iniciales.sql`). Se aplican solas al arrancar.
- **Para cambiar datos** (WhatsApp reales, precios, productos): crea una migración nueva
  con el siguiente número, p. ej. `V3__whatsapp_reales.sql`. **No edites** migraciones que
  ya se aplicaron: Flyway las detecta y el backend no arranca.

## Personalizar los negocios
Lo que define a cada negocio (en las migraciones, ver arriba):
- **Nombre, eslogan, color, WhatsApp, teléfono, dirección y horario**: tabla `negocio`.
  El WhatsApp va con lada internacional y sin espacios (`5219511234567`).
  ⚠️ Por ahora todos tienen el número de ejemplo `5219510000000`.
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
3. Administración del catálogo (alta/edición de productos y fotos)
4. Carrito y pedidos (con fecha y dirección de entrega; disponibilidad de inflables)
5. Pagos (Mercado Pago, transferencia, contra entrega)
6. Dominio propio: `sierrasurenlinea.com.mx`

## Publicar en internet
Ver [DEPLOY.md](DEPLOY.md): frontend en Cloudflare y backend en Render, ambos gratis.
