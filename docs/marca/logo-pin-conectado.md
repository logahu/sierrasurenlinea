# Logo Sierra Sur en Línea · opción 4 «Pin conectado»

## Archivos

| Archivo | Uso |
|---|---|
| `sierrasur-logo.svg` | Logo horizontal para fondos claros (texto convertido a trazos, no depende de la fuente). |
| `sierrasur-logo-oscuro.svg` | Logo horizontal para fondos oscuros. |
| `sierrasur-icono.svg` | Solo el pin, sin fondo: encabezado, marcador del mapa, redes. |
| `sierrasur-app.svg` / `sierrasur-app-maskable.svg` | Fuente de los íconos de la app (cuadrado verde). |
| `favicon.ico` | 16, 32 y 48 px. |
| `icons/*.png` | Los mismos nombres y tamaños que ya usa `manifest.webmanifest`, más `apple-touch-icon.png` (180 px). |

Colores: verde follaje `#2F6B4F`, verde claro `#63B38A`, cempasúchil `#F5A524`, crema `#FBF7F2`;
«en Línea» en `#B06F06` sobre claro y `#F5A524` sobre oscuro.
Tipografía: Fraunces 700 («Sierra Sur») y Fraunces 600 itálica («en Línea»).

## Cómo aplicarlo en el repo (frontend/)

1. Reemplaza `public/favicon.ico` y todo `public/icons/` con los de este paquete
   (los nombres coinciden; no hay que tocar `manifest.webmanifest`).
2. Copia `sierrasur-icono.svg`, `sierrasur-logo.svg` y `sierrasur-logo-oscuro.svg` a `public/img/`.
3. En `src/index.html`, cambia el apple-touch-icon:
   `<link rel="apple-touch-icon" href="icons/apple-touch-icon.png" />`
   y agrega el favicon vectorial:
   `<link rel="icon" type="image/svg+xml" href="img/sierrasur-icono.svg" />`
4. En `src/app/app.html`, reemplaza el `<svg>` de la marca (la montaña) por:

```html
<svg viewBox="0 0 64 64" aria-hidden="true" width="32" height="32">
  <path d="M32 3C18.5 3 9 12.8 9 25.2C9 41 32 61 32 61S55 41 55 25.2C55 12.8 45.5 3 32 3Z" fill="var(--follaje)" />
  <circle cx="32" cy="25" r="16" fill="#FBF7F2" />
  <clipPath id="marca-pin"><circle cx="32" cy="25" r="16" /></clipPath>
  <g clip-path="url(#marca-pin)">
    <path d="M22.5 22a13 13 0 0 1 19 0" fill="none" stroke="var(--cempasuchil)" stroke-width="3" stroke-linecap="round" />
    <path d="M26.5 26a7 7 0 0 1 11 0" fill="none" stroke="var(--cempasuchil)" stroke-width="3" stroke-linecap="round" />
    <circle cx="32" cy="30" r="2.8" fill="var(--cempasuchil)" />
    <path d="M13 42L24 30L30 36L35 32L51 42Z" fill="#2F6B4F" />
    <path d="M13 42L20 36L27 40L34 37L51 42Z" fill="#63B38A" />
  </g>
</svg>
```

   Nota: en modo oscuro `--follaje` cambia a `#63b38a`; el pin se ve bien con ambos.
5. Como la app es PWA con service worker, los celulares que ya la instalaron pueden
   tardar en mostrar el ícono nuevo (se actualiza al reinstalar o cuando el sistema refresca el manifest).
