import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';
import { roleGuard } from './core/guards/role.guard';
import { AuthLayoutComponent } from './shared/layouts/auth-layout/auth-layout.component';
import { DashboardLayoutComponent } from './shared/layouts/dashboard-layout/dashboard-layout.component';

export const routes: Routes = [
	{
		path: '',
		component: AuthLayoutComponent,
		canActivate: [guestGuard],
		children: [
			{
				path: '',
				loadChildren: () => import('./features/auth/auth.routes').then((m) => m.AUTH_ROUTES),
			},
		],
	},
	{
		path: '',
		component: DashboardLayoutComponent,
		canActivate: [authGuard],
		children: [
			{
				path: '',
				pathMatch: 'full',
				redirectTo: 'dashboard',
			},
			{
				path: 'dashboard',
				loadChildren: () =>
					import('./features/dashboard/dashboard.routes').then((m) => m.DASHBOARD_ROUTES),
			},
			{
				path: 'projects',
				loadChildren: () => import('./features/projects/projects.routes').then((m) => m.PROJECTS_ROUTES),
			},
			{
				path: 'reports',
				loadChildren: () => import('./features/reports/reports.routes').then((m) => m.REPORTS_ROUTES),
			},
			{
				path: 'settings',
				loadChildren: () => import('./features/settings/settings.routes').then((m) => m.SETTINGS_ROUTES),
			},
			{
				path: 'hr',
				canActivate: [roleGuard],
				data: { roles: ['HR', 'Admin'] },
				loadChildren: () => import('./features/hr/hr.routes').then((m) => m.HR_ROUTES),
			},
			{
				path: 'employee',
				loadChildren: () => import('./features/employee/employee.routes').then((m) => m.EMPLOYEE_ROUTES),
			},
		],
	},
	{
		path: '**',
		redirectTo: 'dashboard',
	},
];
