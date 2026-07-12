import { Routes } from '@angular/router';

export const DASHBOARD_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/dashboard-redirect.component').then((m) => m.DashboardRedirectComponent),
  },
];
