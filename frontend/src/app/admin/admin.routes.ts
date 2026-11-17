import { Routes } from '@angular/router';
import { aSuInicio, conAgenda, conSesion, sinEmpleado, sinRepartidor, soloDueno } from './autorizacion';

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
          { path: 'inicio', canActivate: [aSuInicio], children: [] },
          {
            path: 'agenda',
            title: 'Agenda · Panel',
            canActivate: [conAgenda],
            loadComponent: () => import('./agenda-page').then((m) => m.AgendaPage),
          },
          {
            path: 'pedidos',
            title: 'Pedidos · Panel',
            canActivate: [sinEmpleado],
            loadComponent: () => import('./pedidos-page').then((m) => m.PedidosPage),
          },
          {
            path: 'cuenta',
            title: 'Mi perfil · Panel',
            loadComponent: () => import('./cuenta-page').then((m) => m.CuentaPage),
          },
          {
            path: '',
            canActivateChild: [sinRepartidor],
            canActivate: [sinRepartidor],
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
                path: 'negocios/:slug/lista-del-mandado',
                title: 'Lista del mandado · Panel',
                loadComponent: () => import('./tipos-encargo-page').then((m) => m.TiposEncargoPage),
              },
              {
                path: 'negocios/:slug/comida',
                title: 'Comida a domicilio · Panel',
                loadComponent: () => import('./comida-page').then((m) => m.ComidaPage),
              },
              {
                path: 'negocios/:slug/categorias',
                title: 'Categorías · Panel',
                loadComponent: () => import('./categorias-page').then((m) => m.CategoriasPage),
              },
              {
                path: 'negocios/:slug/equipo',
                title: 'Equipo y agenda · Panel',
                loadComponent: () => import('./equipo-page').then((m) => m.EquipoPage),
              },
              {
                path: 'negocios/:slug/datos',
                title: 'Datos del negocio · Panel',
                loadComponent: () => import('./editar-negocio').then((m) => m.EditarNegocio),
              },
              {
                path: 'negocios/:slug/fotos',
                title: 'Fotos · Panel',
                loadComponent: () => import('./fotos-page').then((m) => m.FotosPage),
              },
              {
                path: 'tablero',
                title: 'Tablero · Panel',
                loadComponent: () => import('./tablero-page').then((m) => m.TableroPage),
              },
              {
                path: 'historial',
                title: 'Historial · Panel',
                loadComponent: () => import('./historial-page').then((m) => m.HistorialPage),
              },
              {
                path: 'visibilidad',
                title: 'Negocios en el sitio · Panel',
                canActivate: [soloDueno],
                loadComponent: () => import('./visibilidad-page').then((m) => m.VisibilidadPage),
              },
              {
                path: 'colonias',
                title: 'Colonias · Panel',
                canActivate: [soloDueno],
                loadComponent: () => import('./colonias-page').then((m) => m.ColoniasPage),
              },
              {
                path: 'publicidad',
                title: 'Publicidad · Panel',
                canActivate: [soloDueno],
                loadComponent: () => import('./publicidad-page').then((m) => m.PublicidadPage),
              },
              {
                path: 'usuarios',
                title: 'Usuarios · Panel',
                canActivate: [soloDueno],
                loadComponent: () => import('./usuarios-page').then((m) => m.UsuariosPage),
              },
              { path: '**', redirectTo: '' },
            ],
          },
        ],
      },
    ],
  },
];
