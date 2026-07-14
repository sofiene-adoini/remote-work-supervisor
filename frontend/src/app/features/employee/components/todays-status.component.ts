import { Component, computed, inject, input, output, signal, OnInit, OnDestroy } from '@angular/core';
import { DatePipe } from '@angular/common';
import { LucideClock, LucideLogOut, LucideCoffee, LucideLogIn } from '@lucide/angular';
import { Session } from '../models/employee.models';

@Component({
  selector: 'app-todays-status',
  imports: [DatePipe, LucideClock, LucideLogOut, LucideCoffee, LucideLogIn],
  template: `
    <div class="card status-card">
        <div class="card-header">
          <h2 class="card-title">Today's Status</h2>
          <span class="status-badge" [class]="statusClass()">
            {{ statusLabel() }}
          </span>
        </div>

        <div class="card-body">
          <div class="status-main">
            <div class="elapsed-time">
              <span class="elapsed-value">{{ elapsedTime() }}</span>
              <span class="elapsed-label">worked today</span>
            </div>

            @if (session()?.breakStart && !session()?.breakEnd && session()?.status === 'break') {
              <div class="break-info">
                <svg lucideCoffee class="icon-sm" aria-hidden="true"></svg>
                <span>On break since {{ session()?.breakStart | date:'shortTime' }}</span>
              </div>
            }
          </div>

          <div class="status-actions">
            @if (status() === 'clocked_out') {
              <button class="btn btn-primary" type="button" (click)="onClockIn.emit()" [disabled]="loading()">
                <svg lucideLogIn class="icon-sm" aria-hidden="true"></svg>
                Clock In
              </button>
            } @else if (status() === 'active') {
              <button class="btn btn-primary" type="button" (click)="onClockOut.emit()" [disabled]="loading()">
                <svg lucideLogOut class="icon-sm" aria-hidden="true"></svg>
                Clock Out
              </button>
              <button class="btn btn-secondary" type="button" (click)="onStartBreak.emit()" [disabled]="loading()">
                <svg lucideCoffee class="icon-sm" aria-hidden="true"></svg>
                Start Break
              </button>
            } @else if (status() === 'break') {
              <button class="btn btn-accent" type="button" (click)="onEndBreak.emit()" [disabled]="loading()">
                <svg lucideClock class="icon-sm" aria-hidden="true"></svg>
                End Break
              </button>
              <button class="btn btn-secondary" type="button" (click)="onClockOut.emit()" [disabled]="loading()">
                <svg lucideLogOut class="icon-sm" aria-hidden="true"></svg>
                Clock Out
              </button>
            }
          </div>
        </div>
      </div>
  `,
  styles: [`
    @use 'styles/design-tokens' as t;

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
      margin-bottom: 1.25rem;
    }

    .card-title {
      margin: 0;
      font-size: 1.125rem;
      font-weight: 600;
      color: var(--rws-text);
    }

    .status-badge {
      padding: 0.375rem 0.875rem;
      border-radius: 999px;
      font-size: 0.8125rem;
      font-weight: 600;

      &.status-active {
        background: #e8f8f6;
        color: #167d72;
        border: 1px solid #1fb6a6;
      }

      &.status-break {
        background: #fef3e2;
        color: #92610a;
        border: 1px solid #d9973b;
      }

      &.status-clocked-out {
        background: var(--rws-bg);
        color: var(--rws-text-muted);
        border: 1px solid var(--rws-border);
      }
    }

    .card-body {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1.5rem;
      flex-wrap: wrap;
    }

    .status-main {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .elapsed-time {
      display: flex;
      align-items: baseline;
      gap: 0.5rem;
    }

    .elapsed-value {
      font-size: 2rem;
      font-weight: 700;
      color: var(--rws-text);
      font-family: var(--rws-font-mono);
      letter-spacing: -0.02em;
    }

    .elapsed-label {
      font-size: 0.875rem;
      color: var(--rws-text-muted);
    }

    .break-info {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      font-size: 0.8125rem;
      color: #92610a;
      background: #fef3e2;
      padding: 0.375rem 0.75rem;
      border-radius: var(--rws-radius);
    }

    .status-actions {
      display: flex;
      gap: 0.75rem;
      flex-wrap: wrap;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.625rem 1.25rem;
      border: none;
      border-radius: var(--rws-radius);
      font-size: 0.9rem;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 150ms ease, transform 100ms ease, box-shadow 150ms ease;
      font-family: inherit;

      &:hover:not(:disabled) { opacity: 0.92; }
      &:active:not(:disabled) { transform: scale(0.98); }
      &:disabled { opacity: 0.5; cursor: not-allowed; }
      &:focus-visible { outline: 3px solid var(--rws-focus-ring); outline-offset: 2px; }
    }

    .btn-primary {
      background: var(--rws-accent);
      color: var(--rws-primary);
    }

    .btn-accent {
      background: #d9973b;
      color: #fff;
    }

    .btn-secondary {
      background: var(--rws-bg);
      color: var(--rws-text);
      border: 1px solid var(--rws-border);

      &:hover:not(:disabled) {
        border-color: var(--rws-primary);
        color: var(--rws-primary);
      }
    }

    .icon-sm { width: 18px; height: 18px; }

    @media (max-width: 639px) {
      .card-body { flex-direction: column; align-items: stretch; }
      .elapsed-value { font-size: 1.5rem; }
      .status-actions { justify-content: stretch; }
      .status-actions .btn { flex: 1; justify-content: center; }
    }

    @media (prefers-reduced-motion: reduce) {
      .btn { transition: none; }
    }
  `],
})
export class TodaysStatusComponent implements OnInit, OnDestroy {
  readonly session = input<Session | null>(null);
  readonly status = input<'clocked_out' | 'active' | 'break'>('clocked_out');
  readonly loading = input(false);

  readonly onClockIn = output<void>();
  readonly onClockOut = output<void>();
  readonly onStartBreak = output<void>();
  readonly onEndBreak = output<void>();

  private _elapsedInterval: ReturnType<typeof setInterval> | null = null;
  protected readonly elapsedSeconds = signal(0);

  protected readonly statusLabel = computed(() => {
    switch (this.status()) {
      case 'active': return 'Active';
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

  protected readonly elapsedTime = computed(() => {
    const total = this.elapsedSeconds();
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    return `${h}h ${m}m`;
  });

  ngOnInit(): void {
    this._updateElapsed();
    this._elapsedInterval = setInterval(() => this._updateElapsed(), 10000);
  }

  ngOnDestroy(): void {
    if (this._elapsedInterval) clearInterval(this._elapsedInterval);
  }

  private _updateElapsed(): void {
    const s = this.session();
    if (!s || s.status === 'completed') {
      this.elapsedSeconds.set(0);
      return;
    }

    const start = new Date(s.clockIn).getTime();
    const now = Date.now();
    const breakMs = (s.totalBreakMinutes || 0) * 60000;
    const currentBreak = s.breakStart && !s.breakEnd
      ? now - new Date(s.breakStart).getTime()
      : 0;
    const elapsed = Math.max(0, Math.floor((now - start - breakMs - currentBreak) / 1000));
    this.elapsedSeconds.set(elapsed);
  }
}
