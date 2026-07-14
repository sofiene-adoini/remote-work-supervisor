import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { DatePipe } from '@angular/common';
import { LucideClock, LucideChevronLeft, LucideChevronRight, LucideCoffee } from '@lucide/angular';
import { TimeEntriesService } from '../services/time-entries.service';
import { SessionWithWorked, TodayDetailResponse } from '../models/employee.models';

interface DayGroup {
  label: string;
  date: string;
  sessions: SessionWithWorked[];
  totalMinutes: number;
}

@Component({
  selector: 'app-employee-time',
  imports: [DatePipe, LucideClock, LucideChevronLeft, LucideChevronRight, LucideCoffee],
  template: `
    <div class="page-container">
      <div class="page-header">
        <h1 class="page-title">My Time</h1>
      </div>

      <!-- Today's Summary -->
      @if (todayLoading()) {
        <div class="today-skeleton">
          <div class="sk sk-row-lg"></div>
        </div>
      } @else {
        <div class="today-card">
          <div class="today-header">
            <h2 class="today-title">Today</h2>
            @if (todayData()) {
              <span class="today-date">{{ todayDateStr }}</span>
            }
          </div>
          @if (!todayData() || todayData()!.sessions.length === 0) {
            <div class="today-empty">
              <p class="today-empty-text">No sessions recorded today.</p>
              <p class="today-empty-sub">Clock in from the dashboard to start tracking.</p>
            </div>
          } @else {
            <div class="today-stats">
              <div class="stat-item">
                <span class="stat-label">Clock In</span>
                <span class="stat-value">{{ todayFirstIn() }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">Clock Out</span>
                <span class="stat-value">{{ todayLastOut() }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">Breaks</span>
                <span class="stat-value">
                  <svg lucideCoffee class="stat-icon" aria-hidden="true"></svg>
                  {{ todayBreakLabel() }}
                </span>
              </div>
              <div class="stat-item stat-highlight">
                <span class="stat-label">Total Worked</span>
                <span class="stat-value stat-main">{{ todayWorkedLabel() }}</span>
              </div>
            </div>
            @if (todayData()!.sessions.length > 1) {
              <div class="today-sessions">
                <span class="today-sessions-label">{{ todayData()!.sessions.length }} sessions today</span>
              </div>
            }
          }
        </div>
      }

      <!-- Week Navigation -->
      <div class="week-nav">
        <button class="week-btn" type="button" (click)="prevWeek()" aria-label="Previous week">
          <svg lucideChevronLeft class="icon-sm" aria-hidden="true"></svg>
        </button>
        <span class="week-label">{{ weekLabel() }}</span>
        <button class="week-btn" type="button" (click)="nextWeek()" [disabled]="isCurrentWeek()" aria-label="Next week">
          <svg lucideChevronRight class="icon-sm" aria-hidden="true"></svg>
        </button>
      </div>

      <!-- Weekly Session Log -->
      @if (historyLoading()) {
        <div class="sk-list">
          @for (i of [1,2,3,4,5]; track i) {
            <div class="sk sk-row-lg"></div>
          }
        </div>
      } @else if (dayGroups().length === 0) {
        <div class="empty-state">
          <svg lucideClock class="empty-icon" aria-hidden="true"></svg>
          <p class="empty-text">No sessions this week</p>
        </div>
      } @else {
        <div class="day-groups">
          @for (group of dayGroups(); track group.date) {
            <div class="day-group">
              <div class="day-header">
                <span class="day-name">{{ group.label }}</span>
                <span class="day-total">{{ formatMinutes(group.totalMinutes) }}</span>
              </div>
              <div class="session-rows">
                @for (session of group.sessions; track session.id) {
                  <div class="session-row">
                    <div class="session-times">
                      <span class="session-in">{{ formatTime(session.clockIn) }}</span>
                      <span class="session-arrow">&rarr;</span>
                      <span class="session-out">{{ session.clockOut ? formatTime(session.clockOut) : 'now' }}</span>
                    </div>
                    <div class="session-details">
                      @if (session.totalBreakMinutes > 0) {
                        <span class="session-break">
                          <svg lucideCoffee class="icon-xs" aria-hidden="true"></svg>
                          {{ session.totalBreakMinutes }}m break
                        </span>
                      }
                      <span class="session-worked">{{ formatMinutes(session.workedMinutes) }}</span>
                    </div>
                  </div>
                }
              </div>
            </div>
          }
          <div class="week-summary">
            <span class="week-summary-label">Total this week</span>
            <span class="week-summary-value">{{ formatMinutes(weekTotalMinutes()) }}</span>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    @use 'styles/design-tokens' as t;

    .page-container { width: 100%; }

    .page-header { margin-bottom: 1.5rem; }

    .page-title {
      margin: 0;
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--rws-text);
    }

    .icon-sm { width: 16px; height: 16px; }
    .icon-xs { width: 13px; height: 13px; }

    // ── Today's card ────────────────────────────────────────────
    .today-card {
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
      padding: 1.5rem;
      margin-bottom: 1.5rem;
    }

    .today-skeleton {
      margin-bottom: 1.5rem;
    }

    .today-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1.25rem;
    }

    .today-title {
      margin: 0;
      font-size: 1.0625rem;
      font-weight: 600;
      color: var(--rws-text);
    }

    .today-date {
      font-size: 0.8125rem;
      color: var(--rws-text-muted);
      font-weight: 500;
    }

    .today-empty {
      text-align: center;
      padding: 1.5rem 0 0.5rem;
    }

    .today-empty-text {
      margin: 0 0 0.25rem;
      font-size: 0.9375rem;
      font-weight: 500;
      color: var(--rws-text);
    }

    .today-empty-sub {
      margin: 0;
      font-size: 0.8125rem;
      color: var(--rws-text-muted);
    }

    .today-stats {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1rem;
    }

    .stat-item {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .stat-label {
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--rws-text-muted);
    }

    .stat-value {
      font-size: 1rem;
      font-weight: 600;
      color: var(--rws-text);
      display: flex;
      align-items: center;
      gap: 0.375rem;
    }

    .stat-icon { width: 14px; height: 14px; color: #92610a; }

    .stat-highlight {
      background: var(--rws-bg);
      border-radius: var(--rws-radius);
      padding: 0.75rem 1rem;
    }

    .stat-main {
      font-size: 1.25rem;
      font-family: var(--rws-font-mono);
      font-weight: 700;
      color: var(--rws-accent-strong);
    }

    .today-sessions {
      margin-top: 0.75rem;
      padding-top: 0.75rem;
      border-top: 1px solid var(--rws-border);
    }

    .today-sessions-label {
      font-size: 0.8125rem;
      color: var(--rws-text-muted);
    }

    // ── Week navigation ─────────────────────────────────────────
    .week-nav {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 1rem;
      margin-bottom: 1.25rem;
    }

    .week-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border: 1px solid var(--rws-border);
      border-radius: var(--rws-radius);
      background: #fff;
      color: var(--rws-text-muted);
      cursor: pointer;
      transition: border-color 150ms ease, color 150ms ease;

      &:hover:not(:disabled) {
        border-color: var(--rws-accent);
        color: var(--rws-accent-strong);
      }

      &:disabled { opacity: 0.35; cursor: not-allowed; }
      &:focus-visible { outline: 3px solid var(--rws-focus-ring); outline-offset: 2px; }
    }

    .week-label {
      font-size: 0.9375rem;
      font-weight: 600;
      color: var(--rws-text);
      min-width: 180px;
      text-align: center;
    }

    // ── Day groups ──────────────────────────────────────────────
    .day-groups {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .day-group {
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
      overflow: hidden;
    }

    .day-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.875rem 1.25rem;
      background: var(--rws-bg);
      border-bottom: 1px solid var(--rws-border);
    }

    .day-name {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--rws-text);
    }

    .day-total {
      font-size: 0.875rem;
      font-weight: 600;
      font-family: var(--rws-font-mono);
      color: var(--rws-accent-strong);
    }

    .session-rows { padding: 0; }

    .session-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.75rem 1.25rem;
      border-bottom: 1px solid var(--rws-border);
      transition: background 150ms ease;

      &:last-child { border-bottom: none; }
      &:hover { background: #fafbfc; }
    }

    .session-times {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-family: var(--rws-font-mono);
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--rws-text);
    }

    .session-arrow {
      color: var(--rws-text-muted);
      font-size: 0.75rem;
    }

    .session-out {
      color: var(--rws-text-muted);
    }

    .session-details {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .session-break {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      font-size: 0.8125rem;
      color: #92610a;
    }

    .session-worked {
      font-family: var(--rws-font-mono);
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--rws-text);
    }

    // ── Week summary ────────────────────────────────────────────
    .week-summary {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem 1.25rem;
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    }

    .week-summary-label {
      font-size: 0.9375rem;
      font-weight: 600;
      color: var(--rws-text);
    }

    .week-summary-value {
      font-size: 1.125rem;
      font-weight: 700;
      font-family: var(--rws-font-mono);
      color: var(--rws-accent-strong);
    }

    // ── Empty ───────────────────────────────────────────────────
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 3rem 2rem;
      text-align: center;
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    }

    .empty-icon { width: 40px; height: 40px; color: var(--rws-text-muted); opacity: 0.4; margin-bottom: 0.75rem; }
    .empty-text { margin: 0; font-size: 0.9375rem; font-weight: 500; color: var(--rws-text); }

    @media (max-width: 639px) {
      .today-stats { grid-template-columns: 1fr 1fr; }
      .session-row { flex-direction: column; align-items: flex-start; gap: 0.5rem; }
    }

    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        transition-duration: 0.01ms !important;
      }
    }
  `],
})
export class EmployeeTimeComponent implements OnInit {
  private readonly timeService = inject(TimeEntriesService);

