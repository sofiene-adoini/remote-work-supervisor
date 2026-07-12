import { Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { LucideBell } from '@lucide/angular';
import { HrAlertsService } from '../services/hr-alerts.service';
import { HrAlert } from '../models/hr.models';

@Component({
  selector: 'app-hr-alerts',
  imports: [DatePipe, LucideBell],
  template: `
    <div class="page-header">
      <h2 class="page-heading">System Alerts</h2>
    </div>

    @if (loading()) {
      <div class="card">
        <div class="skeleton-list">
          @for (i of [1,2,3,4]; track i) {
            <div class="skeleton skeleton-row"></div>
          }
        </div>
      </div>
    } @else if (alerts().length === 0) {
      <div class="empty-state">
        <svg lucideBell class="empty-icon"></svg>
        <p class="empty-title">No alerts</p>
        <p class="empty-sub">System alerts will appear here.</p>
      </div>
    } @else {
      <div class="card">
        <div class="alert-list">
          @for (alert of alerts(); track alert.id) {
            <div class="alert-row" [class.unread]="!alert.read">
              <div class="alert-dot" [class]="'dot-' + alert.severity"></div>
              <div class="alert-body">
                <div class="alert-top">
                  <span class="alert-type">{{ alert.type }}</span>
                  <span class="alert-time">{{ alert.createdAt | date:'short' }}</span>
                </div>
                <p class="alert-message">{{ alert.message }}</p>
                @if (alert.user) {
                  <span class="alert-user">{{ alert.user.fullName }}</span>
                }
              </div>
            </div>
          }
        </div>
      </div>
    }
  `,
  styles: [`
    @use 'styles/design-tokens' as t;

    .page-header { margin-bottom: 1.5rem; }
    .page-heading { margin: 0; font-size: 1.375rem; font-weight: 700; color: var(--rws-text); }

    .card {
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
    }

    .alert-list {
      display: flex;
      flex-direction: column;
    }

    .alert-row {
      display: flex;
      gap: 0.75rem;
      padding: 1rem;
      border-bottom: 1px solid #f0f2f5;
      transition: background-color 150ms ease;

      &:last-child { border-bottom: none; }
      &.unread { background: #fafbfc; }
      &:hover { background: #fafbfc; }
    }

    .alert-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      margin-top: 0.375rem;
      flex-shrink: 0;

      &.dot-info { background: #3b82f6; }
      &.dot-warning { background: #d9973b; }
      &.dot-error { background: #d64545; }
      &.dot-success { background: #1fb6a6; }
    }

    .alert-body { flex: 1; min-width: 0; }

    .alert-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      margin-bottom: 0.25rem;
    }

    .alert-type {
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--rws-primary);
    }

    .alert-time {
      font-size: 0.6875rem;
      color: var(--rws-text-muted);
    }

    .alert-message {
      margin: 0;
      font-size: 0.875rem;
      color: var(--rws-text);
      line-height: 1.4;
    }

    .alert-user {
      font-size: 0.75rem;
      color: var(--rws-text-muted);
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 4rem 0;
      text-align: center;
    }

    .empty-icon { width: 48px; height: 48px; color: var(--rws-text-muted); opacity: 0.4; margin-bottom: 1rem; }
    .empty-title { margin: 0 0 0.375rem; font-size: 1.125rem; font-weight: 600; color: var(--rws-text); }
    .empty-sub { margin: 0; font-size: 0.875rem; color: var(--rws-text-muted); }

    .skeleton { background: linear-gradient(90deg, #f0f2f5 25%, #e8eaed 50%, #f0f2f5 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; border-radius: 6px; }
    .skeleton-list { display: flex; flex-direction: column; gap: 0.75rem; padding: 1rem; }
    .skeleton-row { height: 60px; }
    @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
  `],
})
export class HrAlertsComponent implements OnInit {
  private readonly alertsService = inject(HrAlertsService);
  protected readonly alerts = signal<HrAlert[]>([]);
  protected readonly loading = signal(true);

  ngOnInit(): void {
    this.alertsService.getAllAlerts(50).subscribe({
      next: (res) => {
        this.alerts.set(res.alerts);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
