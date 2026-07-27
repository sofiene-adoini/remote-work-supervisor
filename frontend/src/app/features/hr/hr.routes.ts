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
    loadComponent: () => import('./pages/hr-team-detail.component').then((m) => m.HrTeamDetailComponent),
  },
  {
    path: 'members',
    loadComponent: () => import('./pages/hr-team-members.component').then((m) => m.HrTeamMembersComponent),
  },
  {
    path: 'projects',
    loadComponent: () => import('./pages/hr-projects.component').then((m) => m.HrProjectsComponent),
  },
  {
    path: 'overtime',
    loadComponent: () => import('./pages/hr-overtime.component').then((m) => m.HrOvertimeComponent),
  },
  {
    path: 'alerts',
    loadComponent: () => import('./pages/hr-alerts.component').then((m) => m.HrAlertsComponent),
  },
  {
    path: 'devices',
    loadComponent: () => import('./pages/hr-devices.component').then((m) => m.HrDevicesComponent),
  },
  {
    path: 'statistics',
    loadComponent: () => import('./pages/hr-statistics.component').then((m) => m.HrStatisticsComponent),
  },
  {
    path: 'settings',
    loadComponent: () => import('./pages/hr-settings.component').then((m) => m.HrSettingsComponent),
  },
];
