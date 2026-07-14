import { Routes } from '@angular/router';

export const EMPLOYEE_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'dashboard',
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./pages/employee-dashboard.component').then((m) => m.EmployeeDashboardComponent),
  },
  {
    path: 'time',
    loadComponent: () => import('./pages/employee-time.component').then((m) => m.EmployeeTimeComponent),
  },
  {
    path: 'projects',
    loadComponent: () => import('./pages/employee-projects.component').then((m) => m.EmployeeProjectsComponent),
  },
  {
    path: 'alerts',
    loadComponent: () => import('./pages/employee-alerts.component').then((m) => m.EmployeeAlertsComponent),
  },
  {
    path: 'overtime',
    loadComponent: () => import('./pages/employee-overtime.component').then((m) => m.EmployeeOvertimeComponent),
  },
];
