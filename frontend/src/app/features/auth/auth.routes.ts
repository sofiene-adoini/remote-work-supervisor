import { Routes } from '@angular/router';

export const AUTH_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/login-page.component').then((m) => m.LoginPageComponent),
  },
];
