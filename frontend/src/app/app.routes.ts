import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    title: 'Sierra Sur en Línea',
    loadComponent: () => import('./catalogo/inicio-page').then((m) => m.InicioPage),
  },
  // Panel de administración (va antes de :negocio para que "admin" no se tome como negocio).
  { path: 'admin', loadChildren: () => import('./admin/admin.routes').then((m) => m.ADMIN_ROUTES) },
  // "Cosméticos" ahora es "Belleza": los enlaces viejos siguen funcionando.
  { path: 'cosmeticos', redirectTo: 'belleza', pathMatch: 'full' },
  { path: 'cosmeticos/producto/:id', redirectTo: 'belleza/producto/:id' },
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
