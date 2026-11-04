import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    title: 'Sierra Sur en Línea',
    loadComponent: () => import('./catalogo/inicio-page').then((m) => m.InicioPage),
  },
  // Enlaces de la primera versión (solo florería): /producto/5 → /turamohoy/producto/5
  { path: 'producto/:id', redirectTo: 'turamohoy/producto/:id' },
  {
    path: ':negocio',
    loadComponent: () => import('./catalogo/catalogo-page').then((m) => m.CatalogoPage),
  },
  {
    path: ':negocio/producto/:id',
    loadComponent: () => import('./catalogo/producto-page').then((m) => m.ProductoPage),
  },
  { path: '**', redirectTo: '' },
];
