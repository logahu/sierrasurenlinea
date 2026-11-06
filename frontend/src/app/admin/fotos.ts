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

function aBlob(lienzo: HTMLCanvasElement, tipo: string): Promise<Blob | null> {
  return new Promise((ok) => lienzo.toBlob(ok, tipo, CALIDAD));
}

function fallar(): never {
  throw new Error('No se pudo comprimir la foto.');
}

/** Sube fotos a R2: pide permiso al backend y manda el archivo directo con la URL firmada. */
@Injectable({ providedIn: 'root' })
export class FotosService {
  private readonly http = inject(HttpClient);

  async subir(slug: string, archivo: File): Promise<string> {
    if (!archivo.type.startsWith('image/')) throw new Error('Elige una imagen (foto JPG, PNG, HEIC…).');
    const foto = await prepararFoto(archivo);
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
