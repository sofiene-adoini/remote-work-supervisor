import { Component, inject, OnInit, OnDestroy, signal, DestroyRef } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LucideFolderOpen, LucideChartBar, LucideBell, LucideArrowRight } from '@lucide/angular';
import { TodaysStatusComponent } from '../components/todays-status.component';
import { TimeEntriesService } from '../services/time-entries.service';
import { AlertsService } from '../services/alerts.service';
import { ProjectsService } from '../services/projects.service';
import { Alert } from '../models/employee.models';
import { RealtimeService, AlertCreatedEvent, SessionUpdatedEvent } from '../../../core/services/realtime.service';

@Component({
  selector: 'app-employee-dashboard',
  imports: [RouterLink, DatePipe, LucideFolderOpen, LucideChartBar, LucideBell, LucideArrowRight, TodaysStatusComponent],
  template: `
    <div class="dashboard-grid">
      <!-- Desktop Agent Status (full-width, read-only) -->
      @if (statusLoading()) {
        <div class="grid-full">
          <div class="sk-status-card">
            <div class="sk-status-header">
              <div class="sk sk-title"></div>
              <div class="sk" style="width: 80px; height: 28px; border-radius: 999px;"></div>
            </div>
            <div class="sk-status-body">
              <div class="sk-grid">
                @for (i of [1,2,3,4,5,6]; track i) {
                  <div class="sk-item">
                    <div class="sk sk-text-sm"></div>
                    <div class="sk sk-num"></div>
                  </div>
                }
              </div>
            </div>
          </div>
        </div>
      } @else {
        <app-todays-status
          class="grid-full"
          [status]="currentStatus()"
          [agentOnline]="agentOnline()"
          [clockIn]="currentClockIn()"
          [workedTodayMinutes]="workedTodayMinutes()"
          [totalBreakMinutes]="totalBreakMinutes()"
          [weeklyMinutes]="weeklyMinutes()"
          [currentProject]="currentProject()"
          [breakStartedAt]="breakStartedAt()"
        />
      }

      <!-- This Week -->
      <div class="card grid-half">
        <div class="card-header">
          <h2 class="card-title">This Week</h2>
          @if (!weeklyLoading()) {
            <span class="card-meta">{{ totalWeekHours() }}h total</span>
          }
        </div>
        <div class="card-body">
          @if (weeklyLoading()) {
            <div class="sk-week-bars">
              @for (i of [1,2,3,4,5]; track i) {
                <div class="sk-week-row">
                  <div class="sk sk-text-sm"></div>
                  <div class="sk" style="height: 8px; border-radius: 4px;"></div>
                  <div class="sk sk-num" style="width: 32px; height: 14px;"></div>
                </div>
              }
            </div>
          } @else {
            <div class="week-bars">
              @for (day of weeklyDays(); track day) {
                <div class="bar-row" [class.today]="isToday(day)">
                  <span class="bar-label">{{ day }}</span>
                  <div class="bar-track">
                    <div class="bar-fill" [style.width.%]="barWidth(day)"></div>
                  </div>
                  <span class="bar-value">{{ weeklyHours()[day] ?? 0 }}h</span>
                </div>
              }
            </div>
          }
        </div>
      </div>

      <!-- Recent Alerts -->
      <div class="card grid-half">
        <div class="card-header">
          <h2 class="card-title">Recent Activity</h2>
          @if (!alertsLoading() && recentAlerts().length > 0) {
            <a class="link-btn" routerLink="/employee/alerts">View all</a>
          }
        </div>
        <div class="card-body">
          @if (alertsLoading()) {
            <div class="sk-list">
              @for (i of [1,2,3]; track i) {
                <div class="sk sk-row"></div>
              }
            </div>
          } @else if (recentAlerts().length === 0) {
            <div class="alert-list-empty">
              <svg lucideBell class="alert-empty-icon" aria-hidden="true"></svg>
              <p class="alert-empty-text">No recent alerts</p>
              <p class="alert-empty-sub">You're all clear!</p>
            </div>
          } @else {
            <div class="alert-list">
              @for (alert of recentAlerts(); track alert.id) {
                <div class="alert-row" [class.unread]="!alert.isRead">
                  <div class="alert-dot" [class]="'dot-' + alert.severity"></div>
                  <div class="alert-content">
                    <p class="alert-message">{{ alert.message }}</p>
                    <span class="alert-time">{{ alert.createdAt | date:'short' }}</span>
                  </div>
                </div>
              }
            </div>
          }
        </div>
      </div>

      <!-- Quick Actions Row -->
      <div class="card grid-full actions-row">
        <h2 class="card-title">Quick Actions</h2>
        <div class="action-cards">
          <a class="action-card" routerLink="/employee/projects">
            <svg lucideFolderOpen class="action-icon" aria-hidden="true"></svg>
            <span class="action-label">My Projects</span>
            @if (projectsLoading()) {
              <div class="sk sk-num" style="width: 56px; height: 12px;"></div>
            } @else {
              <span class="action-sub">{{ projectCount() }} assigned</span>
            }
            <svg lucideArrowRight class="action-arrow" aria-hidden="true"></svg>
          </a>
          <a class="action-card" routerLink="/employee/overtime">
            <svg lucideChartBar class="action-icon" aria-hidden="true"></svg>
            <span class="action-label">Overtime</span>
            <span class="action-sub">Declare hours</span>
            <svg lucideArrowRight class="action-arrow" aria-hidden="true"></svg>
          </a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    @use 'styles/design-tokens' as t;

    .dashboard-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.25rem;
    }

    .grid-full { grid-column: 1 / -1; }
    .grid-half { grid-column: span 1; }

    .card {
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
      padding: 1.5rem;
    }

    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1rem;
    }

    .card-title {
      margin: 0;
      font-size: 1.0625rem;
      font-weight: 600;
      color: var(--rws-text);
    }

    .card-meta {
      font-size: 0.8125rem;
      color: var(--rws-text-muted);
      font-weight: 500;
    }

    .link-btn {
      background: none;
      border: none;
      color: var(--rws-accent-strong);
      font-size: 0.8125rem;
      font-weight: 600;
      cursor: pointer;
      padding: 0;
      font-family: inherit;
      text-decoration: none;

      &:hover { text-decoration: underline; }
      &:focus-visible { outline: 3px solid var(--rws-focus-ring); outline-offset: 2px; border-radius: 4px; }
    }

    // ── Week bars ──────────────────────────────────────────────
    .week-bars { display: flex; flex-direction: column; gap: 0.5rem; }

    .bar-row {
      display: grid;
      grid-template-columns: 36px 1fr 40px;
      align-items: center;
      gap: 0.625rem;

      &.today .bar-label { font-weight: 700; color: var(--rws-primary); }
      &.today .bar-fill { background: var(--rws-accent); }
    }

    .bar-label {
      font-size: 0.8125rem;
      color: var(--rws-text-muted);
      font-weight: 500;
    }

    .bar-track {
      height: 8px;
      border-radius: 4px;
      background: var(--rws-bg);
      overflow: hidden;
    }

    .bar-fill {
      height: 100%;
      border-radius: 4px;
      background: var(--rws-primary);
      transition: width 400ms ease;
      min-width: 0;
    }

    .bar-value {
      font-size: 0.8125rem;
      color: var(--rws-text-muted);
      text-align: right;
      font-family: var(--rws-font-mono);
      font-weight: 500;
    }

    .alert-list-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 120px;
      text-align: center;
    }

    .alert-empty-icon { width: 32px; height: 32px; color: var(--rws-text-muted); opacity: 0.4; margin-bottom: 0.75rem; }
    .alert-empty-text { margin: 0 0 0.25rem; font-size: 0.9375rem; font-weight: 500; color: var(--rws-text); }
    .alert-empty-sub { margin: 0; font-size: 0.8125rem; color: var(--rws-text-muted); }

    .alert-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .alert-row {
      display: flex;
      align-items: flex-start;
      gap: 0.625rem;
      padding: 0.5rem 0;
      border-bottom: 1px solid var(--rws-border);

      &:last-child { border-bottom: none; }
      &.unread .alert-message { font-weight: 600; }
    }

    .alert-dot {
      width: 6px;
      height: 6px;
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
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .alert-time {
      font-size: 0.6875rem;
      color: var(--rws-text-muted);
    }

    // ── Quick actions ──────────────────────────────────────────
    .actions-row {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .action-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
    }

    .action-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      padding: 1.25rem;
      border-radius: var(--rws-radius);
      border: 1px solid var(--rws-border);
      background: var(--rws-bg);
      cursor: pointer;
      transition: border-color 150ms ease, box-shadow 150ms ease, transform 150ms ease;
      text-decoration: none;
      position: relative;
      will-change: transform;

      &:hover {
        border-color: var(--rws-accent);
        box-shadow: 0 0 0 1px var(--rws-accent);
        transform: translateY(-1px);
      }
    }

    .action-icon { width: 24px; height: 24px; color: var(--rws-accent); }
    .action-label { font-size: 0.9rem; font-weight: 600; color: var(--rws-text); }
    .action-sub { font-size: 0.8rem; color: var(--rws-text-muted); }

    .action-arrow {
      width: 16px;
      height: 16px;
      color: var(--rws-text-muted);
      position: absolute;
      top: 0.75rem;
      right: 0.75rem;
    }

    @media (max-width: 767px) {
      .dashboard-grid { grid-template-columns: 1fr; }
      .grid-half { grid-column: span 1; }
    }

    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        transition-duration: 0.01ms !important;
        transform: none !important;
        will-change: auto !important;
      }
    }
  `],
})
export class EmployeeDashboardComponent implements OnInit, OnDestroy {
  private readonly timeService = inject(TimeEntriesService);
  private readonly alertsService = inject(AlertsService);
  private readonly projectsService = inject(ProjectsService);
  private readonly realtime = inject(RealtimeService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly currentStatus = signal<'clocked_out' | 'active' | 'break'>('clocked_out');
  protected readonly agentOnline = signal(false);
  protected readonly currentClockIn = signal<string | null>(null);
  protected readonly workedTodayMinutes = signal(0);
  protected readonly totalBreakMinutes = signal(0);
  protected readonly weeklyMinutes = signal(0);
  protected readonly currentProject = signal<{ id: number; name: string } | null>(null);
  protected readonly breakStartedAt = signal<string | null>(null);
  protected readonly statusLoading = signal(true);

  protected readonly weeklyHours = signal<Record<string, number>>({});
  protected readonly weeklyDays = signal<string[]>(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  protected readonly weeklyLoading = signal(true);
  protected readonly recentAlerts = signal<Alert[]>([]);
  protected readonly alertsLoading = signal(true);
  protected readonly projectCount = signal(0);
  protected readonly projectsLoading = signal(true);

  protected readonly totalWeekHours = () => {
    const hours = this.weeklyHours();
    return Object.values(hours).reduce((sum, h) => sum + h, 0).toFixed(1);
  };

  protected readonly barWidth = (day: string) => {
    const hours = this.weeklyHours();
    const maxHours = Math.max(8, ...Object.values(hours));
    return ((hours[day] ?? 0) / maxHours) * 100;
  };

  protected readonly isToday = (day: string) => {
    const today = new Date().getDay();
    const dayIdx = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(day) + 1;
    return today === dayIdx || (today === 0 && day === 'Sun');
  };

  ngOnInit(): void {
    this.loadInitialStatus();
    this.loadWeeklyHours();
    this.loadRecentAlerts();
    this.loadProjectCount();
    this.subscribeToRealtime();
  }

  ngOnDestroy(): void {}

  private subscribeToRealtime(): void {
    this.realtime.sessionUpdated$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((event: SessionUpdatedEvent) => {
      this.currentStatus.set(event.status);
      this.agentOnline.set(event.agentOnline);
      this.currentClockIn.set(event.clockIn);
      this.workedTodayMinutes.set(event.workedTodayMinutes);
      this.totalBreakMinutes.set(event.totalBreakMinutes);
      this.weeklyMinutes.set(event.weeklyMinutes);
      this.currentProject.set(event.currentProject);
      this.breakStartedAt.set(event.breakStartedAt);
      this.statusLoading.set(false);
      this.loadWeeklyHours();
    });

    this.realtime.alertCreated$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((event: AlertCreatedEvent) => {
      const newAlert: Alert = {
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

      this.recentAlerts.update((list) => [newAlert, ...list].slice(0, 5));
    });
  }

  private loadInitialStatus(): void {
    this.timeService.getStatus().subscribe({
      next: (res) => {
        this.currentStatus.set(res.status);
        this.agentOnline.set(res.agentOnline);
        this.currentClockIn.set(res.clockIn);
        this.workedTodayMinutes.set(res.workedTodayMinutes);
        this.totalBreakMinutes.set(res.totalBreakMinutes);
        this.weeklyMinutes.set(res.weeklyMinutes);
        this.currentProject.set(res.currentProject);
        this.breakStartedAt.set(res.breakStartedAt);
        this.statusLoading.set(false);
      },
      error: () => {
        this.currentStatus.set('clocked_out');
        this.statusLoading.set(false);
      },
    });
  }

  private loadWeeklyHours(): void {
    this.weeklyLoading.set(true);
    this.timeService.getWeeklyHours().subscribe({
      next: (res) => {
        this.weeklyHours.set(res.hoursByDay);
        this.weeklyDays.set(res.days);
        this.weeklyLoading.set(false);
      },
      error: () => this.weeklyLoading.set(false),
    });
  }

  private loadRecentAlerts(): void {
    this.alertsService.getMyAlerts(5).subscribe({
      next: (res) => {
        this.recentAlerts.set(res.alerts);
        this.alertsLoading.set(false);
      },
      error: () => this.alertsLoading.set(false),
    });
  }

  private loadProjectCount(): void {
    this.projectsLoading.set(true);
    this.projectsService.getMyProjects().subscribe({
      next: (res) => {
        this.projectCount.set(res.projects.length);
        this.projectsLoading.set(false);
      },
      error: () => this.projectsLoading.set(false),
    });
  }
}
