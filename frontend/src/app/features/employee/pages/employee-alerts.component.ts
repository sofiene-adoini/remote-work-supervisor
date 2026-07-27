import { Component, inject, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { DatePipe } from '@angular/common';
import { LucideCheck, LucideBell, LucideChevronLeft, LucideChevronRight, LucideCalendar } from '@lucide/angular';
import { Subscription } from 'rxjs';
import { AlertsService } from '../services/alerts.service';
import { Alert } from '../models/employee.models';
import { RealtimeService, AlertCreatedEvent } from '../../../core/services/realtime.service';

type FilterPreset = 'today' | 'yesterday' | '7d' | '30d' | 'custom';

@Component({
  selector: 'app-employee-alerts',
  imports: [DatePipe, LucideCheck, LucideBell, LucideChevronLeft, LucideChevronRight, LucideCalendar],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div class="header-left">
          <h1 class="page-title">Alerts</h1>
          <span class="result-count" [class.hidden]="loading()">{{ total() }} alerts</span>
        </div>
        @if (unreadCount() > 0) {
          <button class="btn-mark-all" type="button" (click)="handleMarkAllRead()">
            <svg lucideCheck class="icon-sm" aria-hidden="true"></svg>
            Mark all read
          </button>
        }
      </div>

      <!-- Filter Bar -->
      <div class="filter-bar">
        <div class="filter-chips">
          @for (preset of filterPresets; track preset.key) {
            <button
              class="chip"
              [class.active]="activePreset() === preset.key"
              type="button"
              (click)="onPresetChange(preset.key)">
              {{ preset.label }}
            </button>
          }
          <button
            class="chip"
            [class.active]="activePreset() === 'custom'"
            type="button"
            (click)="onPresetChange('custom')">
            <svg lucideCalendar class="icon-xs" aria-hidden="true"></svg>
            Custom
          </button>
        </div>

        @if (activePreset() === 'custom') {
          <div class="custom-range">
            <label class="range-label">
              From
              <input
                type="date"
                class="date-input"
                [value]="customFrom()"
                (change)="onCustomFromChange($event)" />
            </label>
            <label class="range-label">
              To
              <input
                type="date"
                class="date-input"
                [value]="customTo()"
                (change)="onCustomToChange($event)" />
            </label>
          </div>
        }
      </div>

      <!-- Content -->
      @if (loading()) {
        <div class="sk-list">
          @for (i of [1,2,3,4,5]; track i) {
            <div class="sk sk-row-lg"></div>
          }
        </div>
      } @else if (alerts().length === 0) {
        <div class="empty-state">
          <svg lucideBell class="empty-icon" aria-hidden="true"></svg>
          <p class="empty-text">No alerts</p>
          <p class="empty-sub">{{ emptyMessage() }}</p>
        </div>
      } @else {
        <div class="alert-list">
          @for (alert of alerts(); track alert.id) {
            <div
              class="alert-item"
              [class.unread]="!alert.isRead"
              (click)="handleMarkRead(alert)">
              <div class="alert-severity" [class]="'severity-' + alert.severity">
                <span class="severity-label">{{ alert.severity }}</span>
              </div>
              <div class="alert-content">
                <span class="alert-type">{{ alert.title }}</span>
                <p class="alert-message">{{ alert.message }}</p>
                <span class="alert-time">{{ alert.createdAt | date:'medium' }}</span>
              </div>
              @if (!alert.isRead) {
                <span class="unread-dot"></span>
              }
            </div>
          }
        </div>

        <!-- Pagination -->
        @if (totalPages() > 1) {
          <div class="pagination-bar">
            <span class="pagination-info">
              Showing {{ rangeStart() }}–{{ rangeEnd() }} of {{ total() }}
            </span>
            <div class="pagination-controls">
              <button
                class="page-btn"
                type="button"
                [disabled]="currentPage() === 1"
                (click)="goToPage(currentPage() - 1)">
                <svg lucideChevronLeft class="icon-xs" aria-hidden="true"></svg>
              </button>
              @for (p of visiblePages(); track p) {
                <button
                  class="page-num"
                  [class.active]="p === currentPage()"
                  type="button"
                  (click)="goToPage(p)">
                  {{ p }}
                </button>
              }
              <button
                class="page-btn"
                type="button"
                [disabled]="currentPage() === totalPages()"
                (click)="goToPage(currentPage() + 1)">
                <svg lucideChevronRight class="icon-xs" aria-hidden="true"></svg>
              </button>
            </div>
          </div>
        }
      }
    </div>
  `,
  styles: [`
    @use 'styles/design-tokens' as t;

    .page-container { width: 100%; }

    .page-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1.25rem;
    }

    .header-left {
      display: flex;
      align-items: baseline;
      gap: 0.75rem;
    }

    .page-title {
      margin: 0;
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--rws-text);
    }

    .result-count {
      font-size: 0.8125rem;
      color: var(--rws-text-muted);
      font-weight: 500;
      transition: opacity 150ms ease;
    }
    .result-count.hidden { opacity: 0; }

    .btn-mark-all {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.375rem 0.75rem;
      border: 1px solid var(--rws-border);
      border-radius: var(--rws-radius);
      background: #fff;
      color: var(--rws-text);
      font-size: 0.8125rem;
      font-weight: 500;
      cursor: pointer;
      font-family: inherit;
      transition: border-color 150ms ease, color 150ms ease;
    }
    .btn-mark-all:hover { border-color: var(--rws-accent); color: var(--rws-accent); }
    .btn-mark-all:focus-visible { outline: 3px solid var(--rws-focus-ring); outline-offset: 2px; }

    .icon-sm { width: 14px; height: 14px; }
    .icon-xs { width: 13px; height: 13px; }

    /* ── Filter Bar ──────────────────────────────────────── */

    .filter-bar {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      padding: 1rem 1.25rem;
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
      margin-bottom: 1rem;
    }

    .filter-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .chip {
      appearance: none;
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.375rem 0.875rem;
      border: 1px solid var(--rws-border);
      border-radius: 999px;
      background: #fff;
      color: var(--rws-text);
      font-size: 0.8125rem;
      font-weight: 500;
      font-family: inherit;
      cursor: pointer;
      transition: all 150ms ease;
    }
    .chip:hover { border-color: var(--rws-accent); color: var(--rws-accent); }
    .chip.active {
      background: var(--rws-accent);
      border-color: var(--rws-accent);
      color: #fff;
    }
    .chip:focus-visible { outline: 3px solid var(--rws-focus-ring); outline-offset: 2px; }

    .custom-range {
      display: flex;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .range-label {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--rws-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .date-input {
      appearance: none;
      padding: 0.375rem 0.625rem;
      border: 1px solid var(--rws-border);
      border-radius: var(--rws-radius);
      font-size: 0.8125rem;
      font-family: inherit;
      color: var(--rws-text);
      background: #fff;
      transition: border-color 150ms ease;
    }
    .date-input:focus { outline: none; border-color: var(--rws-accent); box-shadow: 0 0 0 3px rgba(19, 141, 158, 0.12); }

    /* ── Empty State ─────────────────────────────────────── */

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 4rem 2rem;
      text-align: center;
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
    }
    .empty-icon { width: 48px; height: 48px; color: var(--rws-text-muted); opacity: 0.4; margin-bottom: 1rem; }
    .empty-text { margin: 0 0 0.375rem; font-size: 1.0625rem; font-weight: 500; color: var(--rws-text); }
    .empty-sub { margin: 0; font-size: 0.875rem; color: var(--rws-text-muted); }

    /* ── Alert List ──────────────────────────────────────── */

    .alert-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .alert-item {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      padding: 1rem 1.25rem;
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
      cursor: pointer;
      transition: background 150ms ease;
      position: relative;
    }
    .alert-item:hover { background: #fafbfc; }
    .alert-item.unread { background: #f8fbff; border-left: 3px solid var(--rws-accent); }

    .alert-severity {
      display: inline-flex;
      align-items: center;
      padding: 0.25rem 0.625rem;
      border-radius: 999px;
      font-size: 0.6875rem;
      font-weight: 600;
      text-transform: capitalize;
      flex-shrink: 0;
      margin-top: 0.125rem;
    }
    .severity-info { background: #e8f1fb; color: #2b3a67; }
    .severity-warning { background: #fef3e2; color: #92610a; }
    .severity-critical { background: #fde8e8; color: #b91c1c; }

    .alert-content { flex: 1; min-width: 0; }

    .alert-type {
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--rws-text-muted);
    }

    .alert-message {
      margin: 0.25rem 0 0;
      font-size: 0.9375rem;
      color: var(--rws-text);
      line-height: 1.4;
    }

    .alert-time { font-size: 0.75rem; color: var(--rws-text-muted); }

    .unread-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--rws-accent);
      flex-shrink: 0;
      margin-top: 0.375rem;
    }

    /* ── Pagination ──────────────────────────────────────── */

    .pagination-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem 1.25rem;
      margin-top: 0.75rem;
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
    }

    .pagination-info {
      font-size: 0.8125rem;
      color: var(--rws-text-muted);
    }

    .pagination-controls {
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }

    .page-btn, .page-num {
      appearance: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 32px;
      height: 32px;
      padding: 0 0.5rem;
      border: 1px solid var(--rws-border);
      border-radius: 6px;
      background: #fff;
      color: var(--rws-text);
      font-size: 0.8125rem;
      font-weight: 500;
      font-family: inherit;
      cursor: pointer;
      transition: all 120ms ease;
    }
    .page-btn:hover:not(:disabled), .page-num:hover { background: var(--rws-bg); border-color: #b0b8c4; }
    .page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .page-num.active {
      background: var(--rws-accent);
      border-color: var(--rws-accent);
      color: #fff;
    }

    /* ── Skeleton ─────────────────────────────────────────── */

    .sk-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .sk-row-lg {
      height: 72px;
      border-radius: 12px;
      background: linear-gradient(90deg, #f0f2f5 25%, #e8eaed 50%, #f0f2f5 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
    }

    @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

    @media (max-width: 640px) {
      .page-header { flex-direction: column; align-items: flex-start; gap: 0.75rem; }
      .filter-chips { gap: 0.375rem; }
      .chip { padding: 0.3125rem 0.625rem; font-size: 0.75rem; }
      .custom-range { flex-direction: column; }
      .pagination-bar { flex-direction: column; gap: 0.625rem; }
    }

    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { animation-duration: 0.01ms !important; }
    }
  `],
})
export class EmployeeAlertsComponent implements OnInit, OnDestroy {
  private readonly alertsService = inject(AlertsService);
  private readonly realtime = inject(RealtimeService);

  protected readonly alerts = signal<Alert[]>([]);
  protected readonly total = signal(0);
  protected readonly unreadCount = signal(0);
  protected readonly loading = signal(true);
  protected readonly currentPage = signal(1);
  protected readonly pageSize = 20;

  protected readonly activePreset = signal<FilterPreset>('today');
  protected readonly customFrom = signal('');
  protected readonly customTo = signal('');

  protected readonly filterPresets = [
    { key: 'today' as FilterPreset, label: 'Today' },
    { key: 'yesterday' as FilterPreset, label: 'Yesterday' },
    { key: '7d' as FilterPreset, label: 'Last 7 Days' },
    { key: '30d' as FilterPreset, label: 'Last 30 Days' },
  ];

  protected readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize)));
  protected readonly rangeStart = computed(() => (this.currentPage() - 1) * this.pageSize + 1);
  protected readonly rangeEnd = computed(() => Math.min(this.currentPage() * this.pageSize, this.total()));

  protected readonly visiblePages = computed(() => {
    const total = this.totalPages();
    const current = this.currentPage();
    const pages: number[] = [];
    if (total <= 5) {
      for (let i = 1; i <= total; i++) pages.push(i);
    } else {
      let start = Math.max(1, current - 2);
      let end = Math.min(total, start + 4);
      if (end - start < 4) start = Math.max(1, end - 4);
      for (let i = start; i <= end; i++) pages.push(i);
    }
    return pages;
  });

  protected readonly emptyMessage = computed(() => {
    const p = this.activePreset();
    if (p === 'today') return 'No alerts for today. You\'re all clear!';
    if (p === 'yesterday') return 'No alerts from yesterday.';
    if (p === '7d') return 'No alerts in the last 7 days.';
    if (p === '30d') return 'No alerts in the last 30 days.';
    return 'No alerts found for this date range.';
  });

  private alertSub?: Subscription;

  ngOnInit(): void {
    this.loadAlerts();
    this.subscribeToRealtime();
  }

  ngOnDestroy(): void {
    this.alertSub?.unsubscribe();
  }

  onPresetChange(preset: FilterPreset): void {
    this.activePreset.set(preset);
    this.currentPage.set(1);
    if (preset !== 'custom') {
      this.customFrom.set('');
      this.customTo.set('');
      this.loadAlerts();
    }
  }

  onCustomFromChange(event: Event): void {
    this.customFrom.set((event.target as HTMLInputElement).value);
    if (this.customFrom() && this.customTo()) {
      this.currentPage.set(1);
      this.loadAlerts();
    }
  }

  onCustomToChange(event: Event): void {
    this.customTo.set((event.target as HTMLInputElement).value);
    if (this.customFrom() && this.customTo()) {
      this.currentPage.set(1);
      this.loadAlerts();
    }
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
      this.loadAlerts();
    }
  }

  private loadAlerts(): void {
    this.loading.set(true);
    const params: any = {
      limit: this.pageSize,
      page: this.currentPage(),
    };

    if (this.activePreset() === 'custom') {
      if (this.customFrom()) params.from = this.customFrom();
      if (this.customTo()) params.to = this.customTo();
    } else {
      params.period = this.activePreset();
    }

    this.alertsService.getMyAlerts(params).subscribe({
      next: (res) => {
        this.alerts.set(res.alerts);
        this.total.set(res.total);
        this.unreadCount.set(res.unreadCount);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private subscribeToRealtime(): void {
    this.alertSub = this.realtime.alertCreated$.subscribe((event: AlertCreatedEvent) => {
      if (this.activePreset() !== 'today') return;

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

      this.alerts.update((list) => [newAlert, ...list]);
      this.total.update((t) => t + 1);
      this.unreadCount.update((c) => c + 1);
    });
  }

  handleMarkRead(alert: Alert): void {
    if (alert.isRead) return;
    this.alertsService.markRead(alert.id).subscribe({
      next: () => {
        this.alerts.update((list) => list.map((a) => a.id === alert.id ? { ...a, isRead: true } : a));
        this.unreadCount.update((c) => Math.max(0, c - 1));
      },
    });
  }

  handleMarkAllRead(): void {
    this.alertsService.markAllRead().subscribe({
      next: () => {
        this.alerts.update((list) => list.map((a) => ({ ...a, isRead: true })));
        this.unreadCount.set(0);
      },
    });
  }
}
