import { Component, inject, OnInit, OnDestroy, signal, computed, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LucideClock, LucideBarChart3 } from '@lucide/angular';
import { TimeEntriesService } from '../services/time-entries.service';
import { AlertsService } from '../services/alerts.service';
import { RealtimeService, SessionUpdatedEvent } from '../../../core/services/realtime.service';
import {
  SessionWithWorked, DailyStats, WeeklyStats, MonthlyStats,
  CompanyWorkPolicy, FilterState, FilterPreset, DayDetail,
} from '../models/employee.models';
import { TimeFilterBarComponent } from '../components/time/time-filter-bar.component';
import { TimeOverviewComponent } from '../components/time/time-overview.component';
import { TimeTimelineComponent } from '../components/time/time-timeline.component';
import { TimeWeeklyComponent } from '../components/time/time-weekly.component';
import { TimeMonthlyComponent } from '../components/time/time-monthly.component';
import { TimeHistoryComponent } from '../components/time/time-history.component';
import { TimeAnalyticsComponent } from '../components/time/time-analytics.component';

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfWeek(d: Date): Date {
  const r = new Date(d);
  r.setDate(r.getDate() - ((r.getDay() + 6) % 7));
  r.setHours(0, 0, 0, 0);
  return r;
}

function endOfWeek(d: Date): Date {
  const r = startOfWeek(d);
  r.setDate(r.getDate() + 6);
  r.setHours(23, 59, 59, 999);
  return r;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

function presetToRange(preset: FilterPreset, customStart?: string, customEnd?: string): { start: string; end: string; label: string } {
  const today = new Date();
  const fmtD = (d: Date) => fmt(d);

  switch (preset) {
    case 'today': {
      const s = new Date(today); s.setHours(0, 0, 0, 0);
      return { start: fmtD(s), end: fmtD(s), label: 'Today' };
    }
    case 'yesterday': {
      const s = new Date(today); s.setDate(s.getDate() - 1); s.setHours(0, 0, 0, 0);
      return { start: fmtD(s), end: fmtD(s), label: 'Yesterday' };
    }
    case 'last-7-days': {
      const s = new Date(today); s.setDate(s.getDate() - 6); s.setHours(0, 0, 0, 0);
      return { start: fmtD(s), end: fmtD(today), label: 'Last 7 Days' };
    }
    case 'last-14-days': {
      const s = new Date(today); s.setDate(s.getDate() - 13); s.setHours(0, 0, 0, 0);
      return { start: fmtD(s), end: fmtD(today), label: 'Last 14 Days' };
    }
    case 'last-30-days': {
      const s = new Date(today); s.setDate(s.getDate() - 29); s.setHours(0, 0, 0, 0);
      return { start: fmtD(s), end: fmtD(today), label: 'Last 30 Days' };
    }
    case 'this-week': {
      const s = startOfWeek(today);
      return { start: fmtD(s), end: fmtD(today), label: 'This Week' };
    }
    case 'previous-week': {
      const s = new Date(today); s.setDate(s.getDate() - 7);
      return { start: fmtD(startOfWeek(s)), end: fmtD(endOfWeek(s)), label: 'Previous Week' };
    }
    case 'this-month': {
      const s = startOfMonth(today);
      return { start: fmtD(s), end: fmtD(today), label: 'This Month' };
    }
    case 'previous-month': {
      const d = new Date(today); d.setMonth(d.getMonth() - 1);
      return { start: fmtD(startOfMonth(d)), end: fmtD(endOfMonth(d)), label: 'Previous Month' };
    }
    case 'custom': {
      const s = customStart || fmtD(today);
      const e = customEnd || fmtD(today);
      return { start: s, end: e, label: `${s} — ${e}` };
    }
  }
}

@Component({
  selector: 'app-employee-time',
  imports: [
    LucideClock, LucideBarChart3,
    TimeFilterBarComponent, TimeOverviewComponent, TimeTimelineComponent,
    TimeWeeklyComponent, TimeMonthlyComponent, TimeHistoryComponent,
    TimeAnalyticsComponent,
  ],
  template: `
    <div class="page">
      <div class="page-header">
        <div class="header-left">
          <svg lucideBarChart3 class="header-icon" aria-hidden="true"></svg>
          <h1 class="page-title">My Time</h1>
        </div>
        <span class="page-meta">
          <svg lucideClock class="icon-xs" aria-hidden="true"></svg>
          {{ filterState().label }}
        </span>
      </div>

      <app-time-overview
        [dailyStats]="dailyStats()"
        [weeklyStats]="weeklyStats()"
        [monthlyStats]="monthlyStats()"
        [status]="currentStatus()"
        [agentOnline]="agentOnline()"
        [policy]="policy()"
        [loading]="loading()"
      />

      @if (currentStatus() !== 'clocked_out') {
        <app-time-timeline
          [sessions]="todaySessions()"
          [loading]="loading()"
        />
      }

      <app-time-filter-bar
        [activePreset]="filterState().preset"
        [loading]="loading()"
        (presetChange)="onPresetChange($event)"
      />

      <div class="dual-row">
        <div class="dual-col">
          <app-time-weekly
            [weekDays]="weekDays()"
            [weeklyStats]="weeklyStats()"
            [loading]="loading()"
          />
        </div>
        <div class="dual-col">
          <app-time-monthly
            [monthlyStats]="monthlyStats()"
            [dailySessions]="rangeSessions()"
            [policy]="policy()"
            [loading]="loading()"
          />
        </div>
      </div>

      <app-time-history
        [sessions]="rangeSessions()"
        [loading]="loading()"
        [policy]="policy()"
        [sessionAlerts]="sessionAlerts()"
      />

      <app-time-analytics
        [dailyStats]="dailyStats()"
        [weeklyStats]="weeklyStats()"
        [monthlyStats]="monthlyStats()"
        [dailyHistory]="dailyHistory()"
        [attendanceEvaluation]="attendanceEvaluation()"
        [loading]="loading()"
      />
    </div>
  `,
  styles: [`
    @use 'styles/design-tokens' as t;

    .page {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
      max-width: 1400px;
      margin: 0 auto;
    }

    .page-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 0.625rem;
    }

    .header-icon {
      width: 28px;
      height: 28px;
      color: var(--rws-accent);
    }

    .page-title {
      margin: 0;
      font-size: 1.625rem;
      font-weight: 700;
      color: var(--rws-primary);
      letter-spacing: -0.02em;
    }

    .page-meta {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      font-size: 0.8125rem;
      color: var(--rws-text-muted);
      font-weight: 500;
      padding: 0.375rem 0.75rem;
      background: var(--rws-bg);
      border-radius: 999px;
      border: 1px solid var(--rws-border);
    }

    .icon-xs {
      width: 14px;
      height: 14px;
    }

    .section-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.25rem;
    }

    .col-wide { min-width: 0; }
    .col-narrow { min-width: 0; }

    .dual-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.25rem;
    }

    .dual-col { min-width: 0; }

    @media (max-width: 1024px) {
      .section-row,
      .dual-row {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 640px) {
      .page-header {
        flex-direction: column;
        align-items: flex-start;
      }

      .page-title { font-size: 1.375rem; }
    }

    @media (prefers-reduced-motion: reduce) {
      * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
    }
  `],
})
export class EmployeeTimeComponent implements OnInit, OnDestroy {
  private readonly timeService = inject(TimeEntriesService);
  private readonly alertsService = inject(AlertsService);
  private readonly realtime = inject(RealtimeService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);

  readonly filterState = signal<FilterState>({
    preset: 'this-week',
    ...presetToRange('this-week'),
  });

  readonly currentStatus = signal<'clocked_out' | 'active' | 'break'>('clocked_out');
  readonly agentOnline = signal(false);
  readonly dailyStats = signal<DailyStats | null>(null);
  readonly weeklyStats = signal<WeeklyStats | null>(null);
  readonly monthlyStats = signal<MonthlyStats | null>(null);
  readonly policy = signal<CompanyWorkPolicy | null>(null);
  readonly attendanceEvaluation = signal('');

  readonly rangeSessions = signal<SessionWithWorked[]>([]);
  readonly todaySessions = signal<SessionWithWorked[]>([]);
  readonly sessionAlerts = signal<Map<number, boolean>>(new Map());

  readonly weekDays = computed<DayDetail[]>(() => {
    const filter = this.filterState();
    const start = new Date(filter.start);
    start.setHours(0, 0, 0, 0);
    const days: DayDetail[] = [];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const fullDayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const dateStr = fmt(d);
      const daySessions = this.rangeSessions().filter(s => s.clockIn.slice(0, 10) === dateStr);
      const totalWorked = daySessions.reduce((sum, s) => sum + s.workedMinutes, 0);
      const totalBreak = daySessions.reduce((sum, s) => sum + (s.totalBreakMinutes || 0), 0);
      const expected = 8 * 60;
      const overtime = Math.max(0, totalWorked - expected);
      const missing = Math.max(0, expected - totalWorked);

      let attendanceStatus: DailyStats['attendanceStatus'] = 'absent';
      if (totalWorked >= expected) attendanceStatus = overtime > 0 ? 'overtime' : 'completed';
      else if (totalWorked > 0) attendanceStatus = 'underworked';
      else if (d.getDay() === 0 || d.getDay() === 6) attendanceStatus = 'day_off';

      days.push({
        date: dateStr,
        label: `${fullDayNames[d.getDay()]}, ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
        dayShort: dayNames[d.getDay()],
        sessions: daySessions,
        totalWorkedMinutes: totalWorked,
        totalBreakMinutes: totalBreak,
        expectedMinutes: expected,
        overtimeMinutes: overtime,
        missingMinutes: missing,
        attendanceStatus,
      });
    }
    return days;
  });

  readonly dailyHistory = computed(() => {
    const sessions = this.rangeSessions();
    const byDate = new Map<string, { workedMinutes: number; breakMinutes: number }>();
    for (const s of sessions) {
      const date = s.clockIn.slice(0, 10);
      const existing = byDate.get(date) || { workedMinutes: 0, breakMinutes: 0 };
      existing.workedMinutes += s.workedMinutes;
      existing.breakMinutes += s.totalBreakMinutes || 0;
      byDate.set(date, existing);
    }
    return Array.from(byDate.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-14)
      .map(([date, data]) => ({ date, ...data }));
  });

  ngOnInit(): void {
    this.loadPolicy();
    this.loadAllData();
    this.subscribeToRealtime();
  }

  ngOnDestroy(): void {}

  onPresetChange(preset: string): void {
    const range = presetToRange(preset as FilterPreset);
    this.filterState.set({ preset: preset as FilterPreset, ...range });
    this.loadRangeData();
  }

  onExportCsv(): void {
    const sessions = this.rangeSessions();
    if (!sessions.length) return;

    const headers = ['Date', 'Clock In', 'Clock Out', 'Worked (min)', 'Break (min)', 'Status'];
    const rows = sessions.map(s => [
      s.clockIn.slice(0, 10),
      new Date(s.clockIn).toLocaleTimeString(),
      s.clockOut ? new Date(s.clockOut).toLocaleTimeString() : '',
      s.workedMinutes.toString(),
      (s.totalBreakMinutes || 0).toString(),
      s.status,
    ]);

    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `my-time-${this.filterState().start}-to-${this.filterState().end}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private loadPolicy(): void {
    this.timeService.getPolicy().subscribe({
      next: (res) => this.policy.set(res.policy),
      error: () => {},
    });
  }

  private loadAllData(): void {
    this.loading.set(true);

    this.timeService.getStatus().subscribe({
      next: (res) => {
        this.currentStatus.set(res.status);
        this.agentOnline.set(res.agentOnline);
        if (res.dailyStats) this.dailyStats.set(res.dailyStats);
        if (res.weeklyStats) this.weeklyStats.set(res.weeklyStats);
      },
      error: () => {},
    });

    this.timeService.getMonthlyStats(new Date().getFullYear(), new Date().getMonth() + 1).subscribe({
      next: (res) => this.monthlyStats.set(res.stats),
      error: () => {},
    });

    this.timeService.getEmployeeStats().subscribe({
      next: (res) => {
        this.attendanceEvaluation.set(res.attendanceEvaluation);
        if (res.dailyStats) this.dailyStats.set(res.dailyStats);
        if (res.weeklyStats) this.weeklyStats.set(res.weeklyStats);
        if (res.monthlyStats) this.monthlyStats.set(res.monthlyStats);
      },
      error: () => {},
    });

    const filter = this.filterState();
    this.timeService.getRangeSessions(filter.start, filter.end).subscribe({
      next: (res) => {
        this.rangeSessions.set(res.sessions);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });

    this.timeService.getTodayDetail().subscribe({
      next: (res) => this.todaySessions.set(res.sessions),
      error: () => {},
    });

    this.loadSessionAlerts();
  }

  private loadRangeData(): void {
    this.loading.set(true);
    const filter = this.filterState();

    this.timeService.getRangeSessions(filter.start, filter.end).subscribe({
      next: (res) => {
        this.rangeSessions.set(res.sessions);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });

    this.timeService.getTodayDetail().subscribe({
      next: (res) => this.todaySessions.set(res.sessions),
      error: () => {},
    });

    this.loadSessionAlerts();
  }

  private loadSessionAlerts(): void {
    this.alertsService.getMyAlerts({ limit: 100, period: 'today' }).subscribe({
      next: (res) => {
        const map = new Map<number, boolean>();
        for (const alert of res.alerts) {
          if (alert.session?.id) {
            map.set(alert.session.id, true);
          }
        }
        this.sessionAlerts.set(map);
      },
      error: () => {},
    });
  }

  private subscribeToRealtime(): void {
    this.realtime.sessionUpdated$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((event: SessionUpdatedEvent) => {
      this.currentStatus.set(event.status);
      this.agentOnline.set(event.agentOnline);
      if (event.dailyStats) this.dailyStats.set(event.dailyStats);
      if (event.weeklyStats) this.weeklyStats.set(event.weeklyStats);

      this.timeService.getTodayDetail().subscribe({
        next: (res) => this.todaySessions.set(res.sessions),
        error: () => {},
      });

      this.timeService.getRangeSessions(this.filterState().start, this.filterState().end).subscribe({
        next: (res) => this.rangeSessions.set(res.sessions),
        error: () => {},
      });

      this.loadSessionAlerts();
    });
  }
}
