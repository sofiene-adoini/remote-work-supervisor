import { Component, inject, OnInit, OnDestroy, signal, computed, DestroyRef } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe, DecimalPipe, TitleCasePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  LucideFolderOpen, LucideChartBar, LucideBell, LucideArrowRight,
  LucideClock, LucideAlertTriangle, LucideCheckCircle, LucideSend,
} from '@lucide/angular';
import { TodaysStatusComponent } from '../components/todays-status.component';
import { TimeEntriesService } from '../services/time-entries.service';
import { AlertsService } from '../services/alerts.service';
import { OvertimeService } from '../services/overtime.service';
import { ProjectsService } from '../services/projects.service';
import { Alert, DailyStats, WeeklyStats, OvertimeDeclaration } from '../models/employee.models';
import { RealtimeService, AlertCreatedEvent, SessionUpdatedEvent, OvertimeDetectedEvent } from '../../../core/services/realtime.service';

@Component({
  selector: 'app-employee-dashboard',
  imports: [
    RouterLink, DatePipe, DecimalPipe, TitleCasePipe,
    LucideFolderOpen, LucideChartBar, LucideBell, LucideArrowRight,
    LucideClock, LucideAlertTriangle, LucideCheckCircle,
    TodaysStatusComponent,
  ],
  template: `
    <div class="dashboard-grid">
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

      <!-- Policy-Aware Daily Progress -->
      @if (dailyStats()) {
        <div class="card grid-full">
          <div class="card-header">
            <h2 class="card-title">Today's Progress</h2>
            <span class="attendance-badge" [class]="'att-' + dailyStats()!.attendanceStatus">
              {{ dailyStats()!.attendanceStatus | titlecase }}
            </span>
          </div>
          <div class="card-body">
            <div class="progress-grid">
              <div class="progress-stat">
                <span class="progress-label">Expected</span>
                <span class="progress-value">{{ dailyStats()!.expectedMinutes / 60 | number:'1.1-1' }}h</span>
              </div>
              <div class="progress-stat">
                <span class="progress-label">Worked</span>
                <span class="progress-value accent">{{ dailyStats()!.workedMinutes / 60 | number:'1.1-1' }}h</span>
              </div>
              <div class="progress-stat">
                <span class="progress-label">Break</span>
                <span class="progress-value">{{ dailyStats()!.breakMinutes }}m</span>
              </div>
              @if (dailyStats()!.overtimeMinutes > 0) {
                <div class="progress-stat">
                  <span class="progress-label">Overtime</span>
                  <span class="progress-value ot">{{ dailyStats()!.overtimeMinutes / 60 | number:'1.1-1' }}h</span>
                </div>
              }
              @if (dailyStats()!.missingMinutes > 0) {
                <div class="progress-stat">
                  <span class="progress-label">Missing</span>
                  <span class="progress-value missing">{{ dailyStats()!.missingMinutes / 60 | number:'1.1-1' }}h</span>
                </div>
              }
            </div>
            <div class="progress-bar-wrap">
              <div class="progress-bar-track">
                <div class="progress-bar-fill" [style.width.%]="dailyProgressPercent()"></div>
                @if (dailyStats()!.expectedMinutes > 0) {
                  <div class="progress-bar-target" [style.left.%]="100"></div>
                }
              </div>
              <span class="progress-bar-label">{{ dailyProgressPercent() | number:'1.0-0' }}%</span>
            </div>
          </div>
        </div>
      }

      <!-- This Week -->
      <div class="card grid-half">
        <div class="card-header">
          <h2 class="card-title">This Week</h2>
          @if (!weeklyLoading()) {
            <span class="card-meta">{{ totalWeekHours() }}h / {{ weeklyStats()?.expectedHours ?? 40 }}h</span>
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
            @if (weeklyStats()) {
              <div class="week-summary">
                <span class="week-stat">
                  <svg lucideClock class="icon-xs"></svg>
                  {{ weeklyStats()!.attendanceRate }}% attendance
                </span>
                <span class="week-stat">
                  <svg lucideCheckCircle class="icon-xs"></svg>
                  {{ weeklyStats()!.completionRate }}% completion
                </span>
              </div>
            }
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

      <!-- Today's Overtime -->
      @if (detectedOvertime()) {
        <div class="card grid-full overtime-card">
          <div class="card-header">
            <h2 class="card-title">Today's Overtime</h2>
            <span class="ot-badge" [class]="'ot-' + detectedOvertime()!.status">
              {{ overtimeStatusLabel(detectedOvertime()!.status) }}
            </span>
          </div>
          <div class="card-body">
            <div class="ot-stats-row">
              <div class="ot-stat">
                <span class="ot-stat-label">Worked</span>
                <span class="ot-stat-value">{{ (detectedOvertime()!.workedMinutes / 60) | number:'1.1-1' }}h</span>
              </div>
              <div class="ot-stat">
                <span class="ot-stat-label">Expected</span>
                <span class="ot-stat-value">{{ (detectedOvertime()!.expectedMinutes / 60) | number:'1.1-1' }}h</span>
              </div>
              <div class="ot-stat">
                <span class="ot-stat-label">Detected OT</span>
                <span class="ot-stat-value accent">{{ (detectedOvertime()!.overtimeMinutes / 60) | number:'1.1-1' }}h</span>
              </div>
            </div>
            @if (detectedOvertime()!.status === 'detected') {
              <div class="ot-action-row">
                <a class="btn btn-primary btn-sm" routerLink="/employee/overtime">
                  <svg lucideSend class="icon-xs"></svg>
                  Complete Overtime Declaration
                </a>
              </div>
            }
            @if (detectedOvertime()!.status === 'submitted') {
              <p class="ot-pending-note">Awaiting HR review</p>
            }
            @if (detectedOvertime()!.status === 'approved') {
              <p class="ot-approved-note">Approved by {{ detectedOvertime()!.reviewer?.fullName || 'HR' }}</p>
            }
            @if (detectedOvertime()!.status === 'rejected') {
              <p class="ot-rejected-note">Rejected</p>
            }
          </div>
        </div>
      }

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
            <span class="action-sub">{{ detectedOvertime() ? 'View details' : 'Manage' }}</span>
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
      font-family: var(--rws-font-mono);
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

    /* ── Attendance Badge ───────────────────────────────────── */
    .attendance-badge {
      padding: 0.25rem 0.75rem;
      border-radius: 999px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: capitalize;

      &.att-completed { background: #e8f8f6; color: #167d72; }
      &.att-overtime { background: #fef3e2; color: #92610a; }
      &.att-underworked { background: #fde8e8; color: #d64545; }
      &.att-absent { background: #f3f4f6; color: #6b7280; }
      &.att-day_off { background: #e8f1fb; color: #2b3a67; }
    }

    /* ── Progress Grid ──────────────────────────────────────── */
    .progress-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
      gap: 1rem;
      margin-bottom: 1.25rem;
    }

    .progress-stat {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .progress-label {
      font-size: 0.75rem;
      color: var(--rws-text-muted);
      font-weight: 500;
    }

    .progress-value {
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--rws-text);
      font-family: var(--rws-font-mono);

      &.accent { color: var(--rws-accent); }
      &.ot { color: #d9973b; }
      &.missing { color: #d64545; }
    }

    .progress-bar-wrap {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .progress-bar-track {
      flex: 1;
      height: 8px;
      border-radius: 4px;
      background: var(--rws-bg);
      overflow: hidden;
      position: relative;
    }

    .progress-bar-fill {
      height: 100%;
      border-radius: 4px;
      background: linear-gradient(90deg, var(--rws-primary), var(--rws-accent));
      transition: width 400ms ease;
    }

    .progress-bar-target {
      position: absolute;
      top: -2px;
      bottom: -2px;
      width: 2px;
      background: var(--rws-text-muted);
      border-radius: 1px;
      transform: translateX(-1px);
    }

    .progress-bar-label {
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--rws-accent);
      font-family: var(--rws-font-mono);
      min-width: 40px;
      text-align: right;
    }

    /* ── Week bars ────────────────────────────────────────────── */
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

    .week-summary {
      display: flex;
      gap: 1.25rem;
      margin-top: 0.75rem;
      padding-top: 0.75rem;
      border-top: 1px solid var(--rws-border);
    }

    .week-stat {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      font-size: 0.8125rem;
      color: var(--rws-text-muted);
      font-weight: 500;
    }

    /* ── Alert List ────────────────────────────────────────── */
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
      &.dot-error, &.dot-critical { background: #d64545; }
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

    /* ── Overtime Card ─────────────────────────────────────────── */
    .overtime-card { border-left: 3px solid #d9973b; }

    .ot-badge {
      padding: 0.25rem 0.625rem;
      border-radius: 999px;
      font-size: 0.75rem;
      font-weight: 600;

      &.ot-detected { background: #fef3e2; color: #92610a; }
      &.ot-submitted { background: #e8f1fb; color: #2b3a67; }
      &.ot-approved { background: #e8f8f6; color: #167d72; }
      &.ot-rejected { background: #fde8e8; color: #b91c1c; }
      &.ot-cancelled { background: #f3f4f6; color: #6b7280; }
    }

    .ot-stats-row {
      display: flex;
      gap: 1.5rem;
      margin-bottom: 1rem;
    }

    .ot-stat {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .ot-stat-label {
      font-size: 0.75rem;
      color: var(--rws-text-muted);
      font-weight: 500;
    }

    .ot-stat-value {
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--rws-text);
      font-family: var(--rws-font-mono);

      &.accent { color: #d9973b; }
    }

    .ot-action-row { margin-bottom: 0.5rem; }

    .ot-pending-note {
      margin: 0;
      font-size: 0.8125rem;
      color: #2b3a67;
      font-weight: 500;
    }

    .ot-approved-note {
      margin: 0;
      font-size: 0.8125rem;
      color: #167d72;
      font-weight: 500;
    }

    .ot-rejected-note {
      margin: 0;
      font-size: 0.8125rem;
      color: #d64545;
      font-weight: 500;
    }

    /* ── Quick actions ────────────────────────────────────────── */
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
      .progress-grid { grid-template-columns: 1fr 1fr; }
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
  private readonly overtimeService = inject(OvertimeService);
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

  protected readonly dailyStats = signal<DailyStats | null>(null);
  protected readonly weeklyStats = signal<WeeklyStats | null>(null);

  protected readonly weeklyHours = signal<Record<string, number>>({});
  protected readonly weeklyDays = signal<string[]>(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  protected readonly weeklyLoading = signal(true);
  protected readonly recentAlerts = signal<Alert[]>([]);
  protected readonly alertsLoading = signal(true);
  protected readonly detectedOvertime = signal<OvertimeDeclaration | null>(null);
  protected readonly projectCount = signal(0);
  protected readonly projectsLoading = signal(true);

  protected readonly totalWeekHours = computed(() => {
    const hours = this.weeklyHours();
    return Object.values(hours).reduce((sum, h) => sum + h, 0).toFixed(1);
  });

  protected readonly dailyProgressPercent = computed(() => {
    const stats = this.dailyStats();
    if (!stats || stats.expectedMinutes === 0) return 0;
    return Math.min(100, Math.round((stats.workedMinutes / stats.expectedMinutes) * 100));
  });

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
    this.loadTodayOvertime();
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
      if (event.dailyStats) this.dailyStats.set(event.dailyStats);
      if (event.weeklyStats) this.weeklyStats.set(event.weeklyStats);
      this.statusLoading.set(false);
      this.loadWeeklyHours();
    });

    this.realtime.alertCreated$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((event: AlertCreatedEvent) => {
      const alertDate = new Date(event.createdAt);
      const today = new Date();
      const isToday = alertDate.getFullYear() === today.getFullYear()
        && alertDate.getMonth() === today.getMonth()
        && alertDate.getDate() === today.getDate();

      if (!isToday) return;

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

    this.realtime.overtimeDetected$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((event: OvertimeDetectedEvent) => {
      this.loadTodayOvertime();
    });

    this.realtime.overtimeChanged$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.loadTodayOvertime();
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
        if (res.dailyStats) this.dailyStats.set(res.dailyStats);
        if (res.weeklyStats) this.weeklyStats.set(res.weeklyStats);
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
    this.alertsService.getMyAlerts({ period: 'today', limit: 5 }).subscribe({
      next: (res) => {
        this.recentAlerts.set(res.alerts);
        this.alertsLoading.set(false);
      },
      error: () => this.alertsLoading.set(false),
    });
  }

  private loadTodayOvertime(): void {
    this.overtimeService.getMyDeclarations().subscribe({
      next: (res) => {
        const today = new Date().toISOString().slice(0, 10);
        const todayOt = res.declarations.find((d) => d.date === today && d.status !== 'cancelled');
        this.detectedOvertime.set(todayOt || null);
      },
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

  protected overtimeStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      detected: 'Pending',
      submitted: 'Pending Review',
      approved: 'Approved',
      rejected: 'Rejected',
      cancelled: 'Cancelled',
    };
    return labels[status] || status;
  }
}
