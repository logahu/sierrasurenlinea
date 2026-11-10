# Publicar Sierra Sur en Línea gratis

| Parte | Servicio | URL resultante |
|---|---|---|
| Backend (Quarkus) | Render, plan Free | `https://turamohoy-api.onrender.com` |
| Base de datos (PostgreSQL) | Neon, plan Free | — |
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

## 2.1 Base de datos en Neon (PostgreSQL gratis)

El backend guarda negocios, categorías y productos en PostgreSQL. Las tablas y los datos
iniciales los crea **Flyway** solo, la primera vez que arranca.

1. Entra a https://neon.com y regístrate con tu cuenta de GitHub (el plan Free no pide tarjeta).
2. Crea un proyecto `sierrasurenlinea`. En **Region** elige la más cercana a la región de
   tu servicio en Render (Render → tu servicio → *Settings → Region*).
3. En el proyecto, abre **Connect** y copia los datos de conexión: *host*, *database*,
   *role* (usuario) y *password*.
4. En Render → `turamohoy-api` → **Environment** agrega estas variables (como secretas):

| Variable | Valor |
|---|---|
| `QUARKUS_DATASOURCE_JDBC_URL` | `jdbc:postgresql://<host>/<database>?sslmode=require` |
| `QUARKUS_DATASOURCE_USERNAME` | `<role>` |
| `QUARKUS_DATASOURCE_PASSWORD` | `<password>` |

   El host es el de Neon, algo como `ep-xxxx-xxxx.us-east-2.aws.neon.tech`. **Nunca** pongas
   estos valores en el repositorio ni en el chat.
5. Guarda (Render redespliega). En el log del deploy debes ver que Flyway aplicó
   `V1__esquema_inicial` y `V2__datos_iniciales`.

> **Cambiar datos** (WhatsApp reales, precios, productos): se hace con una migración nueva
> en `backend/src/main/resources/db/migration`, p. ej. `V3__whatsapp_reales.sql`.
> No edites `V1` ni `V2`: ya se aplicaron y Flyway rechaza cambios en ellas.

## 2.2 Panel de administración (`/admin`)

El panel necesita tres variables más en Render → `turamohoy-api` → **Environment**:

| Variable | Valor |
|---|---|
| `JWT_SECRETO` | Un valor aleatorio largo (mínimo 32 caracteres). Usa **Generate** de Render. Firma las sesiones; si lo cambias, todos tienen que volver a entrar. |
| `ADMIN_CORREO` | Tu correo: con él entras como dueño. |
| `ADMIN_CONTRASENA` | Tu contraseña inicial (mínimo 10 caracteres). |

Sin `JWT_SECRETO` el backend nuevo no arranca (Render sigue sirviendo la versión anterior).
La cuenta del dueño se crea sola en el primer arranque; después de eso `ADMIN_CONTRASENA` ya
no se usa (puedes borrarla) y la contraseña se cambia en el panel, en **Mi cuenta**.

Luego entra a `https://<tu-sitio>/admin`, y en **Encargados** da de alta a uno por negocio.
**Nunca** pongas estos valores en el repositorio ni en el chat.

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

El sitio quedará en `https://sierrasurenlinea.<tu-cuenta>.workers.dev`; `render.yaml`
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

## Dominio propio: sierrasurenlinea.com.mx

Los `.com.mx` no se pueden registrar en Cloudflare, pero sí se pueden **administrar** ahí
(gratis) cambiando los nameservers en el registrador.

1. **Cloudflare → Add a domain** → `sierrasurenlinea.com.mx` → plan **Free**. Cloudflare
   te da dos nameservers (p. ej. `xxx.ns.cloudflare.com`).
2. **En tu registrador** (donde compraste el dominio) → DNS / Nameservers → reemplaza
   los suyos por los dos de Cloudflare. Tarda de minutos a 24 h; Cloudflare te avisa por
   correo cuando el dominio queda **Active**.
3. **Workers & Pages → sierrasurenlinea → Settings → Domains & Routes → Add → Custom
   domain**: agrega `sierrasurenlinea.com.mx` y luego `www.sierrasurenlinea.com.mx`.
   Cloudflare crea los registros DNS y el certificado HTTPS solo.
4. **Render → turamohoy-api → Environment → CORS_ORIGINS**: agrega al inicio
   `https://sierrasurenlinea.com.mx,https://www.sierrasurenlinea.com.mx,` (sin quitar lo
   que ya tiene) y guarda. Sin esto el sitio carga pero no muestra el catálogo.
5. (Opcional) **Que www lleve al dominio sin www**: Cloudflare → el dominio → Rules →
   Redirect Rules → plantilla "Redirect from WWW to root".

