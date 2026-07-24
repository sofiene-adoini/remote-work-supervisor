import { Component, computed, effect, input, signal, OnInit, OnDestroy } from '@angular/core';
import { DatePipe } from '@angular/common';
import { LucideClock, LucideCoffee, LucideMonitor } from '@lucide/angular';

@Component({
  selector: 'app-todays-status',
  imports: [DatePipe, LucideClock, LucideCoffee, LucideMonitor],
  template: `
    <div class="card status-card">
      <!-- Top bar: Agent status + Status badge -->
      <div class="card-top">
        <div class="top-left">
          <span class="agent-dot" [class.online]="agentOnline()" [class.offline]="!agentOnline()"></span>
          <span class="agent-label">
            <svg lucideMonitor class="icon-xs" aria-hidden="true"></svg>
            Desktop Agent
          </span>
          <span class="agent-state" [class.online]="agentOnline()">{{ agentOnline() ? 'Online' : 'Offline' }}</span>
        </div>
        <span class="status-badge" [class]="statusClass()">{{ statusLabel() }}</span>
      </div>

      <!-- Main stats row -->
      <div class="stats-row">
        <!-- Worked Today — hero stat -->
        <div class="stat-hero">
          <span class="stat-hero-value">{{ workedToday() }}</span>
          <span class="stat-hero-label">worked today</span>
        </div>

        <div class="stat-divider"></div>

        <!-- Clock In -->
        <div class="stat">
          <span class="stat-value mono">{{ clockInTime() }}</span>
          <span class="stat-label">Clock In</span>
        </div>

        <div class="stat-divider"></div>

        <!-- Weekly Hours -->
        <div class="stat">
          <span class="stat-value mono">{{ weeklyHours() }}</span>
          <span class="stat-label">This Week</span>
        </div>
      </div>

      <!-- Info row -->
      <div class="info-row">
        <div class="info-item">
          <span class="info-label">Current Project</span>
          <span class="info-value">{{ projectName() }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Break</span>
          @if (status() === 'break' && breakStartedAt()) {
            <span class="info-value break-active">
              <svg lucideCoffee class="icon-xs" aria-hidden="true"></svg>
              Since {{ breakStartedAt() | date:'shortTime' }}
            </span>
          } @else {
            <span class="info-value">Not on break</span>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    @use 'styles/design-tokens' as t;

    .card {
      background: #fff;
      border-radius: 14px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
      padding: 0;
      overflow: hidden;
      transition: box-shadow 200ms ease;
    }

    .card:hover {
      box-shadow: 0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04);
    }

    /* ── Top bar ─────────────────────────────────────────────── */

    .card-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem 1.5rem;
      border-bottom: 1px solid var(--rws-border);
      background: linear-gradient(135deg, rgba(11,74,90,0.02), rgba(19,141,158,0.02));
    }

    .top-left {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .agent-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      flex-shrink: 0;
      transition: background 300ms ease, box-shadow 300ms ease;

      &.online {
        background: #1fb6a6;
        box-shadow: 0 0 0 2px rgba(31, 182, 166, 0.2);
        animation: pulse-dot 2.5s ease-in-out infinite;
      }
      &.offline {
        background: #d1d5db;
        box-shadow: none;
      }
    }

    @keyframes pulse-dot {
      0%, 100% { box-shadow: 0 0 0 2px rgba(31, 182, 166, 0.2); }
      50% { box-shadow: 0 0 0 5px rgba(31, 182, 166, 0.08); }
    }

    .agent-label {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--rws-text);
    }

    .agent-state {
      font-size: 0.75rem;
      font-weight: 600;
      padding: 0.125rem 0.5rem;
      border-radius: 999px;
      background: var(--rws-bg);
      color: var(--rws-text-muted);
      transition: background 200ms ease, color 200ms ease;

      &.online {
        background: #e8f8f6;
        color: #167d72;
      }
    }

    .status-badge {
      padding: 0.375rem 0.875rem;
      border-radius: 999px;
      font-size: 0.8125rem;
      font-weight: 600;
      transition: background 200ms ease, color 200ms ease, border-color 200ms ease;

      &.status-active {
        background: #e8f8f6;
        color: #167d72;
        border: 1px solid #b3e8e3;
      }

      &.status-break {
        background: #fef3e2;
        color: #92610a;
        border: 1px solid #f0d9a8;
      }

      &.status-clocked-out {
        background: var(--rws-bg);
        color: var(--rws-text-muted);
        border: 1px solid var(--rws-border);
      }
    }

    /* ── Main stats row ──────────────────────────────────────── */

    .stats-row {
      display: flex;
      align-items: center;
      padding: 1.75rem 1.5rem;
      gap: 0;
    }

    .stat-hero {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      flex: 1;
    }

    .stat-hero-value {
      font-size: 2.25rem;
      font-weight: 700;
      color: var(--rws-primary);
      font-family: var(--rws-font-mono);
      letter-spacing: -0.03em;
      line-height: 1;
    }

    .stat-hero-label {
      font-size: 0.8125rem;
      color: var(--rws-text-muted);
      font-weight: 500;
    }

    .stat-divider {
      width: 1px;
      height: 40px;
      background: var(--rws-border);
      margin: 0 1.5rem;
      flex-shrink: 0;
    }

    .stat {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      min-width: 80px;
    }

    .stat:last-of-type {
      text-align: right;
    }

    .stat-value {
      font-size: 1.25rem;
      font-weight: 600;
      color: var(--rws-text);
      line-height: 1;

      &.mono {
        font-family: var(--rws-font-mono);
        letter-spacing: -0.01em;
      }
    }

    .stat-label {
      font-size: 0.75rem;
      color: var(--rws-text-muted);
      font-weight: 500;
    }

    /* ── Info row ────────────────────────────────────────────── */

    .info-row {
      display: flex;
      gap: 1px;
      background: var(--rws-border);
      border-top: 1px solid var(--rws-border);
    }

    .info-item {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      padding: 0.875rem 1.5rem;
      background: #fff;
    }

    .info-label {
      font-size: 0.8125rem;
      color: var(--rws-text-muted);
      font-weight: 500;
    }

    .info-value {
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--rws-text);
      display: flex;
      align-items: center;
      gap: 0.375rem;

      &.break-active {
        color: #92610a;
        background: #fef3e2;
        padding: 0.25rem 0.625rem;
        border-radius: var(--rws-radius);
        border: 1px solid #f0d9a8;
      }
    }

    .icon-xs { width: 14px; height: 14px; }

    @media (max-width: 767px) {
      .stats-row { flex-direction: column; align-items: stretch; gap: 1.25rem; padding: 1.25rem 1.5rem; }
      .stat-divider { width: 100%; height: 1px; margin: 0; }
      .stat { text-align: left; }
      .stat:last-of-type { text-align: left; }
    }

    @media (max-width: 480px) {
      .info-row { flex-direction: column; }
    }

    @media (prefers-reduced-motion: reduce) {
      .agent-dot { animation: none; }
    }
  `],
})
export class TodaysStatusComponent implements OnInit, OnDestroy {
  readonly status = input<'clocked_out' | 'active' | 'break'>('clocked_out');
  readonly agentOnline = input(false);
  readonly clockIn = input<string | null>(null);
  readonly workedTodayMinutes = input(0);
  readonly totalBreakMinutes = input(0);
  readonly weeklyMinutes = input(0);
  readonly currentProject = input<{ id: number; name: string } | null>(null);
  readonly breakStartedAt = input<string | null>(null);

