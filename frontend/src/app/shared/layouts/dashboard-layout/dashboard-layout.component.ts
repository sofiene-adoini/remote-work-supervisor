import { BreakpointObserver } from '@angular/cdk/layout';
import { Component, computed, inject, signal, Type } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { DatePipe, NgComponentOutlet } from '@angular/common';
import { map } from 'rxjs';
import { AuthService } from '../../../features/auth/services/auth.service';
import {
  LucideLayoutDashboard,
  LucideUser,
  LucideUsersRound,
  LucideFolderOpen,
  LucideTriangleAlert,
  LucideChartBar,
  LucideLogOut,
  LucideBell,
  LucideMenu,
  LucideX,
  LucideChevronDown,
  LucideClock,
} from '@lucide/angular';

interface NavItem {
  label: string;
  icon: Type<any>;
  path: string;
  roles?: string[];
}

@Component({
  selector: 'app-dashboard-layout',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    NgComponentOutlet,
    LucideLayoutDashboard,
    LucideUser,
    LucideUsersRound,
    LucideFolderOpen,
    LucideTriangleAlert,
    LucideChartBar,
    LucideLogOut,
    LucideBell,
    LucideMenu,
    LucideX,
    LucideChevronDown,
    LucideClock,
    DatePipe,
  ],
  templateUrl: './dashboard-layout.component.html',
  styleUrl: './dashboard-layout.component.scss',
})
export class DashboardLayoutComponent {
  private readonly breakpointObserver = inject(BreakpointObserver);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly currentUser = toSignal(this.auth.currentUser$, { initialValue: this.auth.currentUser });
  protected readonly userRole = computed(() => this.currentUser()?.role?.name ?? 'Employee');

  protected readonly isMobile = toSignal(
    this.breakpointObserver.observe('(max-width: 1023px)').pipe(map((s) => s.matches)),
    { initialValue: false },
  );

  protected readonly sidebarCollapsed = signal(false);
  protected readonly notificationsOpen = signal(false);
  protected readonly userMenuOpen = signal(false);
  protected readonly currentTime = signal(new Date());

  protected readonly sidebarWidth = computed(() => (this.sidebarCollapsed() ? '64px' : '268px'));

  protected readonly allNavItems: NavItem[] = [
    { label: 'Dashboard', icon: LucideLayoutDashboard, path: '/employee/dashboard', roles: ['Employee'] },
    { label: 'My Time', icon: LucideClock, path: '/employee/time', roles: ['Employee'] },
    { label: 'Projects', icon: LucideFolderOpen, path: '/employee/projects', roles: ['Employee'] },
    { label: 'Overtime', icon: LucideChartBar, path: '/employee/overtime', roles: ['Employee'] },
    { label: 'Dashboard', icon: LucideLayoutDashboard, path: '/hr/dashboard', roles: ['HR', 'Admin'] },
    { label: 'Members', icon: LucideUser, path: '/hr/members', roles: ['HR', 'Admin'] },
    { label: 'Teams', icon: LucideUsersRound, path: '/hr/teams', roles: ['HR', 'Admin'] },
    { label: 'Projects', icon: LucideFolderOpen, path: '/hr/projects', roles: ['HR', 'Admin'] },
    { label: 'Overtime', icon: LucideChartBar, path: '/hr/overtime', roles: ['HR', 'Admin'] },
    { label: 'Alerts', icon: LucideTriangleAlert, path: '/hr/alerts', roles: ['HR', 'Admin'] },
  ];

  protected readonly filteredNavItems = computed(() => {
    const role = this.userRole();
    return this.allNavItems.filter((item) => !item.roles || item.roles.includes(role));
  });

  protected readonly pageTitle = computed(() => {
    const url = this.router.url;
    const match = this.allNavItems.find((i) => url.startsWith(i.path));
    return match?.label ?? 'Dashboard';
  });

  protected readonly isEmployee = computed(() => {
    const role = this.userRole();
    return role === 'Employee';
  });

  constructor() {
    const id = setInterval(() => this.currentTime.set(new Date()), 1000);
  }

  protected toggleSidebar(): void {
    this.sidebarCollapsed.update((v) => !v);
  }

  protected closeSidebar(): void {
    if (this.isMobile()) {
      this.sidebarCollapsed.set(true);
    }
  }

  protected toggleNotifications(): void {
    this.notificationsOpen.update((v) => !v);
  }

  protected toggleUserMenu(): void {
    this.userMenuOpen.update((v) => !v);
  }

  protected closeUserMenu(): void {
    this.userMenuOpen.set(false);
  }

  protected logout(): void {
    this.userMenuOpen.set(false);
    this.auth.logout().subscribe();
  }
}
