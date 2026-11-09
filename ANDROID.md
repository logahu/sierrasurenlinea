# App de Android (Google Play)

La app es el mismo sitio empaquetado como **Trusted Web Activity (TWA)**: abre
`https://sierrasurenlinea.com.mx` a pantalla completa, sin barra del navegador, y usa la
misma API y base de datos. Cada cambio publicado en la web aparece solo en la app; solo
hay que subir una versión nueva a Play si cambian el ícono, el nombre o el paquete.

## 1. Cuenta de Google Play Console
- https://play.google.com/console → pago único de 25 USD.
- **Cuenta personal nueva:** antes de publicar exige una **prueba cerrada con al menos 12
  personas durante 14 días seguidos**. **Cuenta de organización** (RFC + número D-U-N-S): no.

## 2. Generar el paquete con PWABuilder
1. https://www.pwabuilder.com → escribe `https://sierrasurenlinea.com.mx` → **Package for stores → Android**.
2. Opciones:
   - **Package ID:** `mx.com.sierrasurenlinea.app` (no se puede cambiar después).
   - **App name:** Sierra Sur en Línea · **Short name:** Sierra Sur
   - **Signing key:** "Create new". **Guarda el archivo `.keystore` y sus contraseñas**
     en un lugar seguro (sin ellos no podrás publicar actualizaciones). Nunca en el repositorio.
3. Descarga el ZIP: trae el `.aab` (para Play), un `.apk` (para probar) y `assetlinks.json`.

## 3. Verificar el dominio (para que no salga la barra del navegador)
1. En Play Console → la app → **Configuración → Integridad de la app → Firma de apps**,
   copia la **huella SHA-256 del certificado de firma de la app**.
2. Pásala para ponerla en `frontend/public/.well-known/assetlinks.json` (hoy está vacío: `[]`):
   ```json
   [{
     "relation": ["delegate_permission/common.handle_all_urls"],
     "target": {
       "namespace": "android_app",
       "package_name": "mx.com.sierrasurenlinea.app",
       "sha256_cert_fingerprints": ["AA:BB:...:FF"]
     }
   }]
   ```
3. Debe verse en `https://sierrasurenlinea.com.mx/.well-known/assetlinks.json`.

## 4. Ficha de Play
- Ícono 512×512: `frontend/public/icons/icon-512x512.png`.
- Imagen destacada 1024×500 y al menos 2 capturas de pantalla del celular.
- Descripción, categoría (Compras), política de privacidad (URL) y clasificación de contenido.
  La vinatería obliga a declarar venta de alcohol: clasificación para mayores de edad o
  dejar fuera la sección en la app.
