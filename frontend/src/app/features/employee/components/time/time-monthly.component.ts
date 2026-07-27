import { Component, computed, input, signal, OnInit, OnDestroy } from '@angular/core';
import { DecimalPipe, DatePipe } from '@angular/common';
import { LucideChevronLeft, LucideChevronRight } from '@lucide/angular';

import {
  MonthlyStats,
  CompanyWorkPolicy,
} from '../../models/employee.models';

export interface CalendarDay {
  date: Date;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  isWorkingDay: boolean;
  workedHours: number;
  breakMinutes: number;
  totalMinutes: number;
  attendanceStatus: 'full' | 'partial' | 'light' | 'none' | 'weekend';
  sessions: { clockIn: string; clockOut: string | null; totalBreakMinutes: number; workedMinutes: number }[];
}

@Component({
  selector: 'app-time-monthly',
  imports: [DecimalPipe, DatePipe, LucideChevronLeft, LucideChevronRight],
  template: `
    <div class="monthly-card">
      <!-- Header -->
      <div class="monthly-header">
        <div class="header-left">
          <button
            class="nav-btn"
            (click)="prevMonth()"
            [disabled]="loading()"
            aria-label="Previous month">
            <svg lucideChevronLeft class="icon-sm" aria-hidden="true"></svg>
          </button>
          <h3 class="month-label">{{ monthYearLabel() }}</h3>
          <button
            class="nav-btn"
            (click)="nextMonth()"
            [disabled]="loading()"
            aria-label="Next month">
            <svg lucideChevronRight class="icon-sm" aria-hidden="true"></svg>
          </button>
        </div>

        @if (!loading() && monthlyStats()) {
          <div class="header-stats">
            <div class="stat">
              <span class="stat-value mono">{{ formatHours(monthlyStats()!.workedHours) }}</span>
              <span class="stat-label">Worked</span>
            </div>
            <div class="stat-divider"></div>
            <div class="stat">
              <span class="stat-value mono">{{ formatHours(monthlyStats()!.expectedHours) }}</span>
              <span class="stat-label">Expected</span>
            </div>
            <div class="stat-divider"></div>
            <div class="stat">
              <span class="stat-value mono">{{ monthlyStats()!.attendancePercentage | number:'1.0-1' }}%</span>
              <span class="stat-label">Attendance</span>
            </div>
          </div>
        }
      </div>

      <!-- Calendar Grid (desktop) -->
      <div class="calendar-section">
        @if (loading()) {
          <!-- Skeleton loading state -->
          <div class="calendar-grid skeleton-grid">
            <div class="weekday-header">
              @for (day of weekDays; track day) {
                <div class="weekday-cell">{{ day }}</div>
              }
            </div>
            <div class="days-grid">
              @for (cell of skeletonCells; track cell) {
                <div class="day-cell skeleton-cell">
                  <span class="skeleton-block sk-num"></span>
                  <span class="skeleton-block sk-text-sm"></span>
                </div>
              }
            </div>
          </div>
        } @else {
          <div class="calendar-grid">
            <div class="weekday-header">
              @for (day of weekDays; track day) {
                <div class="weekday-cell">{{ day }}</div>
              }
            </div>
            <div class="days-grid">
              @for (day of calendarDays(); track day.date.toISOString()) {
                <div
                  class="day-cell"
                  [class.today]="day.isToday"
                  [class.other-month]="!day.isCurrentMonth"
                  [class.weekend]="day.isWeekend"
                  [class.has-work]="day.workedHours > 0"
                  [class.heatmap-strong]="day.attendanceStatus === 'full'"
                  [class.heatmap-light]="day.attendanceStatus === 'partial'"
                  [class.heatmap-amber]="day.attendanceStatus === 'light'"
                  [class.heatmap-red]="day.attendanceStatus === 'none' && day.isWorkingDay && day.sessions.length > 0"
                  [class.heatmap-weekend]="day.attendanceStatus === 'weekend'"
                  (mouseenter)="showTooltip($event, day)"
                  (mouseleave)="hideTooltip()">
                  <span class="day-number" [class.today-number]="day.isToday">{{ day.dayNumber }}</span>
                  @if (day.workedHours > 0 && day.isCurrentMonth) {
                    <span class="day-hours mono">{{ formatHours(day.workedHours) }}</span>
                  }
                </div>
              }
            </div>
          </div>

          <!-- Mobile list view (hidden on desktop) -->
          <div class="mobile-list">
            @for (day of calendarDays(); track day.date.toISOString()) {
              @if (day.isCurrentMonth && !day.isWeekend) {
                <div
                  class="mobile-day-row"
                  [class.today]="day.isToday"
                  [class.heatmap-strong]="day.attendanceStatus === 'full'"
                  [class.heatmap-light]="day.attendanceStatus === 'partial'"
                  [class.heatmap-amber]="day.attendanceStatus === 'light'"
                  [class.heatmap-red]="day.attendanceStatus === 'none' && day.isWorkingDay && day.sessions.length > 0">
                  <div class="mobile-day-left">
                    <span class="mobile-day-num" [class.today-number]="day.isToday">{{ day.dayNumber }}</span>
                    <span class="mobile-day-name">{{ day.date | date:'EEE' }}</span>
                  </div>
                  <div class="mobile-day-right">
                    @if (day.workedHours > 0) {
                      <span class="mobile-hours mono">{{ formatHours(day.workedHours) }}</span>
                    } @else {
                      <span class="mobile-hours muted">—</span>
                    }
                    <span class="mobile-status-dot" [class]="'dot-' + day.attendanceStatus"></span>
                  </div>
                </div>
              }
            }
          </div>
        }
      </div>

      <!-- Summary Row -->
      @if (!loading() && monthlyStats()) {
        <div class="summary-row">
          <div class="summary-item">
            <span class="summary-icon green-icon"></span>
            <span class="summary-label">Avg Daily</span>
            <span class="summary-value mono">{{ formatHours(monthlyStats()!.averageDailyHours) }}</span>
          </div>
          <div class="summary-divider"></div>
          <div class="summary-item">
            <span class="summary-icon teal-icon"></span>
            <span class="summary-label">Attendance</span>
            <span class="summary-value mono">{{ monthlyStats()!.attendancePercentage | number:'1.0-1' }}%</span>
          </div>
          <div class="summary-divider"></div>
          <div class="summary-item">
            <span class="summary-icon gold-icon"></span>
            <span class="summary-label">Productive</span>
            <span class="summary-value mono">{{ monthlyStats()!.productivePercentage | number:'1.0-1' }}%</span>
          </div>
          @if (monthlyStats()!.overtimeHours > 0) {
            <div class="summary-divider"></div>
            <div class="summary-item">
              <span class="summary-icon amber-icon"></span>
              <span class="summary-label">Overtime</span>
              <span class="summary-value mono overtime">+{{ formatHours(monthlyStats()!.overtimeHours) }}</span>
            </div>
          }
          @if (monthlyStats()!.missingHours > 0) {
            <div class="summary-divider"></div>
            <div class="summary-item">
              <span class="summary-icon red-icon"></span>
              <span class="summary-label">Missing</span>
              <span class="summary-value mono missing">-{{ formatHours(monthlyStats()!.missingHours) }}</span>
            </div>
          }
        </div>
      }

      <!-- Legend -->
      @if (!loading()) {
        <div class="legend">
          <div class="legend-item">
            <span class="legend-swatch swatch-strong"></span>
            <span class="legend-text">&ge;8h</span>
          </div>
          <div class="legend-item">
            <span class="legend-swatch swatch-light"></span>
            <span class="legend-text">6-8h</span>
          </div>
          <div class="legend-item">
            <span class="legend-swatch swatch-amber"></span>
            <span class="legend-text">4-6h</span>
          </div>
          <div class="legend-item">
            <span class="legend-swatch swatch-red"></span>
            <span class="legend-text">&lt;4h</span>
          </div>
          <div class="legend-item">
            <span class="legend-swatch swatch-none"></span>
            <span class="legend-text">No work</span>
          </div>
        </div>
      }
    </div>

    <!-- Tooltip -->
    @if (tooltipVisible()) {
      <div
        class="tooltip"
        [style.left.px]="tooltipX()"
        [style.top.px]="tooltipY()">
        <div class="tooltip-date">{{ tooltipDay()?.date | date:'EEE, MMM d' }}</div>
        <div class="tooltip-row">
          <span class="tooltip-label">Worked</span>
          <span class="tooltip-value mono">{{ formatHours(tooltipDay()?.workedHours ?? 0) }}</span>
        </div>
        @if ((tooltipDay()?.breakMinutes ?? 0) > 0) {
          <div class="tooltip-row">
            <span class="tooltip-label">Break</span>
            <span class="tooltip-value mono">{{ tooltipDay()!.breakMinutes }}m</span>
          </div>
        }
        <div class="tooltip-row">
          <span class="tooltip-label">Status</span>
          <span class="tooltip-value" [class]="tooltipStatusClass()">
            {{ tooltipStatusLabel() }}
          </span>
        </div>
      </div>
    }
  `,
  styles: [`
    @use 'styles/design-tokens' as t;

    :host {
      display: block;
    }

    .monthly-card {
      background: var(--rws-card, #fff);
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04);
      overflow: hidden;
      transition: box-shadow 200ms ease;
    }

    .monthly-card:hover {
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.04);
    }

    /* ── Header ──────────────────────────────────────────────── */

    .monthly-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1.25rem 1.5rem;
      border-bottom: 1px solid var(--rws-border, #d6dce5);
      background: linear-gradient(135deg, rgba(11, 74, 90, 0.02), rgba(19, 141, 158, 0.02));
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .month-label {
      margin: 0;
      font-size: 1.125rem;
      font-weight: 700;
      color: var(--rws-primary, #0B4A5A);
      letter-spacing: -0.01em;
      min-width: 180px;
      text-align: center;
    }

    .nav-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: 8px;
      border: 1px solid var(--rws-border, #d6dce5);
      background: #fff;
      color: var(--rws-text-muted, #6b7280);
      cursor: pointer;
      transition: all 150ms ease;
    }

    .nav-btn:hover:not(:disabled) {
      background: var(--rws-bg, #f5f3f0);
      color: var(--rws-text, #1a1d23);
      border-color: #b0b8c4;
    }

    .nav-btn:active:not(:disabled) {
      transform: scale(0.95);
    }

    .nav-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .nav-btn:focus-visible {
      outline: 2px solid var(--rws-accent, #138D9E);
      outline-offset: 2px;
    }

    .header-stats {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .stat {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
    }

    .stat-value {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--rws-text, #1a1d23);
    }

    .stat-label {
      font-size: 0.6875rem;
      color: var(--rws-text-muted, #6b7280);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-weight: 600;
    }

    .stat-divider {
      width: 1px;
      height: 28px;
      background: var(--rws-border, #d6dce5);
    }

    .mono {
      font-family: var(--rws-font-mono, 'IBM Plex Mono', monospace);
    }

    /* ── Calendar Grid ───────────────────────────────────────── */

    .calendar-section {
      padding: 1.25rem 1.5rem 1rem;
    }

    .calendar-grid {
      width: 100%;
    }

    .weekday-header {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 4px;
      margin-bottom: 4px;
    }

    .weekday-cell {
      text-align: center;
      font-size: 0.6875rem;
      font-weight: 700;
      color: var(--rws-text-muted, #6b7280);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      padding: 0.375rem 0;
    }

    .days-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 4px;
    }

    .day-cell {
      position: relative;
      aspect-ratio: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 2px;
      border-radius: 8px;
      border: 1.5px solid transparent;
      background: var(--rws-bg, #f5f3f0);
      cursor: default;
      transition: all 120ms ease;
      min-height: 52px;
    }

    .day-cell:not(.other-month):hover {
      border-color: var(--rws-border, #d6dce5);
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
      transform: translateY(-1px);
    }

    .day-cell.other-month {
      background: transparent;
      border-color: transparent;
      opacity: 0.3;
    }

    .day-cell.weekend {
      background: rgba(245, 243, 240, 0.5);
    }

    .day-cell.other-month.weekend {
      background: transparent;
    }

    .day-cell.today {
      border-color: var(--rws-accent, #138D9E);
      border-width: 2px;
      box-shadow: 0 0 0 3px rgba(19, 141, 158, 0.12);
    }

    .day-number {
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--rws-text, #1a1d23);
      line-height: 1;
    }

    .day-number.today-number {
      color: var(--rws-accent, #138D9E);
      font-weight: 700;
    }

    .day-hours {
      font-size: 0.625rem;
      font-weight: 500;
      color: var(--rws-text-muted, #6b7280);
      line-height: 1;
    }

    /* ── Heatmap Colors ──────────────────────────────────────── */

    .day-cell.heatmap-strong {
      background: rgba(46, 158, 108, 0.12);
    }

    .day-cell.heatmap-strong .day-hours {
      color: #1a7a52;
      font-weight: 600;
    }

    .day-cell.heatmap-light {
      background: rgba(46, 158, 108, 0.06);
    }

    .day-cell.heatmap-light .day-hours {
      color: #2e9e6c;
    }

    .day-cell.heatmap-amber {
      background: rgba(194, 146, 79, 0.10);
    }

    .day-cell.heatmap-amber .day-hours {
      color: #a07430;
    }

    .day-cell.heatmap-red {
      background: rgba(163, 29, 29, 0.08);
    }

    .day-cell.heatmap-red .day-hours {
      color: #A31D1D;
    }

    /* ── Summary Row ─────────────────────────────────────────── */

    .summary-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 1.25rem;
      padding: 0.875rem 1.5rem;
      border-top: 1px solid var(--rws-border, #d6dce5);
      background: var(--rws-bg, #f5f3f0);
      flex-wrap: wrap;
    }

    .summary-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .summary-icon {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .green-icon { background: var(--rws-success, #2e9e6c); }
    .teal-icon { background: var(--rws-accent, #138D9E); }
    .gold-icon { background: var(--rws-gold, #C2924F); }
    .amber-icon { background: #d97706; }
    .red-icon { background: var(--rws-error, #A31D1D); }

    .summary-label {
      font-size: 0.75rem;
      font-weight: 500;
      color: var(--rws-text-muted, #6b7280);
    }

    .summary-value {
      font-size: 0.8125rem;
      font-weight: 700;
      color: var(--rws-text, #1a1d23);
    }

    .summary-value.overtime {
      color: var(--rws-gold, #C2924F);
    }

    .summary-value.missing {
      color: var(--rws-error, #A31D1D);
    }

    .summary-divider {
      width: 1px;
      height: 20px;
      background: var(--rws-border, #d6dce5);
    }

    /* ── Legend ───────────────────────────────────────────────── */

    .legend {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.875rem;
      padding: 0.625rem 1.5rem 1rem;
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 0.375rem;
    }

    .legend-swatch {
      width: 12px;
      height: 12px;
      border-radius: 3px;
    }

    .swatch-strong { background: rgba(46, 158, 108, 0.18); }
    .swatch-light { background: rgba(46, 158, 108, 0.08); }
    .swatch-amber { background: rgba(194, 146, 79, 0.14); }
    .swatch-red { background: rgba(163, 29, 29, 0.12); }
    .swatch-none { background: var(--rws-bg, #f5f3f0); border: 1px solid var(--rws-border, #d6dce5); }

    .legend-text {
      font-size: 0.6875rem;
      color: var(--rws-text-muted, #6b7280);
      font-weight: 500;
    }

    /* ── Skeleton Loading ────────────────────────────────────── */

    .skeleton-grid {
      pointer-events: none;
    }

    .skeleton-cell {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
    }

    .skeleton-block {
      display: inline-block;
      background: linear-gradient(90deg, var(--rws-bg, #f5f3f0) 25%, rgba(214, 220, 229, 0.4) 50%, var(--rws-bg, #f5f3f0) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
      border-radius: 4px;
    }

    .sk-num {
      width: 18px;
      height: 14px;
    }

    .sk-text-sm {
      width: 28px;
      height: 10px;
    }

    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    /* ── Tooltip ─────────────────────────────────────────────── */

    .tooltip {
      position: fixed;
      z-index: 1000;
      background: var(--rws-primary, #0B4A5A);
      color: #fff;
      border-radius: 8px;
      padding: 0.625rem 0.75rem;
      pointer-events: none;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
      min-width: 140px;
      animation: tooltip-in 120ms ease;
    }

    @keyframes tooltip-in {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .tooltip-date {
      font-size: 0.75rem;
      font-weight: 700;
      margin-bottom: 0.375rem;
      padding-bottom: 0.375rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.15);
    }

    .tooltip-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      font-size: 0.6875rem;
      line-height: 1.6;
    }

    .tooltip-label {
      color: rgba(255, 255, 255, 0.7);
    }

    .tooltip-value {
      font-weight: 600;
    }

    .tooltip-value.status-full { color: #86efac; }
    .tooltip-value.status-partial { color: #a7f3d0; }
    .tooltip-value.status-light { color: #fcd34d; }
    .tooltip-value.status-none { color: #fca5a5; }
    .tooltip-value.status-weekend { color: rgba(255, 255, 255, 0.5); }

    /* ── Icons ───────────────────────────────────────────────── */

    .icon-sm {
      width: 16px;
      height: 16px;
    }

    /* ── Mobile list (hidden on desktop) ─────────────────────── */

    .mobile-list {
      display: none;
    }

    .mobile-day-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.625rem 0.75rem;
      border-radius: var(--rws-radius, 8px);
      border: 1px solid var(--rws-border, #d6dce5);
      background: #fff;
      transition: background 120ms ease;
    }

    .mobile-day-row.today {
      border-color: var(--rws-accent, #138D9E);
      border-width: 2px;
      background: rgba(19, 141, 158, 0.04);
    }

    .mobile-day-row.heatmap-strong { background: rgba(46, 158, 108, 0.08); }
    .mobile-day-row.heatmap-light { background: rgba(46, 158, 108, 0.04); }
    .mobile-day-row.heatmap-amber { background: rgba(194, 146, 79, 0.07); }
    .mobile-day-row.heatmap-red { background: rgba(163, 29, 29, 0.06); }

    .mobile-day-left {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .mobile-day-num {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--rws-text, #1a1d23);
      min-width: 20px;
    }

    .mobile-day-num.today-number {
      color: var(--rws-accent, #138D9E);
      font-weight: 700;
    }

    .mobile-day-name {
      font-size: 0.75rem;
      color: var(--rws-text-muted, #6b7280);
      font-weight: 500;
    }

    .mobile-day-right {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .mobile-hours {
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--rws-text, #1a1d23);
    }

    .mobile-hours.muted {
      color: var(--rws-text-muted, #6b7280);
    }

    .mobile-status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .dot-full { background: var(--rws-success, #2e9e6c); }
    .dot-partial { background: rgba(46, 158, 108, 0.6); }
    .dot-light { background: var(--rws-gold, #C2924F); }
    .dot-none { background: var(--rws-error, #A31D1D); }
    .dot-weekend { background: var(--rws-border, #d6dce5); }

    /* ── Responsive ──────────────────────────────────────────── */

    @media (max-width: 768px) {
      .monthly-header {
        flex-direction: column;
        align-items: stretch;
        gap: 1rem;
        padding: 1rem 1.25rem;
      }

      .header-left {
        justify-content: center;
      }

      .header-stats {
        justify-content: space-between;
        width: 100%;
      }

      .stat-divider {
        height: 24px;
      }

      .calendar-section {
        padding: 1rem;
      }

      .calendar-grid {
        display: none;
      }

      .mobile-list {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .summary-row {
        gap: 0.75rem;
        padding: 0.75rem 1.25rem;
      }

      .summary-divider {
        display: none;
      }

      .summary-item {
        flex: 1 1 40%;
        justify-content: center;
      }

      .legend {
        gap: 0.5rem;
        flex-wrap: wrap;
      }
    }

    @media (max-width: 480px) {
      .month-label {
        min-width: auto;
        font-size: 1rem;
      }

      .header-stats {
        gap: 0.625rem;
      }

      .stat-value {
        font-size: 0.8125rem;
      }

      .summary-item {
        flex: 1 1 100%;
        justify-content: center;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .skeleton-block { animation: none; }
      .tooltip { animation: none; }
      .day-cell:not(.other-month):hover { transform: none; }
    }
  `],
})
export class TimeMonthlyComponent implements OnInit, OnDestroy {
  readonly monthlyStats = input<MonthlyStats | null>(null);
  readonly dailySessions = input<{ clockIn: string; clockOut: string | null; totalBreakMinutes: number; workedMinutes: number; date?: string }[]>([]);
  readonly policy = input<CompanyWorkPolicy | null>(null);
  readonly loading = input<boolean>(false);

