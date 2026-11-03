import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    title: 'Catálogo | TuRamoHoy',
    loadComponent: () => import('./catalogo/catalogo-page').then((m) => m.CatalogoPage),
  },
  {
    path: 'producto/:id',
    title: 'Producto | TuRamoHoy',
    loadComponent: () => import('./catalogo/producto-page').then((m) => m.ProductoPage),
  },
  { path: '**', redirectTo: '' },
];