La dirección `*.workers.dev` sigue funcionando; se puede desactivar después en
Domains & Routes.

## Fotos en Cloudflare R2 (panel, fase 3)

Las fotos se suben desde el panel directo a un bucket de R2 (10 GB gratis) y se ven en
`https://fotos.sierrasurenlinea.com.mx/...`.

1. **Cloudflare → R2 → Crear bucket**: nombre `sierrasurenlinea-fotos`, ubicación automática.
2. **El bucket → Configuración → Dominio personalizado → Agregar**: `fotos.sierrasurenlinea.com.mx`.
3. **El bucket → Configuración → Política de CORS → Agregar** y pega:
   ```json
   [
     {
       "AllowedOrigins": [
         "https://sierrasurenlinea.com.mx",
         "https://www.sierrasurenlinea.com.mx",
         "https://sierrasurenlinea.hugo-logarcia.workers.dev",
         "http://localhost:4200"
       ],
       "AllowedMethods": ["PUT"],
       "AllowedHeaders": ["content-type"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```
4. **R2 → Información general → Administrar tokens de API → Crear token de API de cuenta**:
   permiso **Lectura y escritura de objetos**, solo para el bucket `sierrasurenlinea-fotos`.
   Copia el **ID de clave de acceso** y la **clave de acceso secreta** (la secreta se
   muestra una sola vez).
5. **Render → turamohoy-api → Environment**, agrega:

| Variable | Valor |
|---|---|
| `R2_CUENTA` | El id de tu cuenta de Cloudflare (está en la URL del panel: `dash.cloudflare.com/<id>/...`) |
| `R2_LLAVE_ACCESO` | ID de clave de acceso del paso 4 |
| `R2_LLAVE_SECRETA` | Clave de acceso secreta del paso 4 |
| `R2_BUCKET` | `sierrasurenlinea-fotos` |
| `R2_URL_PUBLICA` | `https://fotos.sierrasurenlinea.com.mx` |

Sin estas variables el sitio funciona igual, pero el panel avisa que las fotos no están
configuradas. Las fotos que se reemplazan se quedan en el bucket (no estorban).

## Pedidos en tiempo real

- Los encargos de Encarguitos se registran en la base y aparecen en `/admin/pedidos`
  (encargados y repartidores). El panel se actualiza cada 15 s y suena con cada pedido nuevo.
- **Notificaciones push:** cada persona entra al panel desde su celular, lo instala
  ("Sierra Sur Pedidos": menú del navegador → Instalar app) y toca **Activar notificaciones**.
  Las llaves VAPID se generan solas y se guardan en la base (tabla `ajuste`); no hay que configurar nada.
- **Repartidores:** Panel → Equipo → Agregar persona → rol *Repartidor*.
- **Recomendado:** subir el backend al plan **Starter** de Render. En el plan gratis el servidor
  se duerme a los 15 min; el primer pedido después de eso tarda hasta un minuto en registrarse
  (el cliente no espera: WhatsApp se abre igual y el pedido llega cuando el servidor despierta).


## Cuentas de clientes y aviso de privacidad

- Para hacer un pedido el cliente necesita cuenta (teléfono + contraseña). Se registra en `/cuenta/registro`
  y debe aceptar el aviso de privacidad; queda guardada la fecha y la versión que aceptó.
- **Pendiente:** llenar los datos del responsable en `frontend/src/app/cuenta/privacidad-page.ts`
  (`[NOMBRE]`, `[DOMICILIO]`, `[CORREO]`). Si cambias el texto del aviso, sube también
  `VERSION_PRIVACIDAD` en `ClienteResource.java`. Conviene que un abogado lo revise.
- Panel → Usuarios: pestañas **Equipo** (hasta 2 administradores, encargados y repartidores) y
  **Clientes**. Nada se borra: "Quitar acceso" es una baja lógica y se puede revertir.

## Pedidos con carrito (todos los negocios)

- Cada negocio que vende o renta tiene carrito: botón "+" en el catálogo, "Agregar al pedido" en el
  producto y la página `/<negocio>/pedido` para confirmar. Se registra en el panel con folio
  (TUR-00015, INF-…, AUT-…) y se abre WhatsApp con el pedido escrito.
- Cómo se pide depende del negocio (`negocio.modo_pedido`): COMPRA (domicilio o recoger),
  RENTA (fecha y lugar del evento) y CITA (autos: día de la visita).
- Avisos push: administradores, encargado del negocio, repartidores del negocio y, si es a domicilio,
  los repartidores generales (Panel → Usuarios → Repartidor con "Todos los negocios").
