import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { prepararFoto } from '../admin/fotos';

interface PermisoFoto {
  subirUrl: string;
  url: string;
}

/**
 * Sube una foto de perfil: se recorta cuadrada y se comprime en el navegador, se pide el
 * permiso a `permisoUrl` (/auth/yo/foto o /clientes/yo/foto) y va directo a R2.
 * Devuelve la URL pública; falta guardarla como avatar.
 */
export async function subirFotoPerfil(http: HttpClient, permisoUrl: string, archivo: File): Promise<string> {
  if (!archivo.type.startsWith('image/')) throw new Error('Elige una imagen (foto JPG, PNG, HEIC…).');
  const foto = await prepararFoto(archivo);
  let permiso: PermisoFoto;
  try {
    permiso = await firstValueFrom(http.post<PermisoFoto>(permisoUrl, { tipo: foto.type, bytes: foto.size }));
  } catch (e) {
    const mensaje = e instanceof HttpErrorResponse ? (e.error as { mensaje?: string } | null)?.mensaje : null;
    throw new Error(mensaje ?? 'No se pudo preparar la subida de la foto.');
  }
  // Directo a R2 (fetch, no HttpClient: no lleva el token).
  const r = await fetch(permiso.subirUrl, { method: 'PUT', body: foto, headers: { 'Content-Type': foto.type } });
  if (!r.ok) throw new Error(`El almacén de fotos rechazó la subida (${r.status}).`);
  return permiso.url;
}
