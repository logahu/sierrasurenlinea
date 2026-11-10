import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { ClienteSesionService } from './cliente-sesion';

/** Mi cuenta: sin sesión, a "Iniciar sesión". */
const conCuenta: CanActivateFn = () =>
  inject(ClienteSesionService).activa() ? true : inject(Router).createUrlTree(['/cuenta/entrar']);

export const CUENTA_ROUTES: Routes = [
  {
    path: '',
    title: 'Mi cuenta · Sierra Sur en Línea',
    canActivate: [conCuenta],
    loadComponent: () => import('./mi-cuenta-page').then((m) => m.MiCuentaPage),
  },
  {
    path: 'entrar',
    title: 'Iniciar sesión · Sierra Sur en Línea',
    loadComponent: () => import('./entrar-cliente-page').then((m) => m.EntrarClientePage),
  },
  {
    path: 'registro',
    title: 'Crear cuenta · Sierra Sur en Línea',
    loadComponent: () => import('./registro-page').then((m) => m.RegistroPage),
  },
];
