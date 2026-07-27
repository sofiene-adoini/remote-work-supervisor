import { Component, computed, input } from '@angular/core';
import {
  LucideClock,
  LucideTimer,
  LucideCoffee,
  LucideTrendingUp,
  LucideAlertTriangle,
  LucideCheckCircle,
  LucideZap,
  LucideActivity,
  LucideMonitor,
  LucidePause,
} from '@lucide/angular';
import {
  DailyStats,
  WeeklyStats,
  MonthlyStats,
  CompanyWorkPolicy,
} from '../../models/employee.models';

@Component({
  selector: 'app-time-overview',
  imports: [
    LucideClock,
    LucideTimer,
    LucideCoffee,
    LucideTrendingUp,
    LucideAlertTriangle,
    LucideCheckCircle,
    LucideZap,
    LucideActivity,
    LucideMonitor,
    LucidePause,
  ],
  template: `
    @if (loading()) {
      <!-- Skeleton state -->
      <section class="overview-section">
        <div class="skeleton-grid">
          @for (i of skeletonCards; track i) {
            <div class="skeleton-card">
              <div class="skeleton-icon sk-shimmer"></div>
              <div class="skeleton-value sk-shimmer"></div>
              <div class="skeleton-label sk-shimmer"></div>
            </div>
          }
        </div>
        <div class="skeleton-progress-section">
          @for (i of skeletonBars; track i) {
            <div class="skeleton-bar-group">
              <div class="skeleton-bar-header sk-shimmer"></div>
              <div class="skeleton-bar-track">
                <div class="skeleton-bar-fill sk-shimmer"></div>
              </div>
            </div>
          }
        </div>
      </section>
    } @else {
      <section class="overview-section">
        <!-- Section 1: Summary Cards -->
        <div class="cards-grid">
          <!-- Worked Today -->
          <div class="stat-card" style="--card-accent: var(--rws-accent)">
            <div class="card-icon-wrap">
              <svg lucideClock class="card-icon" aria-hidden="true"></svg>
            </div>
            <div class="card-body">
              <span class="card-value">{{ workedTodayLabel() }}</span>
              <span class="card-subtitle">Worked Today</span>
            </div>
          </div>

          <!-- Expected Hours -->
          <div class="stat-card" style="--card-accent: var(--rws-primary)">
            <div class="card-icon-wrap">
              <svg lucideTimer class="card-icon" aria-hidden="true"></svg>
            </div>
            <div class="card-body">
              <span class="card-value">{{ expectedTodayLabel() }}</span>
              <span class="card-subtitle">Expected Hours</span>
            </div>
          </div>

          <!-- Remaining -->
          <div class="stat-card" [style.--card-accent]="remainingColor()">
            <div class="card-icon-wrap">
              <svg lucideAlertTriangle class="card-icon" aria-hidden="true"></svg>
            </div>
            <div class="card-body">
              <span class="card-value">{{ remainingLabel() }}</span>
              <span class="card-subtitle">Remaining</span>
            </div>
          </div>

          <!-- Overtime -->
          <div class="stat-card" style="--card-accent: var(--rws-gold)">
            <div class="card-icon-wrap">
              <svg lucideZap class="card-icon" aria-hidden="true"></svg>
            </div>
            <div class="card-body">
              <span class="card-value">{{ overtimeLabel() }}</span>
              <span class="card-subtitle">Overtime</span>
            </div>
          </div>

          <!-- Break Time -->
          <div class="stat-card" style="--card-accent: var(--rws-text-muted)">
            <div class="card-icon-wrap">
              <svg lucideCoffee class="card-icon" aria-hidden="true"></svg>
            </div>
            <div class="card-body">
              <span class="card-value">{{ breakLabel() }}</span>
              <span class="card-subtitle">Break Time</span>
            </div>
          </div>

          <!-- Idle Time -->
          <div class="stat-card" [style.--card-accent]="idleColor()">
            <div class="card-icon-wrap">
              <svg lucidePause class="card-icon" aria-hidden="true"></svg>
            </div>
            <div class="card-body">
              <span class="card-value">{{ idleLabel() }}</span>
              <span class="card-subtitle">Idle Time</span>
            </div>
          </div>

          <!-- Attendance -->
          <div class="stat-card" [style.--card-accent]="attendanceColor()">
            <div class="card-icon-wrap">
              <svg lucideCheckCircle class="card-icon" aria-hidden="true"></svg>
            </div>
            <div class="card-body">
              <span class="card-value card-value--text">{{ attendanceLabel() }}</span>
              <span class="card-subtitle">Attendance</span>
            </div>
          </div>

          <!-- Productivity -->
          <div class="stat-card" [style.--card-accent]="productivityColor()">
            <div class="card-icon-wrap">
              <svg lucideTrendingUp class="card-icon" aria-hidden="true"></svg>
            </div>
            <div class="card-body">
              <span class="card-value">{{ productivityLabel() }}</span>
              <span class="card-subtitle">Productivity</span>
            </div>
          </div>
        </div>

        <!-- Section 2: Progress Bars -->
        <div class="progress-section">
          <h3 class="section-title">Progress</h3>

          <div class="progress-group">
            <div class="progress-header">
              <span class="progress-label">Daily</span>
              <span class="progress-meta">{{ dailyProgressLabel() }} &middot; {{ dailyProgressPercent() }}%</span>
            </div>
            <div class="progress-track">
              <div
                class="progress-fill"
                [style.width.%]="dailyProgressPercent()"
                [class.progress-fill--green]="dailyProgressPercent() >= 80"
                [class.progress-fill--amber]="dailyProgressPercent() >= 50 && dailyProgressPercent() < 80"
                [class.progress-fill--red]="dailyProgressPercent() < 50"
              ></div>
            </div>
          </div>

          <div class="progress-group">
            <div class="progress-header">
              <span class="progress-label">Weekly</span>
              <span class="progress-meta">{{ weeklyProgressLabel() }} &middot; {{ weeklyProgressPercent() }}%</span>
            </div>
            <div class="progress-track">
              <div
                class="progress-fill"
                [style.width.%]="weeklyProgressPercent()"
                [class.progress-fill--green]="weeklyProgressPercent() >= 80"
                [class.progress-fill--amber]="weeklyProgressPercent() >= 50 && weeklyProgressPercent() < 80"
                [class.progress-fill--red]="weeklyProgressPercent() < 50"
              ></div>
            </div>
          </div>

          <div class="progress-group">
            <div class="progress-header">
              <span class="progress-label">Monthly</span>
              <span class="progress-meta">{{ monthlyProgressLabel() }} &middot; {{ monthlyProgressPercent() }}%</span>
            </div>
            <div class="progress-track">
              <div
                class="progress-fill"
                [style.width.%]="monthlyProgressPercent()"
                [class.progress-fill--green]="monthlyProgressPercent() >= 80"
                [class.progress-fill--amber]="monthlyProgressPercent() >= 50 && monthlyProgressPercent() < 80"
                [class.progress-fill--red]="monthlyProgressPercent() < 50"
              ></div>
            </div>
          </div>
        </div>

        <!-- Section 3: Real-time Status -->
        <div class="realtime-bar">
          <div class="realtime-left">
            <span class="status-dot" [class]="statusDotClass()"></span>
            <span class="status-text">{{ statusText() }}</span>
          </div>
          <div class="realtime-right">
            <svg lucideMonitor class="icon-xs" aria-hidden="true"></svg>
            <span class="agent-badge" [class.agent-badge--online]="agentOnline()">{{ agentOnline() ? 'Agent Online' : 'Agent Offline' }}</span>
          </div>
        </div>
      </section>
    }
  `,
  styles: [`
    @use 'styles/design-tokens' as t;

    .overview-section {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    /* ── Skeleton ─────────────────────────────────────────────── */

    @keyframes shimmer {
      0% { background-position: -400px 0; }
      100% { background-position: 400px 0; }
    }

    .sk-shimmer {
      background: linear-gradient(90deg, var(--rws-bg) 25%, #ece9e4 50%, var(--rws-bg) 75%);
      background-size: 800px 100%;
      animation: shimmer 1.6s ease-in-out infinite;
      border-radius: 4px;
    }

    .skeleton-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 0.75rem;
    }

    .skeleton-card {
      background: var(--rws-card);
      border-radius: var(--rws-radius);
      padding: 1rem 1.125rem;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      border-left: 3px solid var(--rws-border);
    }

    .skeleton-icon { width: 32px; height: 32px; border-radius: 6px; flex-shrink: 0; }
    .skeleton-value { width: 60px; height: 18px; }
    .skeleton-label { width: 80px; height: 12px; margin-top: 4px; }

    .skeleton-progress-section {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .skeleton-bar-group { display: flex; flex-direction: column; gap: 0.5rem; }
    .skeleton-bar-header { width: 140px; height: 14px; }

    .skeleton-bar-track {
      height: 8px;
      background: var(--rws-bg);
      border-radius: 999px;
      overflow: hidden;
    }

    .skeleton-bar-fill {
      height: 100%;
      width: 55%;
      border-radius: 999px;
    }

    /* ── Cards Grid ───────────────────────────────────────────── */

    .cards-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 0.75rem;
    }

    .stat-card {
      background: var(--rws-card);
      border-radius: var(--rws-radius);
      padding: 1rem 1.125rem;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      border-left: 3px solid var(--card-accent, var(--rws-border));
      transition: box-shadow 200ms ease, transform 200ms ease;
      min-width: 0;
    }

    .stat-card:hover {
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
      transform: translateY(-1px);
    }

    .card-icon-wrap {
      width: 34px;
      height: 34px;
      border-radius: 8px;
      background: color-mix(in srgb, var(--card-accent) 8%, transparent);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .card-icon {
      width: 17px;
      height: 17px;
      color: var(--card-accent);
    }

    .card-body {
      display: flex;
      flex-direction: column;
      gap: 1px;
      min-width: 0;
    }

    .card-value {
      font-family: var(--rws-font-mono);
      font-size: 1.0625rem;
      font-weight: 700;
      color: var(--rws-text);
      letter-spacing: -0.01em;
      line-height: 1.2;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .card-value--text {
      font-family: var(--rws-font-sans);
      font-size: 0.8125rem;
      text-transform: capitalize;
    }

    .card-subtitle {
      font-size: 0.6875rem;
      font-weight: 500;
      color: var(--rws-text-muted);
      letter-spacing: 0.01em;
    }

    /* ── Progress Section ─────────────────────────────────────── */

    .progress-section {
      background: var(--rws-card);
      border-radius: var(--rws-radius);
      padding: 1.25rem 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .section-title {
      margin: 0;
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--rws-text);
    }

    .progress-group {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
    }

    .progress-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .progress-label {
      font-size: 0.8125rem;
      font-weight: 500;
      color: var(--rws-text);
    }

    .progress-meta {
      font-family: var(--rws-font-mono);
      font-size: 0.75rem;
      font-weight: 500;
      color: var(--rws-text-muted);
    }

    .progress-track {
      height: 8px;
      background: var(--rws-bg);
      border-radius: 999px;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      border-radius: 999px;
      transition: width 600ms cubic-bezier(0.22, 1, 0.36, 1);
      min-width: 2px;
    }

    .progress-fill--green {
      background: linear-gradient(90deg, var(--rws-accent), var(--rws-success));
    }

    .progress-fill--amber {
      background: linear-gradient(90deg, var(--rws-gold), #d4a44e);
    }

    .progress-fill--red {
      background: linear-gradient(90deg, var(--rws-error), #c54545);
    }

    /* ── Realtime Status Bar ──────────────────────────────────── */

    .realtime-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: var(--rws-card);
      border-radius: var(--rws-radius);
      padding: 0.75rem 1.25rem;
      border: 1px solid var(--rws-border);
    }

    .realtime-left {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    @keyframes pulse-status {
      0%, 100% { box-shadow: 0 0 0 2px rgba(31, 182, 166, 0.2); }
      50% { box-shadow: 0 0 0 5px rgba(31, 182, 166, 0.06); }
    }

    @keyframes pulse-status-break {
      0%, 100% { box-shadow: 0 0 0 2px rgba(194, 146, 79, 0.2); }
      50% { box-shadow: 0 0 0 5px rgba(194, 146, 79, 0.06); }
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .status-dot--active {
      background: var(--rws-success);
      animation: pulse-status 2.5s ease-in-out infinite;
    }

    .status-dot--break {
      background: var(--rws-gold);
      animation: pulse-status-break 2.5s ease-in-out infinite;
    }

    .status-dot--clocked-out {
      background: var(--rws-text-muted);
      opacity: 0.5;
    }

    .status-text {
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--rws-text);
    }

    .realtime-right {
      display: flex;
      align-items: center;
      gap: 0.375rem;
    }

    .icon-xs {
      width: 13px;
      height: 13px;
      color: var(--rws-text-muted);
    }

    .agent-badge {
      font-size: 0.6875rem;
      font-weight: 600;
      padding: 0.1875rem 0.5rem;
      border-radius: 999px;
      background: var(--rws-bg);
      color: var(--rws-text-muted);
      transition: background 200ms ease, color 200ms ease;
    }

    .agent-badge--online {
      background: #e8f8f6;
      color: #167d72;
    }

    /* ── Responsive ───────────────────────────────────────────── */

    @media (max-width: 1024px) {
      .cards-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    @media (max-width: 480px) {
      .cards-grid {
        grid-template-columns: 1fr;
      }

      .realtime-bar {
        flex-direction: column;
        align-items: flex-start;
        gap: 0.5rem;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        transition-duration: 0.01ms !important;
      }
    }
  `],
})
export class TimeOverviewComponent {
  readonly dailyStats = input<DailyStats | null>(null);
  readonly weeklyStats = input<WeeklyStats | null>(null);
  readonly monthlyStats = input<MonthlyStats | null>(null);
  readonly status = input<'clocked_out' | 'active' | 'break'>('clocked_out');
  readonly agentOnline = input(false);
  readonly policy = input<CompanyWorkPolicy | null>(null);
  readonly loading = input(false);

