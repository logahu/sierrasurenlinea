/**
 * ¿El sitio se está viendo dentro de la app de Google Play (o la app instalada)?
 * La app abre con ?origen=app (start_url del manifest); se recuerda en el teléfono
 * para que siga valiendo al navegar o al volver a abrirla.
 */
const CLAVE = 'ssl:app';

function detectar(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const desdeApp =
      new URLSearchParams(window.location.search).get('origen') === 'app' ||
      document.referrer.startsWith('android-app://');
    if (desdeApp) localStorage.setItem(CLAVE, '1');
    return desdeApp || localStorage.getItem(CLAVE) === '1';
  } catch {
    return false;
  }
}

export const EN_APP = detectar();

/** Negocios que se muestran: en la app se quitan los marcados "solo web". */
export function visiblesAqui<T extends { visibleApp?: boolean }>(negocios: T[], enApp = EN_APP): T[] {
  return enApp ? negocios.filter((n) => n.visibleApp !== false) : negocios;
}

export function soloEnWeb(negocio: { visibleApp?: boolean } | undefined, enApp = EN_APP): boolean {
  return enApp && negocio?.visibleApp === false;
}
