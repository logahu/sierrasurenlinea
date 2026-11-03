# TuRamoHoy — Fase 1: Catálogo

Aplicación web y móvil (PWA) para mostrar los tipos de flores, ramos y arreglos.

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
- API: http://localhost:8080/api/productos
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
| GET | `/api/categorias` | Categorías ordenadas |
| GET | `/api/productos?categoria={slug}` | Productos disponibles (filtro opcional) |
| GET | `/api/productos/{id}` | Detalle de un producto |

## Cambiar las imágenes
Las imágenes de ejemplo están en `frontend/public/img/*.svg`. Pon tus fotos
(idealmente cuadradas, 800×800, en `.jpg` o `.webp`) en esa carpeta y
actualiza la columna `imagen_url` en `backend/src/main/resources/import.sql`.

## Probar como app en el celular
El service worker (modo offline / "Instalar app") solo se activa en el build
de producción (`npm run build`). Para instalarla en un celular real necesitas servirla por HTTPS (llegará en la
fase de despliegue con el dominio).

## Próximas fases
1. ✅ Catálogo con imágenes
2. Administración del catálogo (alta/edición de productos y fotos)
3. Carrito y pedidos (con fecha y dirección de entrega)
4. Pagos (Mercado Pago, transferencia, contra entrega)
5. Dominio propio

## Publicar en internet
Ver [DEPLOY.md](DEPLOY.md): frontend en Cloudflare Pages y backend en Render, ambos gratis.