  readonly currentMonth = signal(new Date().getMonth());
  readonly currentYear = signal(new Date().getFullYear());
  readonly tooltipVisible = signal(false);
  readonly tooltipX = signal(0);
  readonly tooltipY = signal(0);
  readonly tooltipDay = signal<CalendarDay | null>(null);

  readonly weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  readonly skeletonCells = Array.from({ length: 35 }, (_, i) => i);

  private today = new Date();

  readonly monthYearLabel = computed(() => {
    const date = new Date(this.currentYear(), this.currentMonth(), 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  });

  readonly calendarDays = computed<CalendarDay[]>(() => {
    const year = this.currentYear();
    const month = this.currentMonth();
    const sessions = this.dailySessions();
    const policy = this.policy();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startOffset = (firstDay.getDay() + 6) % 7; // Monday-based

    const workingDays = new Set(
      (policy?.workingDays ?? ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']).map(d => d.toLowerCase())
    );
    const dayNameMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

    const expectedHours = policy?.expectedDailyHours ?? 8;

    // Build sessions map by date string (YYYY-MM-DD)
    const sessionsByDate = new Map<string, typeof sessions>();
    for (const s of sessions) {
      const dateStr = s.date ?? this.extractDateStr(s.clockIn);
      if (!sessionsByDate.has(dateStr)) {
        sessionsByDate.set(dateStr, []);
      }
      sessionsByDate.get(dateStr)!.push(s);
    }

    const days: CalendarDay[] = [];

    // Previous month fill
    const prevMonth = new Date(year, month, 0);
    for (let i = startOffset - 1; i >= 0; i--) {
      const d = prevMonth.getDate() - i;
      const date = new Date(year, month - 1, d);
      const dayOfWeek = dayNameMap[date.getDay()];
      days.push({
        date,
        dayNumber: d,
        isCurrentMonth: false,
        isToday: false,
        isWeekend: date.getDay() === 0 || date.getDay() === 6,
        isWorkingDay: workingDays.has(dayOfWeek),
        workedHours: 0,
        breakMinutes: 0,
        totalMinutes: 0,
        attendanceStatus: 'weekend',
        sessions: [],
      });
    }

    // Current month days
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(year, month, d);
      const dateStr = this.formatDateStr(date);
      const daySessions = sessionsByDate.get(dateStr) ?? [];
      const dayOfWeek = dayNameMap[date.getDay()];
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      const isWorkingDay = workingDays.has(dayOfWeek);
      const isToday = this.isSameDay(date, this.today);

      let totalMinutes = 0;
      let totalBreak = 0;
      for (const s of daySessions) {
        totalMinutes += s.workedMinutes;
        totalBreak += s.totalBreakMinutes;
      }

      const workedHours = totalMinutes / 60;
      let attendanceStatus: CalendarDay['attendanceStatus'];

      if (isWeekend) {
        attendanceStatus = 'weekend';
      } else if (daySessions.length === 0) {
        attendanceStatus = 'none';
      } else if (workedHours >= expectedHours) {
        attendanceStatus = 'full';
      } else if (workedHours >= expectedHours * 0.75) {
        attendanceStatus = 'partial';
      } else if (workedHours >= expectedHours * 0.5) {
        attendanceStatus = 'light';
      } else {
        attendanceStatus = 'none';
      }

      days.push({
        date,
        dayNumber: d,
        isCurrentMonth: true,
        isToday,
        isWeekend,
        isWorkingDay,
        workedHours,
        breakMinutes: totalBreak,
        totalMinutes,
        attendanceStatus,
        sessions: daySessions,
      });
    }

    // Next month fill
    const remaining = 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      const date = new Date(year, month + 1, d);
      const dayOfWeek = dayNameMap[date.getDay()];
      days.push({
        date,
        dayNumber: d,
        isCurrentMonth: false,
        isToday: false,
        isWeekend: date.getDay() === 0 || date.getDay() === 6,
        isWorkingDay: workingDays.has(dayOfWeek),
        workedHours: 0,
        breakMinutes: 0,
        totalMinutes: 0,
        attendanceStatus: 'weekend',
        sessions: [],
      });
    }

    return days;
  });

