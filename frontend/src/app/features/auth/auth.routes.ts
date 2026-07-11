import { Routes } from '@angular/router';

export const AUTH_ROUTES: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login-page.component').then((m) => m.LoginPageComponent),
  },
  {
    path: 'forgot-password',
    loadComponent: () =>
      import('./pages/forgot-password-page.component').then((m) => m.ForgotPasswordPageComponent),
  },
  {
    path: 'reset-password',
    loadComponent: () =>
      import('./pages/reset-password-page.component').then((m) => m.ResetPasswordPageComponent),
  },
  {
    path: 'set-initial-password',
    loadComponent: () =>
      import('./pages/set-initial-password-page.component').then((m) => m.SetInitialPasswordPageComponent),
  },
];
