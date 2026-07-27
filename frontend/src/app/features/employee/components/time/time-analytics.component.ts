import {
  Component, computed, input, signal, effect, ViewChild, ChangeDetectionStrategy,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Chart, registerables } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
Chart.register(...registerables);

import {
  LucideTrendingUp,
  LucideTrendingDown,
  LucideBarChart3,
  LucideAward,
  LucideTarget,
  LucideLightbulb,
} from '@lucide/angular';

import {
  DailyStats,
  WeeklyStats,
  MonthlyStats,
  CompanyWorkPolicy,
} from '../../models/employee.models';

export interface DailyHistoryEntry {
  date: string;
  workedMinutes: number;
  breakMinutes: number;
}

interface Insight {
  icon: 'positive' | 'neutral' | 'warning';
  text: string;
  priority: number;
}

@Component({
  selector: 'app-time-analytics',
  imports: [
    DecimalPipe,
    BaseChartDirective,
    LucideTrendingUp,
    LucideTrendingDown,
    LucideBarChart3,
    LucideAward,
    LucideTarget,
    LucideLightbulb,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading()) {
      <!-- Skeleton state -->
      <section class="analytics-section">
        <div class="section-header">
          <div class="skeleton-title sk-shimmer"></div>
        </div>
        <div class="charts-grid">
          <div class="chart-card">
            <div class="skeleton-card-header sk-shimmer"></div>
            <div class="skeleton-chart sk-shimmer"></div>
          </div>
          <div class="chart-card">
            <div class="skeleton-card-header sk-shimmer"></div>
            <div class="skeleton-chart sk-shimmer"></div>
          </div>
        </div>
        <div class="section-header">
          <div class="skeleton-title sk-shimmer"></div>
        </div>
        <div class="insights-grid">
          @for (i of skeletonInsights; track i) {
            <div class="insight-card skeleton-insight">
              <div class="skeleton-insight-icon sk-shimmer"></div>
              <div class="skeleton-insight-text sk-shimmer"></div>
            </div>
          }
        </div>
      </section>
    } @else {
      <section class="analytics-section">
        <!-- Section 1: Charts -->
        <div class="section-header">
          <svg lucideBarChart3 class="section-icon" aria-hidden="true"></svg>
          <h3 class="section-title">Analytics</h3>
        </div>

        <div class="charts-grid">
          <!-- Chart 1: Worked Hours Trend -->
          <div class="chart-card">
            <div class="chart-card-header">
              <span class="chart-card-title">Worked Hours Trend</span>
              <span class="chart-card-subtitle">Last 14 days</span>
            </div>
            @if (trendChartData().labels.length > 0) {
              <div class="chart-wrap">
                <canvas baseChart #trendChart
                  [data]="trendChartData()"
                  [options]="trendChartOptions"
                  [type]="'bar'">
                </canvas>
              </div>
            } @else {
              <div class="chart-empty">
                <svg lucideBarChart3 class="chart-empty-icon"></svg>
                <span>No data available</span>
              </div>
            }
          </div>

          <!-- Chart 2: Time Distribution -->
          <div class="chart-card">
            <div class="chart-card-header">
              <span class="chart-card-title">Time Distribution</span>
              <span class="chart-card-subtitle">Period breakdown</span>
            </div>
            @if (doughnutChartData().labels.length > 0) {
              <div class="doughnut-wrap">
                <canvas baseChart #doughnutChart
                  [data]="doughnutChartData()"
                  [options]="doughnutChartOptions"
                  [type]="'doughnut'">
                </canvas>
                <div class="doughnut-center">
                  <span class="doughnut-center-value">{{ doughnutCenterHours() }}</span>
                  <span class="doughnut-center-label">total</span>
                </div>
              </div>
            } @else {
              <div class="chart-empty">
                <svg lucideBarChart3 class="chart-empty-icon"></svg>
                <span>No data available</span>
              </div>
            }
          </div>
        </div>

        <!-- Section 2: Performance Insights -->
        <div class="section-header">
          <svg lucideLightbulb class="section-icon" aria-hidden="true"></svg>
          <h3 class="section-title">Performance Insights</h3>
        </div>

        @if (insights().length > 0) {
          <div class="insights-grid">
            @for (insight of insights(); track insight.text) {
              <div class="insight-card"
                [class.insight-positive]="insight.icon === 'positive'"
                [class.insight-neutral]="insight.icon === 'neutral'"
                [class.insight-warning]="insight.icon === 'warning'">
                <div class="insight-icon-wrap"
                  [class.insight-icon-positive]="insight.icon === 'positive'"
                  [class.insight-icon-neutral]="insight.icon === 'neutral'"
                  [class.insight-icon-warning]="insight.icon === 'warning'">
                  @if (insight.icon === 'positive') {
                    <svg lucideAward class="insight-icon" aria-hidden="true"></svg>
                  } @else if (insight.icon === 'warning') {
                    <svg lucideTrendingDown class="insight-icon" aria-hidden="true"></svg>
                  } @else {
                    <svg lucideTarget class="insight-icon" aria-hidden="true"></svg>
                  }
                </div>
                <span class="insight-text">{{ insight.text }}</span>
              </div>
            }
          </div>
        } @else {
          <div class="insights-empty">
            <span>No insights available for this period</span>
          </div>
        }
      </section>
    }
  `,
  styles: [`
    @use 'styles/design-tokens' as t;

    .analytics-section {
      display: flex;
      flex-direction: column;
      gap: 1rem;
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

    .skeleton-title { width: 160px; height: 20px; }
    .skeleton-card-header { width: 140px; height: 16px; margin-bottom: 1rem; }
    .skeleton-chart { width: 100%; height: 220px; border-radius: 8px; }
    .skeleton-insight-icon { width: 32px; height: 32px; border-radius: 8px; flex-shrink: 0; }
    .skeleton-insight-text { width: 100%; height: 14px; }
    .skeleton-insight { gap: 0.75rem; }

    /* ── Section Header ─────────────────────────────────────── */

    .section-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-top: 0.25rem;
    }

    .section-icon {
      width: 18px;
      height: 18px;
      color: var(--rws-accent);
    }

    .section-title {
      margin: 0;
      font-size: 0.9375rem;
      font-weight: 600;
      color: var(--rws-text);
    }

    /* ── Charts Grid ────────────────────────────────────────── */

    .charts-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }

    .chart-card {
      background: var(--rws-card);
      border-radius: var(--rws-radius);
      border: 1px solid var(--rws-border);
      padding: 1rem 1.25rem;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
      min-width: 0;
      overflow: hidden;
    }

    .chart-card-header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      margin-bottom: 0.75rem;
    }

    .chart-card-title {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--rws-text);
    }

    .chart-card-subtitle {
      font-size: 0.75rem;
      color: var(--rws-text-muted);
    }

    .chart-wrap {
      position: relative;
      width: 100%;
      height: 250px;
    }

    /* ── Doughnut ────────────────────────────────────────────── */

    .doughnut-wrap {
      position: relative;
      width: 100%;
      height: 250px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .doughnut-center {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      display: flex;
      flex-direction: column;
      align-items: center;
      pointer-events: none;
    }

    .doughnut-center-value {
      font-family: var(--rws-font-mono);
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--rws-text);
      line-height: 1.1;
    }

    .doughnut-center-label {
      font-size: 0.6875rem;
      color: var(--rws-text-muted);
      font-weight: 500;
    }

    /* ── Chart Empty ────────────────────────────────────────── */

    .chart-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 3rem 1rem;
      color: var(--rws-text-muted);
    }

    .chart-empty-icon {
      width: 28px;
      height: 28px;
      opacity: 0.3;
    }

    .chart-empty span {
      font-size: 0.8125rem;
    }

    /* ── Insights Grid ──────────────────────────────────────── */

    .insights-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 0.625rem;
    }

    .insight-card {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      background: var(--rws-card);
      border-radius: var(--rws-radius);
      border: 1px solid var(--rws-border);
      border-left: 3px solid var(--rws-border);
      transition: box-shadow 200ms ease, transform 200ms ease;
    }

    .insight-card:hover {
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
    }

    .insight-positive {
      border-left-color: var(--rws-success);
    }

    .insight-neutral {
      border-left-color: var(--rws-accent);
    }

    .insight-warning {
      border-left-color: var(--rws-gold);
    }

    .insight-icon-wrap {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .insight-icon-positive {
      background: color-mix(in srgb, var(--rws-success) 10%, transparent);
      color: var(--rws-success);
    }

    .insight-icon-neutral {
      background: color-mix(in srgb, var(--rws-accent) 10%, transparent);
      color: var(--rws-accent);
    }

    .insight-icon-warning {
      background: color-mix(in srgb, var(--rws-gold) 10%, transparent);
      color: var(--rws-gold);
    }

    .insight-icon {
      width: 16px;
      height: 16px;
    }

    .insight-text {
      font-size: 0.8125rem;
      font-weight: 500;
      color: var(--rws-text);
      line-height: 1.4;
      min-width: 0;
    }

    /* ── Insights Empty ─────────────────────────────────────── */

    .insights-empty {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem 1rem;
      color: var(--rws-text-muted);
      font-size: 0.8125rem;
      background: var(--rws-card);
      border-radius: var(--rws-radius);
      border: 1px solid var(--rws-border);
    }

    /* ── Responsive ─────────────────────────────────────────── */

    @media (max-width: 1024px) {
      .charts-grid {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 768px) {
      .insights-grid {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 480px) {
      .chart-card { padding: 0.75rem; }
      .chart-wrap { height: 200px; }
      .doughnut-wrap { height: 200px; }
      .insight-card { padding: 0.625rem 0.75rem; }
    }

    @media (prefers-reduced-motion: reduce) {
      .sk-shimmer { animation: none; }
    }
  `],
})
export class TimeAnalyticsComponent {
  readonly dailyStats = input<DailyStats | null>(null);
  readonly weeklyStats = input<WeeklyStats | null>(null);
  readonly monthlyStats = input<MonthlyStats | null>(null);
  readonly dailyHistory = input<DailyHistoryEntry[]>([]);
  readonly attendanceEvaluation = input<string>('');
  readonly loading = input(false);
  readonly policy = input<CompanyWorkPolicy | null>(null);

  @ViewChild('trendChart') trendChart?: BaseChartDirective;
  @ViewChild('doughnutChart') doughnutChart?: BaseChartDirective;

  protected readonly skeletonInsights = [1, 2, 3, 4, 5, 6];

  constructor() {
    effect(() => {
      this.dailyHistory();
      this.weeklyStats();
      this.monthlyStats();
      setTimeout(() => {
        this.trendChart?.update();
        this.doughnutChart?.update();
      }, 0);
    });
  }

  // ── Trend Bar Chart ────────────────────────────────────────────

  protected readonly trendChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1a1d23',
        titleFont: { size: 11 },
        bodyFont: { size: 11, family: "'IBM Plex Mono', monospace" },
        padding: 8,
        cornerRadius: 6,
        callbacks: {
          label: (ctx: any) => `${ctx.parsed.y.toFixed(1)}h`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { size: 10 }, color: '#6b7280' },
      },
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(214,220,229,0.5)' },
        ticks: {
          font: { size: 10, family: "'IBM Plex Mono', monospace" },
          color: '#6b7280',
          callback: (v: any) => `${v}h`,
        },
      },
    },
  };

  protected readonly trendChartData = computed(() => {
    const history = this.dailyHistory();
    if (history.length === 0) {
      return { labels: [], datasets: [] };
    }

    const labels = history.map((e) => {
      const d = new Date(e.date);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });

    const p = this.policy();
    const expectedHours = p?.expectedDailyHours ?? 8;

    const barColors = history.map((e) => {
      const hours = e.workedMinutes / 60;
      if (hours >= expectedHours + 0.5) return '#d4a44e';
      if (hours < expectedHours - 1) return '#A31D1D';
      return '#138D9E';
    });

    return {
      labels,
      datasets: [
        {
          data: history.map((e) => +(e.workedMinutes / 60).toFixed(1)),
          backgroundColor: barColors,
          borderRadius: 4,
          borderSkipped: false,
          barPercentage: 0.7,
          label: 'Worked Hours',
        },
        {
          data: history.map(() => expectedHours),
          type: 'line' as const,
          borderColor: '#6b7280',
          borderDash: [5, 4],
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false,
          label: 'Expected',
        },
      ],
    };
  });

  // ── Doughnut Chart ─────────────────────────────────────────────

  protected readonly doughnutChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '65%',
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          boxWidth: 10,
          padding: 12,
          font: { size: 11 },
          usePointStyle: true,
          pointStyle: 'circle',
        },
      },
      tooltip: {
        backgroundColor: '#1a1d23',
        titleFont: { size: 11 },
        bodyFont: { size: 11, family: "'IBM Plex Mono', monospace" },
        padding: 8,
        cornerRadius: 6,
        callbacks: {
          label: (ctx: any) => {
            const val = ctx.parsed;
            const total = (ctx.dataset.data as number[]).reduce((a, b) => a + b, 0);
            const pct = total > 0 ? ((val / total) * 100).toFixed(0) : '0';
            return ` ${ctx.label}: ${val.toFixed(1)}h (${pct}%)`;
          },
        },
      },
    },
  };

  protected readonly doughnutChartData = computed(() => {
    const w = this.weeklyStats();
    const m = this.monthlyStats();
    const d = this.dailyStats();

    let worked = 0;
    let brk = 0;
    let idle = 0;

    if (w) {
      worked = w.workedHours;
      brk = w.breakHours;
      idle = w.idleHours;
    } else if (m) {
      worked = m.workedHours;
      idle = m.missingHours > 0 ? 0 : 0;
    } else if (d) {
      worked = d.workedMinutes / 60;
      brk = d.breakMinutes / 60;
      idle = d.idleMinutes / 60;
    }

    if (worked === 0 && brk === 0 && idle === 0) {
      return { labels: [], datasets: [] };
    }

    return {
      labels: ['Worked', 'Break', 'Idle'],
      datasets: [
        {
          data: [+worked.toFixed(1), +brk.toFixed(1), +idle.toFixed(1)],
          backgroundColor: ['#138D9E', '#d4a44e', '#d1d5db'],
          borderWidth: 0,
          hoverOffset: 4,
        },
      ],
    };
  });

  protected readonly doughnutCenterHours = computed(() => {
    const data = this.doughnutChartData();
    if (!data.datasets.length) return '0h';
    const total = (data.datasets[0].data as number[]).reduce((a, b) => a + b, 0);
    const h = Math.floor(total);
    const m = Math.round((total - h) * 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  });

  // ── Insights ───────────────────────────────────────────────────

  protected readonly insights = computed((): Insight[] => {
    const list: Insight[] = [];
    const w = this.weeklyStats();
    const d = this.dailyStats();
    const m = this.monthlyStats();
    const eval_ = this.attendanceEvaluation();
    const p = this.policy();

    if (w && w.workedHours > w.expectedHours) {
      const diff = (w.workedHours - w.expectedHours).toFixed(1);
      list.push({
        icon: 'warning',
        text: `You worked ${diff} more hours than expected this week`,
        priority: 2,
      });
    }

    if (w && w.workedHours < w.expectedHours) {
      const diff = (w.expectedHours - w.workedHours).toFixed(1);
      list.push({
        icon: 'warning',
        text: `You're ${diff} hours short of your weekly target`,
        priority: 3,
      });
    }

    if (eval_ === 'excellent' || eval_ === 'good') {
      list.push({
        icon: 'positive',
        text: `Great job! Your attendance is rated ${eval_}`,
        priority: 1,
      });
    }

    if (d && d.overtimeMinutes > 0) {
      const hrs = (d.overtimeMinutes / 60).toFixed(1);
      list.push({
        icon: 'neutral',
        text: `You accumulated ${hrs} hours of overtime today`,
        priority: 4,
      });
    }

    if (w && w.overtimeHours > 0) {
      list.push({
        icon: 'neutral',
        text: `You have ${w.overtimeHours.toFixed(1)} hours of overtime this week`,
        priority: 5,
      });
    }

    if (d && p && d.breakMinutes >= p.minimumBreakMinutes && d.workedMinutes > 0) {
      list.push({
        icon: 'positive',
        text: 'You took all required breaks today',
        priority: 6,
      });
    }

    if (d && p && d.breakMinutes < p.minimumBreakMinutes && d.workedMinutes > 0) {
      list.push({
        icon: 'warning',
        text: `Consider taking more breaks - you had ${d.breakMinutes} min vs ${p.minimumBreakMinutes} min required`,
        priority: 3,
      });
    }

    if (d && d.missingMinutes > 0) {
      const hrs = (d.missingMinutes / 60).toFixed(1);
      list.push({
        icon: 'neutral',
        text: `You have ${hrs} hours remaining to meet today's target`,
        priority: 4,
      });
    }

    if (w && w.attendanceRate >= 90) {
      list.push({
        icon: 'positive',
        text: `Your attendance rate this week is ${w.attendanceRate}%`,
        priority: 2,
      });
    }

    if (m) {
      list.push({
        icon: 'neutral',
        text: `This month you worked ${m.workedHours.toFixed(0)} hours out of ${m.expectedHours} expected`,
        priority: 7,
      });
    }

    list.sort((a, b) => a.priority - b.priority);
    return list.slice(0, 6);
  });
}
