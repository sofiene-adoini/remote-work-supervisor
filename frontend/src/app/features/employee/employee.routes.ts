import { Routes } from '@angular/router';

export const EMPLOYEE_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/employee-page.component').then((m) => m.EmployeePageComponent),
  },
];
