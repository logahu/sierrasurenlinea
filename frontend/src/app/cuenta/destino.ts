/** Solo se vuelve a rutas internas del sitio (nunca a otro dominio ni al panel). */
export function destinoSeguro(volver: string | undefined, porDefecto = '/cuenta'): string {
  if (!volver || !volver.startsWith('/') || volver.startsWith('//') || volver.startsWith('/admin')) return porDefecto;
  return volver;
}