  protected readonly skeletonCards = [1, 2, 3, 4, 5, 6, 7, 8];
  protected readonly skeletonBars = [1, 2, 3];

  private formatMinutes(min: number): string {
    const h = Math.floor(Math.abs(min) / 60);
    const m = Math.abs(min) % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  private formatHours(hours: number): string {
    const h = Math.floor(Math.abs(hours));
    const m = Math.round((Math.abs(hours) - h) * 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  protected readonly workedTodayLabel = computed(() => {
    const s = this.dailyStats();
    return s ? this.formatMinutes(s.workedMinutes) : '0h 0m';
  });

  protected readonly expectedTodayLabel = computed(() => {
    const s = this.dailyStats();
    if (s) return this.formatMinutes(s.expectedMinutes);
    const p = this.policy();
    return p ? this.formatHours(p.expectedDailyHours) : '8h 0m';
  });

  protected readonly remainingLabel = computed(() => {
    const s = this.dailyStats();
    if (!s) return '0h 0m';
    return this.formatMinutes(s.missingMinutes);
  });

  protected readonly remainingColor = computed(() => {
    const s = this.dailyStats();
    if (!s || s.missingMinutes <= 0) return 'var(--rws-text-muted)';
    return 'var(--rws-error)';
  });

  protected readonly overtimeLabel = computed(() => {
    const s = this.dailyStats();
    return s ? this.formatMinutes(s.overtimeMinutes) : '0h 0m';
  });

  protected readonly breakLabel = computed(() => {
    const s = this.dailyStats();
    return s ? this.formatMinutes(s.breakMinutes) : '0h 0m';
  });

  protected readonly idleLabel = computed(() => {
    const s = this.dailyStats();
    return s ? this.formatMinutes(s.idleMinutes) : '0h 0m';
  });

  protected readonly idleColor = computed(() => {
    const s = this.dailyStats();
    if (!s || s.idleMinutes <= 30) return 'var(--rws-text-muted)';
    return 'var(--rws-error)';
  });

  protected readonly attendanceLabel = computed(() => {
    const s = this.dailyStats();
    if (!s) return '—';
    return s.attendanceStatus.replace('_', ' ');
  });

  protected readonly attendanceColor = computed(() => {
    const s = this.dailyStats();
    if (!s) return 'var(--rws-text-muted)';
    switch (s.attendanceStatus) {
      case 'completed': return 'var(--rws-success)';
      case 'overtime': return 'var(--rws-gold)';
      case 'day_off': return 'var(--rws-accent)';
      case 'underworked': return 'var(--rws-error)';
      default: return 'var(--rws-text-muted)';
    }
  });

  protected readonly productivityPercent = computed(() => {
    const s = this.dailyStats();
    if (!s || s.workedMinutes === 0) return 0;
    return Math.round((s.productiveMinutes / s.workedMinutes) * 100);
  });

  protected readonly productivityLabel = computed(() => {
    return `${this.productivityPercent()}%`;
  });

  protected readonly productivityColor = computed(() => {
    const p = this.productivityPercent();
    if (p > 80) return 'var(--rws-success)';
    if (p > 50) return 'var(--rws-gold)';
    return 'var(--rws-error)';
  });

  protected readonly dailyProgressPercent = computed(() => {
    const s = this.dailyStats();
    if (!s || s.expectedMinutes === 0) return 0;
    return Math.min(100, Math.round((s.workedMinutes / s.expectedMinutes) * 100));
  });

  protected readonly dailyProgressLabel = computed(() => {
    const s = this.dailyStats();
    if (!s) return '0h / 0h';
    return `${this.formatMinutes(s.workedMinutes)} / ${this.formatMinutes(s.expectedMinutes)}`;
  });

  protected readonly weeklyProgressPercent = computed(() => {
    const s = this.weeklyStats();
    const p = this.policy();
    const expected = s?.expectedHours ?? p?.expectedWeeklyHours ?? 40;
    if (expected === 0) return 0;
    return Math.min(100, Math.round(((s?.workedHours ?? 0) / expected) * 100));
  });

  protected readonly weeklyProgressLabel = computed(() => {
    const s = this.weeklyStats();
    const p = this.policy();
    const expected = s?.expectedHours ?? p?.expectedWeeklyHours ?? 40;
    return `${this.formatHours(s?.workedHours ?? 0)} / ${this.formatHours(expected)}`;
  });

  protected readonly monthlyProgressPercent = computed(() => {
    const s = this.monthlyStats();
    if (!s || s.expectedHours === 0) return 0;
    return Math.min(100, Math.round((s.workedHours / s.expectedHours) * 100));
  });

  protected readonly monthlyProgressLabel = computed(() => {
    const s = this.monthlyStats();
    if (!s) return '0h / 0h';
    return `${this.formatHours(s.workedHours)} / ${this.formatHours(s.expectedHours)}`;
  });

  protected readonly statusText = computed(() => {
    switch (this.status()) {
      case 'active': return 'Working';
      case 'break': return 'On Break';
      default: return 'Clocked Out';
    }
  });

  protected readonly statusDotClass = computed(() => {
    switch (this.status()) {
      case 'active': return 'status-dot status-dot--active';
      case 'break': return 'status-dot status-dot--break';
      default: return 'status-dot status-dot--clocked-out';
    }
  });
}
