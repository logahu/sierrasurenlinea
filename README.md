# Sierra Sur en Línea

Sitio web y app (PWA) con varios negocios de Miahuatlán de Porfirio Díaz, Oax.
Cada negocio tiene su página, su color, su catálogo y su WhatsApp:

| Negocio | Ruta | Tipo |
|---|---|---|
| TuRamoHoy (florería) | `/turamohoy` | Venta |
| Cosméticos | `/cosmeticos` | Venta |
| Renta de Inflables | `/inflables` | Renta (precio por día / por evento) |
| Vinatería | `/vinateria` | Venta, solo mayores de 18 |

```
turamohoy/
├── backend/    Quarkus 3.40 · REST + Hibernate Panache · H2 en memoria
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

## Personalizar los negocios
Todo vive en `backend/src/main/resources/import.sql`:
- **Nombre, eslogan, color, WhatsApp, teléfono, dirección y horario**: tabla `negocio`.
  El WhatsApp va con lada internacional y sin espacios (`5219511234567`).
  ⚠️ Por ahora todos tienen el número de ejemplo `5219510000000`.
- **Agregar un negocio nuevo**: un `INSERT` en `negocio` y sus categorías; el menú y la
  portada lo muestran solos. `tipo` es `VENTA` o `RENTA`; `solo_mayores_edad` muestra el aviso +18.
- **Productos de renta**: `unidad_precio` (`por día`, `por evento`) y `caracteristicas`
  separadas por `|` (`Medidas: 4 × 4 m|Capacidad: 8 niños`).

## Cambiar las imágenes
Las imágenes de ejemplo están en `frontend/public/img/*.svg`. Pon tus fotos
(idealmente cuadradas, 800×800, en `.jpg` o `.webp`) en esa carpeta y
actualiza `imagen_url` (productos) o `portada_url` (negocios) en `import.sql`.

## Calidad
Cada push corre **GitHub Actions** (`.github/workflows/ci.yml`): compila y prueba el
backend con Maven y el frontend con Angular.

## Próximas fases
1. ✅ Catálogo con imágenes
2. ✅ Varios negocios con contacto por WhatsApp
3. Administración del catálogo (alta/edición de productos y fotos)
4. Carrito y pedidos (con fecha y dirección de entrega; disponibilidad de inflables)
5. Pagos (Mercado Pago, transferencia, contra entrega)
6. Dominio propio: `sierrasurenlinea.com.mx`

## Publicar en internet
Ver [DEPLOY.md](DEPLOY.md): frontend en Cloudflare y backend en Render, ambos gratis.