  protected readonly todayData = signal<TodayDetailResponse | null>(null);
  protected readonly todayLoading = signal(true);
  protected readonly historySessions = signal<SessionWithWorked[]>([]);
  protected readonly historyLoading = signal(true);
  protected readonly weekOffset = signal(0);

  protected readonly todayDateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric', year: 'numeric',
  });

  protected readonly todayFirstIn = computed(() => {
    const d = this.todayData();
    if (!d || d.sessions.length === 0) return '--';
    return this.formatTime(d.sessions[0].clockIn);
  });

  protected readonly todayLastOut = computed(() => {
    const d = this.todayData();
    if (!d || d.sessions.length === 0) return '--';
    const last = d.sessions[d.sessions.length - 1];
    return last.clockOut ? this.formatTime(last.clockOut) : 'now';
  });

  protected readonly todayBreakLabel = computed(() => {
    const d = this.todayData();
    if (!d || d.totalBreakMinutes === 0) return '0m';
    const h = Math.floor(d.totalBreakMinutes / 60);
    const m = d.totalBreakMinutes % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  });

  protected readonly todayWorkedLabel = computed(() => {
    const d = this.todayData();
    if (!d) return '0h 0m';
    return this.formatMinutes(d.totalWorkedMinutes);
  });

  protected readonly weekLabel = computed(() => {
    const start = this.weekStart();
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${fmt(start)} – ${fmt(end)}, ${end.getFullYear()}`;
  });

  protected readonly dayGroups = computed(() => {
    const sessions = this.historySessions();
    const map = new Map<string, DayGroup>();

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    for (const s of sessions) {
      const d = new Date(s.clockIn);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!map.has(key)) {
        const dayName = dayNames[d.getDay()];
        const dateLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        map.set(key, { label: `${dayName} – ${dateLabel}`, date: key, sessions: [], totalMinutes: 0 });
      }
      const group = map.get(key)!;
      group.sessions.push(s);
      group.totalMinutes += s.workedMinutes;
    }

    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  });

  protected readonly weekTotalMinutes = computed(() => {
    return this.dayGroups().reduce((sum, g) => sum + g.totalMinutes, 0);
  });

  protected readonly isCurrentWeek = computed(() => this.weekOffset() >= 0);

  ngOnInit(): void {
    this.loadToday();
    this.loadHistory();
  }

  prevWeek(): void {
    this.weekOffset.update(v => v - 1);
    this.loadHistory();
  }

  nextWeek(): void {
    if (this.weekOffset() >= 0) return;
    this.weekOffset.update(v => v + 1);
    this.loadHistory();
  }

  private loadToday(): void {
    this.todayLoading.set(true);
    this.timeService.getTodayDetail().subscribe({
      next: (res) => {
        this.todayData.set(res);
        this.todayLoading.set(false);
      },
      error: () => this.todayLoading.set(false),
    });
  }

  private loadHistory(): void {
    this.historyLoading.set(true);
    const start = this.weekStart();
    const str = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
    this.timeService.getHistory(str).subscribe({
      next: (res) => {
        this.historySessions.set(res.sessions);
        this.historyLoading.set(false);
      },
      error: () => this.historyLoading.set(false),
    });
  }

  private weekStart(): Date {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7) + (this.weekOffset() * 7));
    monday.setHours(0, 0, 0, 0);
    return monday;
  }

  protected formatTime(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }

  protected formatMinutes(min: number): string {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }
}
