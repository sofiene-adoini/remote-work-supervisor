import { BreakpointObserver } from '@angular/cdk/layout';
import { Component, computed, inject, signal, OnInit, Type } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink, RouterLinkActive, RouterOutlet, NavigationEnd } from '@angular/router';
import { DatePipe, NgComponentOutlet } from '@angular/common';
import { filter, map } from 'rxjs';
import { AuthService } from '../../../features/auth/services/auth.service';
import { AlertsService } from '../../../features/employee/services/alerts.service';
import { HrAlertsService } from '../../../features/hr/services/hr-alerts.service';
import { RealtimeService, AlertCreatedEvent } from '../../../core/services/realtime.service';
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
  LucideMonitor,
  LucideShield,
  LucideSettings,
  LucideBarChart3,
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
    LucideMonitor,
    LucideShield,
    LucideSettings,
    LucideBarChart3,
    DatePipe,
  ],
  templateUrl: './dashboard-layout.component.html',
  styleUrl: './dashboard-layout.component.scss',
})
export class DashboardLayoutComponent implements OnInit {
  private readonly breakpointObserver = inject(BreakpointObserver);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly alertsService = inject(AlertsService);
  private readonly hrAlertsService = inject(HrAlertsService);
  private readonly realtime = inject(RealtimeService);

  protected readonly currentUser = toSignal(this.auth.currentUser$, { initialValue: this.auth.currentUser });
  protected readonly userRole = computed(() => this.currentUser()?.role?.name ?? 'Employee');

  protected readonly isMobile = toSignal(
    this.breakpointObserver.observe('(max-width: 1023px)').pipe(map((s) => s.matches)),
    { initialValue: false },
  );

  protected readonly sidebarCollapsed = signal(false);
  protected readonly userMenuOpen = signal(false);
  protected readonly currentTime = signal(new Date());
  protected readonly unreadAlertCount = signal(0);

  protected readonly sidebarWidth = computed(() => (this.sidebarCollapsed() ? '64px' : '268px'));

  protected readonly allNavItems: NavItem[] = [
    { label: 'Dashboard', icon: LucideLayoutDashboard, path: '/employee/dashboard', roles: ['Employee'] },
    { label: 'My Time', icon: LucideClock, path: '/employee/time', roles: ['Employee'] },
    { label: 'Projects', icon: LucideFolderOpen, path: '/employee/projects', roles: ['Employee'] },
    { label: 'Overtime', icon: LucideChartBar, path: '/employee/overtime', roles: ['Employee'] },
    { label: 'Alerts', icon: LucideBell, path: '/employee/alerts', roles: ['Employee'] },
    { label: 'Desktop Agent', icon: LucideMonitor, path: '/employee/desktop-agent', roles: ['Employee'] },
    { label: 'Dashboard', icon: LucideLayoutDashboard, path: '/hr/dashboard', roles: ['HR', 'Admin'] },
    { label: 'Employees', icon: LucideUser, path: '/hr/employees', roles: ['HR', 'Admin'] },
    { label: 'Teams', icon: LucideUsersRound, path: '/hr/teams', roles: ['HR', 'Admin'] },
    { label: 'Projects', icon: LucideFolderOpen, path: '/hr/projects', roles: ['HR', 'Admin'] },
    { label: 'Overtime', icon: LucideChartBar, path: '/hr/overtime', roles: ['HR', 'Admin'] },
    { label: 'Alerts', icon: LucideTriangleAlert, path: '/hr/alerts', roles: ['HR', 'Admin'] },
    { label: 'Statistics', icon: LucideBarChart3, path: '/hr/statistics', roles: ['HR', 'Admin'] },
    { label: 'Trusted Devices', icon: LucideShield, path: '/hr/devices', roles: ['HR', 'Admin'] },
    { label: 'Work Policy', icon: LucideSettings, path: '/hr/settings', roles: ['HR', 'Admin'] },
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

  ngOnInit(): void {
    this.loadUnreadCount();
    this.subscribeToRealtime();
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
    ).subscribe(() => this.loadUnreadCount());
  }

  private loadUnreadCount(): void {
    const role = this.userRole();
    if (role === 'HR' || role === 'Admin') {
      this.hrAlertsService.getUnreadCount().subscribe({
        next: (res) => this.unreadAlertCount.set(res.unreadCount),
      });
    } else {
      this.alertsService.getMyAlerts({ limit: 1, unreadOnly: true }).subscribe({
        next: (res) => this.unreadAlertCount.set(res.unreadCount),
      });
    }
  }

  private subscribeToRealtime(): void {
    this.realtime.alertCreated$.subscribe((event: AlertCreatedEvent) => {
      if (event.user?.id === this.currentUser()?.id) {
        this.unreadAlertCount.update((c) => c + 1);
      }
    });
  }

  protected toggleSidebar(): void {
    this.sidebarCollapsed.update((v) => !v);
  }

  protected closeSidebar(): void {
    if (this.isMobile()) {
      this.sidebarCollapsed.set(true);
    }
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
