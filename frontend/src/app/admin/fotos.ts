import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export const LADO_FOTO = 800;
const CALIDAD = 0.82;

interface PermisoFoto {
  subirUrl: string;
  url: string;
  tipo: string;
  bytes: number;
}

/** Recorte cuadrado centrado: qué parte de la imagen original se toma. */
export function recorteCuadrado(ancho: number, alto: number): { x: number; y: number; lado: number } {
  const lado = Math.min(ancho, alto);
  return { x: Math.round((ancho - lado) / 2), y: Math.round((alto - lado) / 2), lado };
}

/**
 * Deja la foto lista para el sitio: cuadrada (centro), 800×800 y comprimida.
 * WebP si el navegador lo sabe generar; si no (Safari viejo), JPEG.
 */
export async function prepararFoto(archivo: Blob): Promise<Blob> {
  const imagen = await createImageBitmap(archivo, { imageOrientation: 'from-image' });
  const { x, y, lado } = recorteCuadrado(imagen.width, imagen.height);
  const destino = Math.min(LADO_FOTO, lado);
  const lienzo = document.createElement('canvas');
  lienzo.width = destino;
  lienzo.height = destino;
  const ctx = lienzo.getContext('2d');
  if (!ctx) throw new Error('Este navegador no puede procesar la foto.');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(imagen, x, y, lado, lado, 0, 0, destino, destino);
  imagen.close();
  const webp = await aBlob(lienzo, 'image/webp');
  return webp?.type === 'image/webp' ? webp : ((await aBlob(lienzo, 'image/jpeg')) ?? fallar());
}

/** Lado mayor de las fotos del tianguis: se ven grandes en la ficha. */
export const LADO_FOTO_GRANDE = 1600;
/** Lo que acepta el servidor (1.5 MB). */
const MAX_BYTES = 1_500_000;

/** Medidas para reducir sin recortar: el lado mayor queda en {@code maximo} (nunca agranda). */
export function medidasSinRecorte(ancho: number, alto: number, maximo: number): { ancho: number; alto: number } {
  const escala = Math.min(1, maximo / Math.max(ancho, alto));
  return { ancho: Math.max(1, Math.round(ancho * escala)), alto: Math.max(1, Math.round(alto * escala)) };
}

/**
 * Foto del tianguis: sin recortar, lado mayor 1600 px, WebP (o JPEG). Si pasa de 1.5 MB se
 * comprime más.
 */
export async function prepararFotoGrande(archivo: Blob): Promise<Blob> {
  const imagen = await createImageBitmap(archivo, { imageOrientation: 'from-image' });
  const m = medidasSinRecorte(imagen.width, imagen.height, LADO_FOTO_GRANDE);
  const lienzo = document.createElement('canvas');
  lienzo.width = m.ancho;
  lienzo.height = m.alto;
  const ctx = lienzo.getContext('2d');
  if (!ctx) throw new Error('Este navegador no puede procesar la foto.');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(imagen, 0, 0, m.ancho, m.alto);
  imagen.close();
  for (const calidad of [0.8, 0.65, 0.5]) {
    const webp = await aBlob(lienzo, 'image/webp', calidad);
    const foto = webp?.type === 'image/webp' ? webp : await aBlob(lienzo, 'image/jpeg', calidad);
    if (foto && foto.size <= MAX_BYTES) return foto;
  }
  throw new Error('La foto es muy pesada aun comprimida. Prueba con otra.');
}

function aBlob(lienzo: HTMLCanvasElement, tipo: string, calidad = CALIDAD): Promise<Blob | null> {
  return new Promise((ok) => lienzo.toBlob(ok, tipo, calidad));
}

function fallar(): never {
  throw new Error('No se pudo comprimir la foto.');
}

/** Sube fotos a R2: pide permiso al backend y manda el archivo directo con la URL firmada. */
@Injectable({ providedIn: 'root' })
export class FotosService {
  private readonly http = inject(HttpClient);

  /** {@code grande}: sin recortar a 1600 px (tianguis); si no, cuadrada a 800 px. */
  async subir(slug: string, archivo: File, grande = false): Promise<string> {
    if (!archivo.type.startsWith('image/')) throw new Error('Elige una imagen (foto JPG, PNG, HEIC…).');
    const foto = grande ? await prepararFotoGrande(archivo) : await prepararFoto(archivo);
    const permiso = await firstValueFrom(
      this.http.post<PermisoFoto>(`${environment.apiUrl}/admin/negocios/${encodeURIComponent(slug)}/fotos`, {
        tipo: foto.type,
        bytes: foto.size,
      }),
    );
    // Directo a R2 (fetch, no HttpClient: no lleva el token del panel).
    const r = await fetch(permiso.subirUrl, { method: 'PUT', body: foto, headers: { 'Content-Type': foto.type } });
    if (!r.ok) throw new Error(`El almacén de fotos rechazó la subida (${r.status}).`);
    return permiso.url;
  }
}
