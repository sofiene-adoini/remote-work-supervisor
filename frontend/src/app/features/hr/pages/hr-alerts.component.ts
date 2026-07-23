import { Component, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { LucideCheck, LucideBell } from '@lucide/angular';
import { Subscription } from 'rxjs';
import { HrAlertsService } from '../services/hr-alerts.service';
import { HrAlert } from '../models/hr.models';
import { RealtimeService, AlertCreatedEvent } from '../../../core/services/realtime.service';

@Component({
  selector: 'app-hr-alerts',
  imports: [DatePipe, LucideCheck, LucideBell],
  template: `
    <div class="page-container">
      <div class="page-header">
        <h1 class="page-title">System Alerts</h1>
        @if (unreadCount() > 0) {
          <button class="btn-mark-all" type="button" (click)="handleMarkAllRead()">
            <svg lucideCheck class="icon-sm" aria-hidden="true"></svg>
            Mark all read
          </button>
        }
      </div>

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
          <p class="empty-sub">System alerts will appear here.</p>
        </div>
      } @else {
        <div class="alert-list">
          @for (alert of alerts(); track alert.id) {
            <div class="alert-item" [class.unread]="!alert.isRead" (click)="handleMarkRead(alert)">
              <div class="alert-severity" [class]="'severity-' + alert.severity">
                <span class="severity-label">{{ alert.severity }}</span>
              </div>
              <div class="alert-content">
                <span class="alert-type">{{ alert.title }}</span>
                <p class="alert-message">{{ alert.message }}</p>
                <div class="alert-meta">
                  <span class="alert-time">{{ alert.createdAt | date:'medium' }}</span>
                  @if (alert.user) {
                    <span class="alert-user">{{ alert.user.fullName }}</span>
                  }
                </div>
              </div>
              @if (!alert.isRead) {
                <span class="unread-dot"></span>
              }
            </div>
          }
        </div>
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
      margin-bottom: 1.5rem;
    }

    .page-title {
      margin: 0;
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--rws-text);
    }

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

      &:hover { border-color: var(--rws-accent); color: var(--rws-accent); }
      &:focus-visible { outline: 3px solid var(--rws-focus-ring); outline-offset: 2px; }
    }

    .icon-sm { width: 14px; height: 14px; }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 4rem 2rem;
      text-align: center;
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    }

    .empty-icon { width: 48px; height: 48px; color: var(--rws-text-muted); opacity: 0.4; margin-bottom: 1rem; }
    .empty-text { margin: 0 0 0.375rem; font-size: 1.0625rem; font-weight: 500; color: var(--rws-text); }
    .empty-sub { margin: 0; font-size: 0.875rem; color: var(--rws-text-muted); }

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
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
      cursor: pointer;
      transition: background 150ms ease;
      position: relative;

      &:hover { background: #fafbfc; }
      &.unread { background: #f8fbff; border-left: 3px solid var(--rws-accent); }
    }

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

      &.severity-info { background: #e8f1fb; color: #2b3a67; }
      &.severity-warning { background: #fef3e2; color: #92610a; }
      &.severity-critical { background: #fde8e8; color: #b91c1c; }
    }

    .alert-content {
      flex: 1;
      min-width: 0;
    }

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

    .alert-meta {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-top: 0.375rem;
    }

    .alert-time {
      font-size: 0.75rem;
      color: var(--rws-text-muted);
    }

    .alert-user {
      font-size: 0.75rem;
      color: var(--rws-primary);
      font-weight: 500;
    }

    .unread-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--rws-accent);
      flex-shrink: 0;
      margin-top: 0.375rem;
    }

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

    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { animation-duration: 0.01ms !important; }
    }
  `],
})
export class HrAlertsComponent implements OnInit, OnDestroy {
  private readonly alertsService = inject(HrAlertsService);
  private readonly realtime = inject(RealtimeService);

  protected readonly alerts = signal<HrAlert[]>([]);
  protected readonly unreadCount = signal(0);
  protected readonly loading = signal(true);

  private alertSub?: Subscription;

  ngOnInit(): void {
    this.loadAlerts();
    this.subscribeToRealtime();
  }

  ngOnDestroy(): void {
    this.alertSub?.unsubscribe();
  }

  private loadAlerts(): void {
    this.alertsService.getAllAlerts(50).subscribe({
      next: (res) => {
        this.alerts.set(res.alerts);
        this.unreadCount.set(res.alerts.filter((a) => !a.isRead).length);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private subscribeToRealtime(): void {
    this.alertSub = this.realtime.alertCreated$.subscribe((event: AlertCreatedEvent) => {
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

      this.alerts.update((list) => [newAlert, ...list]);
      this.unreadCount.update((c) => c + 1);
    });
  }

  handleMarkRead(alert: HrAlert): void {
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