  private _tickInterval: ReturnType<typeof setInterval> | null = null;
  protected readonly tick = signal(0);

  protected readonly statusLabel = computed(() => {
    switch (this.status()) {
      case 'active': return 'Working';
      case 'break': return 'On Break';
      default: return 'Clocked Out';
    }
  });

  protected readonly statusClass = computed(() => {
    switch (this.status()) {
      case 'active': return 'status-badge status-active';
      case 'break': return 'status-badge status-break';
      default: return 'status-badge status-clocked-out';
    }
  });

  protected readonly clockInTime = computed(() => {
    const ci = this.clockIn();
    if (!ci) return '—';
    return new Date(ci).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  });

  protected readonly workedToday = computed(() => {
    this.tick(); // re-compute every tick
    const ci = this.clockIn();
    if (!ci) return '0h 0m';

    const start = new Date(ci).getTime();
    const now = Date.now();
    const status = this.status();

    if (status === 'clocked_out') {
      const h = Math.floor(this.workedTodayMinutes() / 60);
      const m = this.workedTodayMinutes() % 60;
      return `${h}h ${m}m`;
    }

    const accumulatedBreakMs = this.totalBreakMinutes() * 60000;
    const currentBreakMs = status === 'break' && this.breakStartedAt()
      ? now - new Date(this.breakStartedAt()!).getTime()
      : 0;
    const elapsed = Math.max(0, Math.round((now - start - accumulatedBreakMs - currentBreakMs) / 60000));
    const h = Math.floor(elapsed / 60);
    const m = elapsed % 60;
    return `${h}h ${m}m`;
  });

  protected readonly weeklyHours = computed(() => {
    const min = this.weeklyMinutes();
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${h}h ${m}m`;
  });

  protected readonly projectName = computed(() => {
    return this.currentProject()?.name ?? '—';
  });

  ngOnInit(): void {
    this._tickInterval = setInterval(() => this.tick.update(v => v + 1), 30000);
  }

  ngOnDestroy(): void {
    if (this._tickInterval) clearInterval(this._tickInterval);
  }
}