  readonly tooltipStatusLabel = computed(() => {
    const day = this.tooltipDay();
    if (!day) return '';
    if (day.isWeekend) return 'Weekend';
    if (day.sessions.length === 0) return 'No work';
    if (day.attendanceStatus === 'full') return 'Completed';
    if (day.attendanceStatus === 'partial') return 'Partial';
    if (day.attendanceStatus === 'light') return 'Light';
    return 'Under hours';
  });

  readonly tooltipStatusClass = computed(() => {
    const day = this.tooltipDay();
    if (!day) return '';
    return 'status-' + day.attendanceStatus;
  });

  private _resizeHandler?: () => void;

  ngOnInit(): void {
    // No-op for now; tooltip positioning is handled in event handlers
  }

  ngOnDestroy(): void {
    this.hideTooltip();
  }

  prevMonth(): void {
    if (this.currentMonth() === 0) {
      this.currentMonth.set(11);
      this.currentYear.update(y => y - 1);
    } else {
      this.currentMonth.update(m => m - 1);
    }
  }

  nextMonth(): void {
    if (this.currentMonth() === 11) {
      this.currentMonth.set(0);
      this.currentYear.update(y => y + 1);
    } else {
      this.currentMonth.update(m => m + 1);
    }
  }

  showTooltip(event: MouseEvent, day: CalendarDay): void {
    this.tooltipDay.set(day);
    this.tooltipVisible.set(true);

    const rect = (event.target as HTMLElement).getBoundingClientRect();
    let x = rect.left + rect.width / 2;
    let y = rect.top - 8;

    // Keep tooltip within viewport
    x = Math.max(8, Math.min(x - 70, window.innerWidth - 156));
    y = Math.max(8, y - 100);

    this.tooltipX.set(x);
    this.tooltipY.set(y);
  }

  hideTooltip(): void {
    this.tooltipVisible.set(false);
    this.tooltipDay.set(null);
  }

  formatHours(hours: number | undefined | null): string {
    if (hours == null) return '0h';
    const h = Math.floor(Math.abs(hours));
    const m = Math.round((Math.abs(hours) - h) * 60);
    if (h === 0 && m === 0) return '0h';
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  }

  private formatDateStr(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private extractDateStr(isoStr: string): string {
    return isoStr.slice(0, 10);
  }

  private isSameDay(a: Date, b: Date): boolean {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }
}
