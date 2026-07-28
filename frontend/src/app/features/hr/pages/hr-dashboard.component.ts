import { Component, inject, OnInit, signal, DestroyRef } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe, DecimalPipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  LucideUsers, LucideClock, LucideCoffee, LucideTriangleAlert,
  LucideTimer, LucideCalendarClock, LucideBell, LucideArrowRight,
  LucideCheck, LucideXCircle,
} from '@lucide/angular';
import { HrStatsService } from '../services/hr-stats.service';
import { HrTeamsService } from '../services/hr-teams.service';
import { HrOvertimeService } from '../services/hr-overtime.service';
import { HrAlertsService } from '../services/hr-alerts.service';
import { HrSettingsService } from '../services/hr-settings.service';
import { HrDashboardStats, HrTeamMember, HrOvertimeDeclaration, HrAlert, HrEmployeeStats } from '../models/hr.models';
import { RealtimeService, SessionStatusEvent, AlertCreatedEvent, OvertimeDetectedEvent } from '../../../core/services/realtime.service';

@Component({
  selector: 'app-hr-dashboard',
  imports: [
    RouterLink, DatePipe, DecimalPipe,
    LucideUsers, LucideClock, LucideCoffee, LucideTriangleAlert,
    LucideTimer, LucideCalendarClock, LucideBell, LucideArrowRight,
    LucideCheck, LucideXCircle,
  ],
  template: `
    <div class="hr-dashboard">
      <!-- Stats Row -->
      <div class="stats-grid">
        @for (card of statCards(); track card.label) {
          <div class="stat-card">
            <div class="stat-icon" [style.background]="card.bg">
              @switch (card.icon) {
                @case ('users') { <svg lucideUsers [class]="'icon-sm'" [style.color]="card.color"></svg> }
                @case ('clock') { <svg lucideClock [class]="'icon-sm'" [style.color]="card.color"></svg> }
                @case ('coffee') { <svg lucideCoffee [class]="'icon-sm'" [style.color]="card.color"></svg> }
                @case ('alert') { <svg lucideTriangleAlert [class]="'icon-sm'" [style.color]="card.color"></svg> }
                @case ('timer') { <svg lucideTimer [class]="'icon-sm'" [style.color]="card.color"></svg> }
                @case ('calendar') { <svg lucideCalendarClock [class]="'icon-sm'" [style.color]="card.color"></svg> }
              }
            </div>
            <div class="stat-body">
              @if (statsLoading()) {
                <div class="sk sk-num"></div>
              } @else {
                <span class="stat-value">{{ card.value }}</span>
              }
              <span class="stat-label">{{ card.label }}</span>
            </div>
          </div>
        }
      </div>

      <!-- Main Content Grid -->
      <div class="content-grid">
        <!-- Team Status -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Team Status</h3>
            <a routerLink="/hr/members" class="link-btn">
              View all <svg lucideArrowRight class="icon-xs"></svg>
            </a>
          </div>
          @if (membersLoading()) {
            <div class="sk-list">
              @for (i of [1,2,3,4]; track i) {
                <div class="sk sk-row"></div>
              }
            </div>
          } @else if (activeMembers().length === 0) {
            <div class="empty">
              <svg lucideUsers class="empty-icon"></svg>
              <p class="empty-text">No team members found</p>
            </div>
          } @else {
            <div class="member-list">
              @for (member of activeMembers(); track member.id) {
                <div class="member-row">
                  <div class="member-avatar">{{ member.fullName.charAt(0) }}</div>
                  <div class="member-info">
                    <span class="member-name">{{ member.fullName }}</span>
                    <span class="member-hours">{{ member.hoursToday }}h today</span>
                  </div>
                  <span class="status-badge" [class]="'status-' + member.status">
                    <span class="status-dot-sm"></span>
                    @switch (member.status) {
                      @case ('active') { Active }
                      @case ('break') { On Break }
                      @case ('idle') { Idle }
                      @default { Offline }
                    }
                  </span>
                </div>
              }
            </div>
          }
        </div>

        <!-- Employee Work Stats -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Work Statistics</h3>
          </div>
          @if (employeeStatsLoading()) {
            <div class="sk-list">
              @for (i of [1,2,3]; track i) {
                <div class="sk sk-row"></div>
              }
            </div>
          } @else if (employeeStatsList().length === 0) {
            <div class="empty">
              <svg lucideTimer class="empty-icon"></svg>
              <p class="empty-text">No employee data</p>
            </div>
          } @else {
            <div class="stats-list">
              @for (emp of employeeStatsList(); track emp.userId) {
                <div class="stats-row">
                  <div class="stats-name">{{ emp.fullName }}</div>
                  <div class="stats-metrics">
                    <span class="metric">
                      <span class="metric-label">Worked</span>
                      <span class="metric-value">{{ (emp.dailyStats.workedMinutes / 60) | number:'1.1-1' }}h</span>
                    </span>
                    <span class="metric">
                      <span class="metric-label">Expected</span>
                      <span class="metric-value">{{ (emp.dailyStats.expectedMinutes / 60) | number:'1.1-1' }}h</span>
                    </span>
                    <span class="metric">
                      <span class="metric-label">Weekly</span>
                      <span class="metric-value">{{ emp.weeklyStats.workedHours }}h</span>
                    </span>
                    <span class="eval-badge" [class]="'eval-' + emp.attendanceEvaluation">
                      {{ emp.attendanceEvaluation }}
                    </span>
                  </div>
                  @if (emp.currentSession) {
                    <div class="session-info">
                      <span class="session-status" [class]="'ss-' + emp.currentSession.status">
                        {{ emp.currentSession.status }}
                      </span>
                      <span class="session-duration">{{ emp.currentSession.durationMinutes }}m</span>
                    </div>
                  }
                </div>
              }
            </div>
          }
        </div>

        <!-- Pending Overtime -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Pending Overtime</h3>
            <a routerLink="/hr/overtime" class="link-btn">
              Review <svg lucideArrowRight class="icon-xs"></svg>
            </a>
          </div>
          @if (overtimeLoading()) {
            <div class="sk-list">
              @for (i of [1,2,3]; track i) {
                <div class="sk sk-row"></div>
              }
            </div>
          } @else if (pendingOvertime().length === 0) {
            <div class="empty">
              <svg lucideCalendarClock class="empty-icon"></svg>
              <p class="empty-text">No pending declarations</p>
            </div>
          } @else {
            <div class="ot-list">
              @for (ot of pendingOvertime().slice(0, 5); track ot.id) {
                <div class="ot-row">
                  <div class="ot-info">
                    <span class="ot-name">{{ ot.user?.fullName }}</span>
                    <span class="ot-detail">{{ (ot.overtimeMinutes / 60) | number:'1.1-1' }}h OT — {{ ot.date | date:'mediumDate' }}</span>
                  </div>
                  <div class="ot-actions">
                    <button class="btn-icon btn-approve" (click)="handleApprove(ot.id)" title="Approve">
                      <svg lucideCheck class="icon-xs"></svg>
                    </button>
                    <button class="btn-icon btn-reject" (click)="handleReject(ot.id)" title="Reject">
                      <svg lucideXCircle class="icon-xs"></svg>
                    </button>
                  </div>
                </div>
              }
            </div>
          }
        </div>

        <!-- Quick Actions -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Quick Actions</h3>
          </div>
          <div class="actions-grid">
            <a routerLink="/hr/members" class="action-card">
              <svg lucideUsers class="action-icon"></svg>
              <span class="action-label">Team Members</span>
              <span class="action-sub">{{ stats()?.totalEmployees ?? 0 }} employees</span>
            </a>
            <a routerLink="/hr/overtime" class="action-card">
              <svg lucideCalendarClock class="action-icon"></svg>
              <span class="action-label">Overtime</span>
              <span class="action-sub">{{ stats()?.pendingOvertime ?? 0 }} pending</span>
            </a>
            <a routerLink="/hr/settings" class="action-card">
              <svg lucideTimer class="action-icon"></svg>
              <span class="action-label">Work Policy</span>
              <span class="action-sub">Configure rules</span>
            </a>
            <a routerLink="/hr/devices" class="action-card">
              <svg lucideBell class="action-icon"></svg>
              <span class="action-label">Devices</span>
              <span class="action-sub">Manage agents</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    @use 'styles/design-tokens' as t;

    .hr-dashboard {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    /* ── Stats Grid ────────────────────────────────────────── */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 1rem;
    }

    .stat-card {
      display: flex;
      align-items: center;
      gap: 0.875rem;
      padding: 1.25rem;
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
    }

    .stat-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      border-radius: 10px;
      flex-shrink: 0;
    }

    .stat-body {
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
      min-width: 0;
    }

    .stat-value {
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--rws-text);
      line-height: 1.2;
    }

    .stat-label {
      font-size: 0.8125rem;
      color: var(--rws-text-muted);
    }

    /* ── Content Grid ──────────────────────────────────────── */
    .content-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }

    .card {
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
      padding: 1.25rem;
    }

    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1rem;
    }

    .card-title {
      margin: 0;
      font-size: 1rem;
      font-weight: 600;
      color: var(--rws-text);
    }

    .link-btn {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      font-size: 0.8125rem;
      font-weight: 500;
      color: var(--rws-accent);
      text-decoration: none;
      transition: color 150ms ease;

      &:hover { color: var(--rws-accent-strong); }
    }

    /* ── Member List ───────────────────────────────────────── */
    .member-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .member-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.625rem 0;
      border-bottom: 1px solid #f0f2f5;

      &:last-child { border-bottom: none; }
    }

    .member-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--rws-primary), var(--rws-accent));
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.8125rem;
      font-weight: 700;
      color: #fff;
      flex-shrink: 0;
    }

    .member-info {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 0.0625rem;
    }

    .member-name {
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--rws-text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .member-hours {
      font-size: 0.75rem;
      color: var(--rws-text-muted);
    }

    /* ── Status Badge ──────────────────────────────────────── */
    .status-badge {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.25rem 0.625rem;
      border-radius: 999px;
      font-size: 0.75rem;
      font-weight: 600;
      white-space: nowrap;
    }

    .status-active {
      background: #e8f8f6;
      color: #167d72;
    }

    .status-break {
      background: #fef3e2;
      color: #92610a;
    }

    .status-clocked_out {
      background: var(--rws-bg);
      color: var(--rws-text-muted);
    }

    .status-idle {
      background: #fde8e8;
      color: #b91c1c;
    }

    .status-dot-sm {
      width: 6px;
      height: 6px;
      border-radius: 50%;

      .status-active & { background: #1fb6a6; }
      .status-break & { background: #d9973b; }
      .status-clocked_out & { background: #9ca3af; }
      .status-idle & { background: #d64545; }
    }

    /* ── Overtime List ─────────────────────────────────────── */
    .ot-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .ot-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      padding: 0.625rem 0;
      border-bottom: 1px solid #f0f2f5;

      &:last-child { border-bottom: none; }
    }

    .ot-info {
      display: flex;
      flex-direction: column;
      gap: 0.0625rem;
      min-width: 0;
    }

    .ot-name {
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--rws-text);
    }

    .ot-detail {
      font-size: 0.75rem;
      color: var(--rws-text-muted);
    }

    .ot-actions {
      display: flex;
      gap: 0.375rem;
    }

    .btn-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 30px;
      height: 30px;
      border: none;
      border-radius: var(--rws-radius);
      cursor: pointer;
      transition: background-color 150ms ease, transform 100ms ease;

      &:active { transform: scale(0.92); }
      &:focus-visible { outline: 3px solid var(--rws-focus-ring); outline-offset: 2px; }
    }

    .btn-approve {
      background: #e8f8f6;
      color: #167d72;

      &:hover { background: #d0f0ec; }
    }

    .btn-reject {
      background: #fde8e8;
      color: #d64545;

      &:hover { background: #fbd5d5; }
    }

    /* ── Alert List ────────────────────────────────────────── */
    .alert-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .alert-row {
      display: flex;
      gap: 0.625rem;
      padding: 0.625rem 0;
      border-bottom: 1px solid #f0f2f5;

      &:last-child { border-bottom: none; }
    }

    .alert-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      margin-top: 0.375rem;
      flex-shrink: 0;

      &.dot-info { background: #3b82f6; }
      &.dot-warning { background: #d9973b; }
      &.dot-error { background: #d64545; }
      &.dot-success { background: #1fb6a6; }
    }

    .alert-content { flex: 1; min-width: 0; }

    .alert-message {
      margin: 0;
      font-size: 0.8125rem;
      color: var(--rws-text);
      line-height: 1.4;
    }

    .alert-meta {
      font-size: 0.6875rem;
      color: var(--rws-text-muted);
    }

    /* ── Quick Actions ─────────────────────────────────────── */
    .actions-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.75rem;
    }

    .action-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      padding: 1.25rem 0.75rem;
      border-radius: var(--rws-radius);
      border: 1px solid var(--rws-border);
      background: var(--rws-bg);
      cursor: pointer;
      transition: border-color 150ms ease, box-shadow 150ms ease;
      text-decoration: none;

      &:hover {
        border-color: var(--rws-accent);
        box-shadow: 0 0 0 1px var(--rws-accent);
        transform: translateY(-1px);
      }
    }

    .action-icon { width: 22px; height: 22px; color: var(--rws-accent); }
    .action-label { font-size: 0.8125rem; font-weight: 600; color: var(--rws-text); }
    .action-sub { font-size: 0.75rem; color: var(--rws-text-muted); }

    /* ── Empty State ───────────────────────────────────────── */
    .empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 2rem 0;
      text-align: center;
    }

    .empty-icon { width: 36px; height: 36px; color: var(--rws-text-muted); opacity: 0.4; margin-bottom: 0.75rem; }
    .empty-text { margin: 0; font-size: 0.875rem; color: var(--rws-text-muted); }

    .icon-xs { width: 14px; height: 14px; }
    .icon-sm { width: 20px; height: 20px; }

    /* ── Employee Stats List ──────────────────────────────── */
    .stats-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .stats-row {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
      padding: 0.625rem 0;
      border-bottom: 1px solid #f0f2f5;

      &:last-child { border-bottom: none; }
    }

    .stats-name {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--rws-text);
    }

    .stats-metrics {
      display: flex;
      gap: 0.75rem;
      flex-wrap: wrap;
      align-items: center;
    }

    .metric {
      display: flex;
      flex-direction: column;
      gap: 0.0625rem;
    }

    .metric-label {
      font-size: 0.625rem;
      color: var(--rws-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .metric-value {
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--rws-text);
      font-family: var(--rws-font-mono);
    }

    .eval-badge {
      padding: 0.1875rem 0.5rem;
      border-radius: 999px;
      font-size: 0.6875rem;
      font-weight: 600;
      text-transform: capitalize;

      &.eval-excellent { background: #e8f8f6; color: #167d72; }
      &.eval-good { background: #e8f1fb; color: #2b3a67; }
      &.eval-acceptable { background: #fef3e2; color: #92610a; }
      &.eval-underworked { background: #fde8e8; color: #d64545; }
      &.eval-absent { background: #f3f4f6; color: #6b7280; }
      &.eval-overtime { background: #fef3e2; color: #92610a; }
      &.eval-break_violation { background: #fde8e8; color: #d64545; }
    }

    .session-info {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .session-status {
      font-size: 0.6875rem;
      font-weight: 600;
      padding: 0.125rem 0.375rem;
      border-radius: 4px;
      text-transform: capitalize;

      &.ss-active { background: #e8f8f6; color: #167d72; }
      &.ss-break { background: #fef3e2; color: #92610a; }
    }

    .session-duration {
      font-size: 0.75rem;
      color: var(--rws-text-muted);
      font-family: var(--rws-font-mono);
    }

    @media (max-width: 1023px) {
      .content-grid { grid-template-columns: 1fr; }
    }

    @media (max-width: 639px) {
      .stats-grid { grid-template-columns: 1fr 1fr; }
      .actions-grid { grid-template-columns: 1fr; }
    }

    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
    }
  `],
})
export class HrDashboardComponent implements OnInit {
  private readonly statsService = inject(HrStatsService);
  private readonly teamsService = inject(HrTeamsService);
  private readonly overtimeService = inject(HrOvertimeService);
  private readonly alertsService = inject(HrAlertsService);
  private readonly settingsService = inject(HrSettingsService);
  private readonly realtime = inject(RealtimeService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly stats = signal<HrDashboardStats | null>(null);
  protected readonly statsLoading = signal(true);
  protected readonly activeMembers = signal<HrTeamMember[]>([]);
  protected readonly membersLoading = signal(true);
  protected readonly pendingOvertime = signal<HrOvertimeDeclaration[]>([]);
  protected readonly overtimeLoading = signal(true);
  protected readonly recentAlerts = signal<HrAlert[]>([]);
  protected readonly alertsLoading = signal(true);
  protected readonly employeeStatsList = signal<HrEmployeeStats[]>([]);
  protected readonly employeeStatsLoading = signal(true);

  protected readonly statCards = () => {
    const s = this.stats();
    return [
      { icon: 'users', label: 'Total Employees', value: s?.totalEmployees ?? 0, bg: '#e8f1fb', color: '#2b3a67' },
      { icon: 'clock', label: 'Active Now', value: s?.activeNow ?? 0, bg: '#e8f8f6', color: '#167d72' },
      { icon: 'coffee', label: 'On Break', value: s?.onBreak ?? 0, bg: '#fef3e2', color: '#92610a' },
      { icon: 'alert', label: 'Idle / Flagged', value: s?.idleFlagged ?? 0, bg: '#fde8e8', color: '#d64545' },
      { icon: 'timer', label: 'Hours Today', value: s?.totalHoursToday ?? 0, bg: '#e8f1fb', color: '#2b3a67' },
      { icon: 'calendar', label: 'Pending OT', value: s?.pendingOvertime ?? 0, bg: '#fef3e2', color: '#92610a' },
    ];
  };

  ngOnInit(): void {
    this.loadAll();
    this.subscribeToRealtime();
  }

  private subscribeToRealtime(): void {
    this.realtime.sessionChanged$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((event) => {
      this.patchMemberStatus(event.userId, event.status);
      this.patchMemberHours(event.userId, event);
      this.refreshStatsFromApi();
    });

    this.realtime.overtimeChanged$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((event) => {
      if (event.status !== 'submitted') {
        this.pendingOvertime.update((list) => list.filter((d) => d.id !== event.overtimeId));
        this.refreshStatsFromApi();
      }
      this.loadPendingOvertime();
    });

    this.realtime.overtimeDetected$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.loadPendingOvertime();
      this.refreshStatsFromApi();
    });

