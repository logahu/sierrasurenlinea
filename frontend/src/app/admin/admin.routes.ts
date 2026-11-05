import { Routes } from '@angular/router';
import { conSesion, soloDueno } from './autorizacion';

/** Panel de administración: /admin. Se carga aparte, solo cuando alguien entra. */
export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./panel-layout').then((m) => m.PanelLayout),
    children: [
      {
        path: 'entrar',
        title: 'Entrar · Panel',
        loadComponent: () => import('./entrar-page').then((m) => m.EntrarPage),
      },
      {
        path: '',
        canActivate: [conSesion],
        children: [
          {
            path: '',
            title: 'Panel · Sierra Sur en Línea',
            loadComponent: () => import('./inicio-panel').then((m) => m.InicioPanel),
          },
          {
            path: 'negocios/:slug',
            title: 'Catálogo · Panel',
            loadComponent: () => import('./productos-page').then((m) => m.ProductosPage),
          },
          {
            path: 'negocios/:slug/productos/:id',
            title: 'Producto · Panel',
            loadComponent: () => import('./producto-form').then((m) => m.ProductoForm),
          },
          {
            path: 'negocios/:slug/categorias',
            title: 'Categorías · Panel',
            loadComponent: () => import('./categorias-page').then((m) => m.CategoriasPage),
          },
          {
            path: 'negocios/:slug/datos',
            title: 'Datos del negocio · Panel',
            loadComponent: () => import('./editar-negocio').then((m) => m.EditarNegocio),
          },
          {
            path: 'usuarios',
            title: 'Encargados · Panel',
            canActivate: [soloDueno],
            loadComponent: () => import('./usuarios-page').then((m) => m.UsuariosPage),
          },
          {
            path: 'cuenta',
            title: 'Mi cuenta · Panel',
            loadComponent: () => import('./cuenta-page').then((m) => m.CuentaPage),
          },
          { path: '**', redirectTo: '' },
        ],
      },
    ],
  },
];
