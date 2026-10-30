import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './guards/auth-guard';
import { MainLayout } from './layout/main-layout/main-layout';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login').then((m) => m.Login),
    canActivate: [guestGuard],
  },
  {
    path: '',
    component: MainLayout,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () => import('./pages/dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'usuarios',
        loadComponent: () => import('./pages/usuarios/usuarios').then((m) => m.Usuarios),
      },
      {
        path: 'proveedores',
        loadComponent: () => import('./pages/proveedores/proveedores').then((m) => m.Proveedores),
      },
      {
        path: 'productos',
        loadComponent: () => import('./pages/productos/productos').then((m) => m.Productos),
      },
      {
        path: 'catalogo',
        loadComponent: () => import('./pages/catalogo/catalogo').then((m) => m.Catalogo),
      },
      {
        path: 'finanzas',
        loadComponent: () => import('./pages/finanzas/finanzas').then((m) => m.Finanzas),
      },
      {
        path: 'reportes',
        loadComponent: () => import('./pages/reportes/reportes').then((m) => m.Reportes),
      },
      {
        path: 'ajustes',
        loadComponent: () => import('./pages/ajustes/ajustes').then((m) => m.Ajustes),
      },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