    this.realtime.alertCreated$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((event: AlertCreatedEvent) => {
      const alertDate = new Date(event.createdAt);
      const today = new Date();
      const isToday = alertDate.getFullYear() === today.getFullYear()
        && alertDate.getMonth() === today.getMonth()
        && alertDate.getDate() === today.getDate();

      const newAlert: HrAlert = {
        id: event.id,
        type: event.type,
        title: event.title,
        severity: event.severity,
        message: event.message,
        isRead: event.isRead,
        createdAt: event.createdAt,
        user: event.user,
        session: event.session,
      };

      if (isToday) {
        this.recentAlerts.update((list) => [newAlert, ...list].slice(0, 5));
      }
      this.refreshStatsFromApi();
    });
  }

  private refreshStatsFromApi(): void {
    this.statsService.getDashboardStats().subscribe({
      next: (res) => this.stats.set(res),
    });
  }

  private patchMemberStatus(userId: number, newStatus: string): void {
    this.activeMembers.update((list) =>
      list.map((m) => m.id === userId
        ? { ...m, status: newStatus as HrTeamMember['status'] }
        : m,
      ),
    );
  }

  private patchMemberHours(userId: number, event: SessionStatusEvent): void {
    const member = this.activeMembers().find((m) => m.id === userId);
    if (!member) return;

    const start = new Date(event.clockIn).getTime();
    const end = event.clockOut ? new Date(event.clockOut).getTime() : Date.now();
    const breakMin = event.totalBreakMinutes || 0;
    const workedMin = Math.max(0, (end - start) / 60000 - breakMin);
    const hoursToday = Math.round((workedMin / 60) * 10) / 10;

    this.activeMembers.update((list) =>
      list.map((m) => m.id === userId ? { ...m, hoursToday } : m),
    );
  }

  private loadAll(): void {
    this.loadStats();
    this.loadMembers();
    this.loadPendingOvertime();
    this.loadAlerts();
    this.loadEmployeeStats();
  }

  private loadStats(): void {
    this.statsService.getDashboardStats().subscribe({
      next: (res) => {
        this.stats.set(res);
        this.statsLoading.set(false);
      },
      error: () => this.statsLoading.set(false),
    });
  }

  private loadMembers(): void {
    this.teamsService.getAllMembers().subscribe({
      next: (res) => {
        this.activeMembers.set(res.members.slice(0, 8));
        this.membersLoading.set(false);
      },
      error: () => this.membersLoading.set(false),
    });
  }

  private loadPendingOvertime(): void {
    this.overtimeService.getPendingDeclarations().subscribe({
      next: (res) => {
        this.pendingOvertime.set(res.declarations);
        this.overtimeLoading.set(false);
      },
      error: () => this.overtimeLoading.set(false),
    });
  }

  private loadAlerts(): void {
    this.alertsService.getAllAlerts({ period: 'today', limit: 5 }).subscribe({
      next: (res) => {
        this.recentAlerts.set(res.alerts);
        this.alertsLoading.set(false);
      },
      error: () => this.alertsLoading.set(false),
    });
  }

  private loadEmployeeStats(): void {
    this.settingsService.getAllEmployeeStats().subscribe({
      next: (res: { employees: HrEmployeeStats[] }) => {
        this.employeeStatsList.set(res.employees);
        this.employeeStatsLoading.set(false);
      },
      error: () => this.employeeStatsLoading.set(false),
    });
  }

  handleApprove(id: number): void {
    this.overtimeService.approve(id).subscribe({
      next: () => this.loadAll(),
    });
  }

  handleReject(id: number): void {
    this.overtimeService.reject(id).subscribe({
      next: () => this.loadAll(),
    });
  }
}
