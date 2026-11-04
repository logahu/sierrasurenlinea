# Publicar Sierra Sur en Línea gratis

| Parte | Servicio | URL resultante |
|---|---|---|
| Backend (Quarkus) | Render, plan Free | `https://turamohoy-api.onrender.com` |
| Frontend (Angular PWA) | Cloudflare Pages | `https://turamohoy.pages.dev` |

Ninguno de los dos pide tarjeta. Ambos despliegan solos cada vez que haces `git push`.

> **Arranque en frío:** el backend gratuito se duerme tras 15 min sin visitas y
> tarda ~1 min en despertar. La app muestra un aviso mientras tanto y, una vez
> abierta, el service worker guarda el catálogo para verlo aunque no haya red.

---

## 1. Subir el código a GitHub

1. Crea un repositorio en GitHub (puede ser privado), p. ej. `turamohoy`.
2. En la carpeta `turamohoy/` (la que contiene `backend/`, `frontend/` y `render.yaml`):

```bash
git init
git add .
git commit -m "Fase 1: catálogo"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/turamohoy.git
git push -u origin main
```

## 2. Backend en Render

1. Entra a https://render.com y regístrate con tu cuenta de GitHub.
2. **New → Blueprint**, elige el repositorio `turamohoy`. Render lee `render.yaml`
   y propone el servicio `turamohoy-api` con plan Free. Confirma.
3. El primer build tarda varios minutos (descarga dependencias de Maven y arma la imagen Docker).
4. Al terminar, abre `https://<tu-servicio>.onrender.com/api/categorias`; debes ver el JSON.
5. **Anota la URL exacta** que te asignó Render. Si el nombre `turamohoy-api` ya
   estaba ocupado, será algo como `turamohoy-api-x7k2.onrender.com`.

## 3. Apuntar el frontend a tu backend

Si la URL de Render **no** es `turamohoy-api.onrender.com`, edita
`frontend/src/environments/environment.ts`:

```ts
export const environment = {
  apiUrl: 'https://TU-SERVICIO.onrender.com/api',
};
```

y haz commit + push.

## 4. Frontend en Cloudflare Pages

1. Entra a https://dash.cloudflare.com y crea una cuenta gratuita.
2. **Workers & Pages → Create → Pages → Connect to Git**, elige el repo `turamohoy`.
3. Configuración del build:

| Campo | Valor |
|---|---|
| Project name | `turamohoy` |
| Framework preset | None |
| Root directory | `frontend` |
| Build command | `npx ng build` |
| Build output directory | `dist/frontend/browser` |

4. **Save and Deploy**. Tu sitio quedará en `https://turamohoy.pages.dev`.

### Alternativa: como Worker (lo que Cloudflare propone por defecto)

Si al crear el proyecto Cloudflare te lleva a **Workers** (pide un *Deploy command*),
el repo ya incluye `frontend/wrangler.jsonc`. En **Settings → Build** usa:

| Campo | Valor |
|---|---|
| Root directory | `frontend` |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |

El sitio quedará en `https://turamohoy.<tu-cuenta>.workers.dev`; `render.yaml`
ya permite ese dominio en CORS.

> Si el nombre `turamohoy` ya existe en Pages y te asignan otro (p. ej.
> `turamohoy-abc.pages.dev`), cambia `turamohoy` por ese nombre en la variable
> `CORS_ORIGINS` (Render → tu servicio → Environment) y redepliega el backend.

## 5. Probar e instalar en el celular

- Abre `https://turamohoy.pages.dev` en el celular.
- **Android (Chrome):** menú ⋮ → *Instalar app*.
- **iPhone (Safari):** botón Compartir → *Agregar a pantalla de inicio*.

## Problemas comunes

| Síntoma | Causa probable | Solución |
|---|---|---|
| "No pudimos cargar el catálogo" y en la consola dice CORS | El dominio de Pages no coincide con `CORS_ORIGINS` | Ajusta la variable en Render |
| Carga eterna la primera vez | El backend estaba dormido | Espera ~1 min; es normal en el plan Free |
| 404 en `/api/...` | `apiUrl` sin `/api` al final | Revisa `environment.ts` |
| Build de Pages falla en "Inlining of fonts" | Fallo temporal al descargar Google Fonts | Reintenta el deploy |

## Cuando tengas dominio propio

- **Pages → Custom domains:** agrega `www.tudominio.com.mx`.
- **Render → Settings → Custom Domains:** agrega `api.tudominio.com.mx` y actualiza
  `environment.ts` y `CORS_ORIGINS` con los nuevos dominios.
