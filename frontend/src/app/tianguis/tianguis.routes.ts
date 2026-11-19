import { Routes } from '@angular/router';

/** /tianguis… (las rutas fijas van antes que la ficha /tianguis/:idSlug). */
export const TIANGUIS_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./tianguis-page').then((m) => m.TianguisPage) },
  { path: 'c/:categoria', loadComponent: () => import('./tianguis-page').then((m) => m.TianguisPage) },
  { path: 'publicar', loadComponent: () => import('./publicar-page').then((m) => m.PublicarPage) },
  { path: 'reglas', loadComponent: () => import('./reglas-page').then((m) => m.ReglasPage) },
  { path: 'mi-anuncio/:token', loadComponent: () => import('./mi-anuncio-page').then((m) => m.MiAnuncioPage) },
  { path: ':idSlug', loadComponent: () => import('./anuncio-page').then((m) => m.AnuncioPage) },
];
