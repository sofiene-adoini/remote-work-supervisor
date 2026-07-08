import { Routes } from '@angular/router';

export const HR_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/hr-page.component').then((m) => m.HrPageComponent),
  },
];
