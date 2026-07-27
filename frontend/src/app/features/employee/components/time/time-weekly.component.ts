import { Component, computed, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { LucideAngularModule, Calendar, CheckCircle, AlertTriangle, Clock, Minus } from 'lucide-angular';
import { DayDetail, WeeklyStats } from '../../models/employee.models';

@Component({
  selector: 'app-time-weekly',
  standalone: true,
  imports: [DatePipe, LucideAngularModule],
  template: `
    <div class="weekly-card">
      <!-- Header -->
      <div class="weekly-header">
        <div class="header-title">
          <lucide-icon [img]="iconCalendar" [size]="20"></lucide-icon>
          <h3>This Week</h3>
        </div>
        @if (!loading() && weeklyStats()) {
          <div class="header-stats">
            <div class="stat">
              <span class="stat-value">{{ formatMinutes(workedMinutes()) }}</span>
              <span class="stat-label">Worked</span>
            </div>
            <div class="stat-divider"></div>
            <div class="stat">
              <span class="stat-value">{{ formatMinutes(expectedMinutes()) }}</span>
              <span class="stat-label">Expected</span>
            </div>
            <div class="stat-divider"></div>
            <div class="stat">
              <span class="stat-value">{{ weeklyStats()!.attendanceRate }}%</span>
              <span class="stat-label">Attendance</span>
            </div>
          </div>
        }
      </div>

      <!-- Table Header -->
      <div class="weekly-table-header">
        <span class="col-day">Day</span>
        <span class="col-worked">Worked</span>
        <span class="col-expected">Expected</span>
        <span class="col-diff">Difference</span>
        <span class="col-status">Status</span>
      </div>

      <!-- Body -->
      <div class="weekly-body">
        @if (loading()) {
          @for (i of skeletonRows; track i) {
            <div class="day-row skeleton-row">
              <span class="col-day"><span class="skeleton-block skeleton-text"></span></span>
              <span class="col-worked"><span class="skeleton-block skeleton-short"></span></span>
              <span class="col-expected"><span class="skeleton-block skeleton-short"></span></span>
              <span class="col-diff"><span class="skeleton-block skeleton-short"></span></span>
              <span class="col-status"><span class="skeleton-block skeleton-badge"></span></span>
            </div>
          }
        } @else if (weekDays().length === 0) {
          <div class="empty-state">
            <lucide-icon [img]="iconMinus" [size]="32"></lucide-icon>
            <p>No data for this week</p>
          </div>
        } @else {
          @for (day of weekDays(); track day.date; let i = $index) {
            <div
              class="day-row"
              [class.today]="isToday(day.date)"
              [class.alt]="i % 2 === 1"
            >
              <span class="col-day">
                <span class="day-name">{{ day.label }}</span>
                <span class="day-date">{{ formatDate(day.date) }}</span>
              </span>
              <span class="col-worked mono">{{ formatMinutes(day.totalWorkedMinutes) }}</span>
              <span class="col-expected mono muted">{{ formatMinutes(day.expectedMinutes) }}</span>
              <span class="col-diff mono" [class]="getDiffClass(day)">
                {{ getDiffPrefix(day) }}{{ formatMinutes(getAbsDiff(day)) }}
              </span>
              <span class="col-status">
                <span class="badge" [class]="'badge-' + day.attendanceStatus">
                  {{ getStatusIcon(day.attendanceStatus) }}
                  {{ getStatusLabel(day.attendanceStatus) }}
                </span>
              </span>
            </div>
          }

          <!-- Summary Footer -->
          @if (weeklyStats()) {
            <div class="weekly-footer">
              <span class="col-day footer-label">Totals</span>
              <span class="col-worked mono footer-value">{{ formatMinutes(workedMinutes()) }}</span>
              <span class="col-expected mono muted footer-value">{{ formatMinutes(expectedMinutes()) }}</span>
              <span class="col-diff mono" [class]="getFooterDiffClass()">
                {{ getFooterDiffPrefix() }}{{ formatMinutes(overtimeMinutes()) }}
              </span>
              <span class="col-status footer-value">{{ daysWorked() }}/{{ totalDays() }} days</span>
            </div>
          }
        }
      </div>
    </div>
  `,
  styles: [`
    @use 'styles/design-tokens' as t;

    :host {
      display: block;
    }

    .weekly-card {
      background: var(--rws-card, #fff);
      border-radius: var(--rws-radius, 8px);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04);
      overflow: hidden;
    }

    .weekly-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 20px 24px;
      border-bottom: 1px solid var(--rws-border, #d6dce5);
    }

    .header-title {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .header-title h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: var(--rws-text, #1a1d23);
    }

    .header-title lucide-icon {
      color: var(--rws-primary, #0B4A5A);
    }

    .header-stats {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .stat {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
    }

    .stat-value {
      font-family: var(--rws-font-mono, 'IBM Plex Mono', monospace);
      font-size: 14px;
      font-weight: 600;
      color: var(--rws-text, #1a1d23);
    }

    .stat-label {
      font-size: 11px;
      color: var(--rws-text-muted, #6b7280);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .stat-divider {
      width: 1px;
      height: 28px;
      background: var(--rws-border, #d6dce5);
    }

    .weekly-table-header {
      display: grid;
      grid-template-columns: 2fr 1fr 1fr 1fr 1fr;
      padding: 10px 24px;
      background: var(--rws-bg, #f5f3f0);
    }

    .weekly-table-header span {
      font-size: 11px;
      font-weight: 600;
      color: var(--rws-text-muted, #6b7280);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .day-row {
      display: grid;
      grid-template-columns: 2fr 1fr 1fr 1fr 1fr;
      padding: 14px 24px;
      align-items: center;
      border-bottom: 1px solid var(--rws-border, #d6dce5);
      transition: background 0.15s ease;
      border-left: 3px solid transparent;
    }

    .day-row:hover {
      background: rgba(19, 141, 158, 0.03);
    }

    .day-row.alt {
      background: rgba(245, 243, 240, 0.5);
    }

    .day-row.alt:hover {
      background: rgba(19, 141, 158, 0.04);
    }

    .day-row.today {
      border-left-color: var(--rws-accent, #138D9E);
      background: rgba(19, 141, 158, 0.04);
      font-weight: 500;
    }

    .day-row:last-child {
      border-bottom: none;
    }

    .col-day {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .day-name {
      font-size: 14px;
      color: var(--rws-text, #1a1d23);
    }

    .day-date {
      font-size: 12px;
      color: var(--rws-text-muted, #6b7280);
    }

    .mono {
      font-family: var(--rws-font-mono, 'IBM Plex Mono', monospace);
      font-size: 13px;
    }

    .muted {
      color: var(--rws-text-muted, #6b7280);
    }

    .diff-positive {
      color: var(--rws-success, #2e9e6c);
    }

    .diff-negative {
      color: var(--rws-error, #A31D1D);
    }

    .diff-zero {
      color: var(--rws-text-muted, #6b7280);
    }

    .diff-overtime {
      color: var(--rws-gold, #C2924F);
    }

    .badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 10px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
      white-space: nowrap;
    }

    .badge-completed {
      background: rgba(46, 158, 108, 0.1);
      color: var(--rws-success, #2e9e6c);
    }

    .badge-overtime {
      background: rgba(194, 146, 79, 0.1);
      color: var(--rws-gold, #C2924F);
    }

    .badge-underworked {
      background: rgba(163, 29, 29, 0.1);
      color: var(--rws-error, #A31D1D);
    }

    .badge-absent {
      background: rgba(107, 114, 128, 0.1);
      color: var(--rws-text-muted, #6b7280);
    }

    .badge-day_off {
      background: rgba(19, 141, 158, 0.1);
      color: var(--rws-accent, #138D9E);
    }

    .weekly-footer {
      display: grid;
      grid-template-columns: 2fr 1fr 1fr 1fr 1fr;
      padding: 14px 24px;
      align-items: center;
      background: var(--rws-bg, #f5f3f0);
      border-top: 2px solid var(--rws-border, #d6dce5);
    }

    .footer-label {
      font-size: 13px;
      font-weight: 600;
      color: var(--rws-text, #1a1d23);
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    .footer-value {
      font-size: 13px;
      font-weight: 600;
      color: var(--rws-text, #1a1d23);
    }

    /* Loading */
    .skeleton-row {
      pointer-events: none;
    }

    .skeleton-block {
      display: inline-block;
      height: 14px;
      background: linear-gradient(90deg, var(--rws-bg, #f5f3f0) 25%, rgba(214, 220, 229, 0.4) 50%, var(--rws-bg, #f5f3f0) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
      border-radius: 4px;
    }

    .skeleton-text {
      width: 100px;
    }

    .skeleton-short {
      width: 50px;
    }

    .skeleton-badge {
      width: 72px;
      height: 22px;
      border-radius: 12px;
    }

    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    /* Empty */
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px 24px;
      gap: 12px;
      color: var(--rws-text-muted, #6b7280);
    }

    .empty-state p {
      margin: 0;
      font-size: 14px;
    }

    /* Responsive */
    @media (max-width: 768px) {
      .weekly-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 16px;
      }

      .header-stats {
        width: 100%;
        justify-content: space-between;
      }

      .weekly-table-header {
        display: none;
      }

      .day-row {
        display: flex;
        flex-wrap: wrap;
        gap: 8px 16px;
        padding: 16px;
        margin: 0 12px 8px;
        border-radius: var(--rws-radius, 8px);
        border: 1px solid var(--rws-border, #d6dce5);
        border-left: 4px solid transparent;
        background: var(--rws-card, #fff);
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
      }

      .day-row.today {
        border-left-color: var(--rws-accent, #138D9E);
      }

      .day-row.alt {
        background: var(--rws-card, #fff);
      }

      .col-day {
        flex: 1 1 100%;
      }

      .col-worked,
      .col-expected,
      .col-diff,
      .col-status {
        flex: 1 1 auto;
        font-size: 12px;
      }

      .weekly-footer {
        display: flex;
        flex-wrap: wrap;
        gap: 8px 16px;
        padding: 16px;
        margin: 0 12px 12px;
        border-radius: var(--rws-radius, 8px);
        background: var(--rws-bg, #f5f3f0);
        border: 1px solid var(--rws-border, #d6dce5);
      }
    }
  `],
})
export class TimeWeeklyComponent {
  weekDays = input.required<DayDetail[]>();
  weeklyStats = input<WeeklyStats | null>(null);
  loading = input<boolean>(false);

  readonly iconCalendar = Calendar;
  readonly iconCheckCircle = CheckCircle;
  readonly iconAlertTriangle = AlertTriangle;
  readonly iconClock = Clock;
  readonly iconMinus = Minus;

  readonly skeletonRows = [0, 1, 2, 3, 4, 5, 6];

  private readonly now = computed(() => new Date());

  readonly workedMinutes = computed(() => (this.weeklyStats()?.workedHours ?? 0) * 60);
  readonly expectedMinutes = computed(() => (this.weeklyStats()?.expectedHours ?? 0) * 60);
  readonly overtimeMinutes = computed(() => (this.weeklyStats()?.overtimeHours ?? 0) * 60);
  readonly daysWorked = computed(() => this.weekDays().filter(d => d.totalWorkedMinutes > 0).length);
  readonly totalDays = computed(() => this.weekDays().length || 5);

  isToday = (dateStr: string): boolean => {
    const d = new Date(dateStr);
    const now = this.now();
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  };

  formatDate = (dateStr: string): string => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  formatMinutes = (minutes: number): string => {
    const h = Math.floor(Math.abs(minutes) / 60);
    const m = Math.abs(minutes) % 60;
    if (h === 0 && m === 0) return '0h';
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  getAbsDiff = (day: DayDetail): number => {
    return Math.abs(day.totalWorkedMinutes - day.expectedMinutes);
  };

  getDiffPrefix = (day: DayDetail): string => {
    if (day.totalWorkedMinutes >= day.expectedMinutes) return '+';
    return '-';
  };

  getDiffClass = (day: DayDetail): string => {
    const diff = day.totalWorkedMinutes - day.expectedMinutes;
    if (diff > 0) return day.overtimeMinutes > 0 ? 'diff-overtime' : 'diff-positive';
    if (diff < 0) return 'diff-negative';
    return 'diff-zero';
  };

  getFooterDiffPrefix = (): string => {
    const m = this.overtimeMinutes();
    if (!m) return '';
    return m > 0 ? '+' : '';
  };

  getFooterDiffClass = (): string => {
    const m = this.overtimeMinutes();
    if (!m) return '';
    if (m > 0) return 'diff-overtime';
    if (m < 0) return 'diff-negative';
    return 'diff-zero';
  };

  getStatusIcon = (status: string): string => {
    switch (status) {
      case 'completed': return '✓';
      case 'overtime': return '⚠';
      case 'underworked': return '✗';
      case 'day_off': return '–';
      default: return '';
    }
  };

  getStatusLabel = (status: string): string => {
    switch (status) {
      case 'completed': return 'Completed';
      case 'overtime': return 'Overtime';
      case 'underworked': return 'Under';
      case 'absent': return 'Absent';
      case 'day_off': return 'Day Off';
      default: return status;
    }
  };
}
