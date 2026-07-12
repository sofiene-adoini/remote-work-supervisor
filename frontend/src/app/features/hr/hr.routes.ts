import { Routes } from '@angular/router';

export const HR_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'dashboard',
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./pages/hr-dashboard.component').then((m) => m.HrDashboardComponent),
  },
  {
    path: 'teams',
    loadComponent: () => import('./pages/hr-teams.component').then((m) => m.HrTeamsComponent),
  },
  {
    path: 'teams/:teamId',
    loadComponent: () => import('./pages/hr-team-members.component').then((m) => m.HrTeamMembersComponent),
  },
  {
    path: 'members',
    loadComponent: () => import('./pages/hr-team-members.component').then((m) => m.HrTeamMembersComponent),
  },
  {
    path: 'overtime',
    loadComponent: () => import('./pages/hr-overtime.component').then((m) => m.HrOvertimeComponent),
  },
  {
    path: 'alerts',
    loadComponent: () => import('./pages/hr-alerts.component').then((m) => m.HrAlertsComponent),
  },
];
