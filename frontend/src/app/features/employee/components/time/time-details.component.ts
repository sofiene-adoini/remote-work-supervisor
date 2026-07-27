import { Component, computed, input, output } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import {
  LucideInfo,
  LucideSettings,
  LucideDownload,
  LucideFileText,
  LucideShield,
  LucideClock,
  LucideTimer,
  LucideZap,
  LucideCoffee,
  LucidePause,
  LucideActivity,
  LucideAlertTriangle,
  LucideCheckCircle,
  LucideGlobe,
} from '@lucide/angular';
import {
  DailyStats,
  CompanyWorkPolicy,
  SessionWithWorked,
} from '../../models/employee.models';

@Component({
  selector: 'app-time-details',
  imports: [
    TitleCasePipe,
    LucideInfo,
    LucideSettings,
    LucideDownload,
    LucideFileText,
    LucideShield,
    LucideClock,
    LucideTimer,
    LucideZap,
    LucideCoffee,
    LucidePause,
    LucideActivity,
    LucideAlertTriangle,
    LucideCheckCircle,
    LucideGlobe,
  ],
  template: `
    <div class="details-layout">
      <!-- Section 1: Daily Details Grid -->
      <div class="card details-card">
        <div class="card-header">
          <span class="card-header-title">
            <svg lucideClock class="icon-header" aria-hidden="true"></svg>
            <h3>Today's Details</h3>
          </span>
        </div>
        <div class="card-body">
          @if (loading()) {
            <div class="stats-grid">
              @for (i of skeletonItems; track i) {
                <div class="stat-item">
                  <span class="stat-label skeleton skeleton-text"></span>
                  <span class="stat-value skeleton skeleton-value"></span>
                </div>
              }
            </div>
          } @else {
            <div class="stats-grid">
              <!-- 1. Worked Time -->
              <div class="stat-item">
                <span class="stat-label">
                  <svg lucideClock class="icon-stat" aria-hidden="true"></svg>
                  Worked Time
                </span>
                <span class="stat-value mono">{{ workedTimeLabel() }}</span>
              </div>

              <!-- 2. Expected Time -->
              <div class="stat-item">
                <span class="stat-label">
                  <svg lucideTimer class="icon-stat" aria-hidden="true"></svg>
                  Expected Time
                </span>
                <span class="stat-value mono">{{ expectedTimeLabel() }}</span>
              </div>

              <!-- 3. Remaining Time -->
              <div class="stat-item">
                <span class="stat-label">
                  <svg lucideAlertTriangle class="icon-stat" aria-hidden="true"></svg>
                  Remaining Time
                </span>
                <span class="stat-value mono" [style.color]="remainingColor()">{{ remainingTimeLabel() }}</span>
              </div>

              <!-- 4. Overtime -->
              <div class="stat-item">
                <span class="stat-label">
                  <svg lucideZap class="icon-stat" aria-hidden="true"></svg>
                  Overtime
                </span>
                <span class="stat-value mono" [class.overtime-positive]="hasOvertime()">{{ overtimeLabel() }}</span>
              </div>

              <!-- 5. Break Time -->
              <div class="stat-item">
                <span class="stat-label">
                  <svg lucideCoffee class="icon-stat" aria-hidden="true"></svg>
                  Break Time
                </span>
                <span class="stat-value mono">{{ breakTimeLabel() }}</span>
              </div>

              <!-- 6. Idle Time -->
              <div class="stat-item">
                <span class="stat-label">
                  <svg lucidePause class="icon-stat" aria-hidden="true"></svg>
                  Idle Time
                </span>
                <span class="stat-value mono" [class.idle-warn]="isIdleHigh()">{{ idleTimeLabel() }}</span>
              </div>

              <!-- 7. Active Time -->
              <div class="stat-item">
                <span class="stat-label">
                  <svg lucideActivity class="icon-stat" aria-hidden="true"></svg>
                  Active Time
                </span>
                <span class="stat-value mono">{{ activeTimeLabel() }}</span>
              </div>

              <!-- 8. Productive % -->
              <div class="stat-item">
                <span class="stat-label">
                  <svg lucideZap class="icon-stat" aria-hidden="true"></svg>
                  Productive %
                </span>
                <span class="stat-value mono" [style.color]="productivityColor()">{{ productivityLabel() }}</span>
              </div>

              <!-- 9. Attendance -->
              <div class="stat-item">
                <span class="stat-label">
                  <svg lucideCheckCircle class="icon-stat" aria-hidden="true"></svg>
                  Attendance
                </span>
                <span class="stat-value">
                  <span class="attendance-badge" [class]="'attendance-' + attendanceStatus()">{{ attendanceLabel() }}</span>
                </span>
              </div>

              <!-- 10. Longest Session -->
              <div class="stat-item">
                <span class="stat-label">
                  <svg lucideTimer class="icon-stat" aria-hidden="true"></svg>
                  Longest Session
                </span>
                <span class="stat-value mono">{{ longestSessionLabel() }}</span>
              </div>

              <!-- 11. Auto Breaks -->
              <div class="stat-item">
                <span class="stat-label">
                  <svg lucideInfo class="icon-stat" aria-hidden="true"></svg>
                  Auto Breaks
                </span>
                <span class="stat-value mono">{{ autoBreaksCount() }}</span>
              </div>

              <!-- 12. Manual Breaks -->
              <div class="stat-item">
                <span class="stat-label">
                  <svg lucideCoffee class="icon-stat" aria-hidden="true"></svg>
                  Manual Breaks
                </span>
                <span class="stat-value mono">{{ manualBreaksCount() }}</span>
              </div>
            </div>
          }
        </div>
      </div>

      <!-- Section 2: Company Policy Panel -->
      <div class="card policy-card">
        <div class="card-header">
          <span class="card-header-title">
            <svg lucideShield class="icon-header" aria-hidden="true"></svg>
            <h3>Work Policy</h3>
          </span>
        </div>
        <div class="card-body">
          @if (loading()) {
            <div class="policy-list">
              @for (i of skeletonPolicyItems; track i) {
                <div class="policy-item">
                  <span class="skeleton skeleton-text"></span>
                  <span class="skeleton skeleton-short"></span>
                </div>
              }
            </div>
          } @else if (!policy()) {
            <div class="policy-empty">
              <p>No policy configured</p>
            </div>
          } @else {
            <div class="policy-list">
              <div class="policy-item">
                <span class="policy-icon">
                  <svg lucideClock class="icon-policy" aria-hidden="true"></svg>
                </span>
                <span class="policy-label">Expected Daily Hours</span>
                <span class="policy-value mono">{{ policy()!.expectedDailyHours }} hours</span>
              </div>

              <div class="policy-item">
                <span class="policy-icon">
                  <svg lucideClock class="icon-policy" aria-hidden="true"></svg>
                </span>
                <span class="policy-label">Expected Weekly Hours</span>
                <span class="policy-value mono">{{ policy()!.expectedWeeklyHours }} hours</span>
              </div>

              <div class="policy-item">
                <span class="policy-icon">
                  <svg lucideCoffee class="icon-policy" aria-hidden="true"></svg>
                </span>
                <span class="policy-label">Minimum Break</span>
                <span class="policy-value mono">{{ policy()!.minimumBreakMinutes }} minutes</span>
              </div>

              <div class="policy-item">
                <span class="policy-icon">
                  <svg lucideZap class="icon-policy" aria-hidden="true"></svg>
                </span>
                <span class="policy-label">Overtime Starts After</span>
                <span class="policy-value mono">{{ policy()!.overtimeStartsAfterDailyHours }} hours</span>
              </div>

              <div class="policy-item">
                <span class="policy-icon">
                  <svg lucidePause class="icon-policy" aria-hidden="true"></svg>
                </span>
                <span class="policy-label">Maximum Continuous Work</span>
                <span class="policy-value mono">{{ policy()!.maximumContinuousWorkHours }} hours</span>
              </div>

              <div class="policy-item">
                <span class="policy-icon">
                  <svg lucideSettings class="icon-policy" aria-hidden="true"></svg>
                </span>
                <span class="policy-label">Working Days</span>
                <span class="policy-value mono">{{ formatWorkingDays() }}</span>
              </div>

              <div class="policy-item">
                <span class="policy-icon">
                  <svg lucideGlobe class="icon-policy" aria-hidden="true"></svg>
                </span>
                <span class="policy-label">Timezone</span>
                <span class="policy-value mono">{{ policy()!.timezone }}</span>
              </div>

              <div class="policy-item">
                <span class="policy-icon">
                  <svg lucideAlertTriangle class="icon-policy" aria-hidden="true"></svg>
                </span>
                <span class="policy-label">Weekend Work</span>
                <span class="policy-value mono" [class.text-success]="policy()!.allowWeekendWork" [class.text-muted]="!policy()!.allowWeekendWork">
                  {{ policy()!.allowWeekendWork ? 'Allowed' : 'Not Allowed' }}
                </span>
              </div>
            </div>
          }
        </div>
      </div>

      <!-- Section 3: Export Section -->
      <div class="card export-card">
        <div class="card-header">
          <span class="card-header-title">
            <svg lucideDownload class="icon-header" aria-hidden="true"></svg>
            <h3>Export Data</h3>
          </span>
        </div>
        <div class="card-body">
          <p class="export-description">Export your work data for {{ filterLabel() }}</p>
          <div class="export-actions">
            <button class="export-btn" (click)="onExportCsv()">
              <svg lucideDownload class="icon-btn" aria-hidden="true"></svg>
              Export CSV
            </button>
            <button class="export-btn export-btn--secondary" (click)="onExportPdf()">
              <svg lucideFileText class="icon-btn" aria-hidden="true"></svg>
              Export PDF
            </button>
          </div>
          <p class="export-note">Exports respect your current date filter</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    @use 'styles/design-tokens' as t;

    :host {
      display: block;
    }

    .details-layout {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }

    .card {
      background: var(--rws-card, #ffffff);
      border-radius: var(--rws-radius, 8px);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04);
      overflow: hidden;
    }

    .export-card {
      grid-column: 1 / -1;
    }

    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      border-bottom: 1px solid var(--rws-border, #d6dce5);
    }

    .card-header-title {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .card-header-title h3 {
      margin: 0;
      font-size: 15px;
      font-weight: 600;
      color: var(--rws-text, #1a1d23);
    }

    .icon-header {
      width: 18px;
      height: 18px;
      color: var(--rws-primary, #0B4A5A);
    }

    .card-body {
      padding: 16px 20px;
    }

    /* ── Daily Details Grid ── */

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
    }

    .stat-item {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 12px 0;
      border-bottom: 1px solid var(--rws-border, #d6dce5);
    }

    .stat-item:nth-last-child(-n+4) {
      border-bottom: none;
    }

    .stat-item:nth-child(4n) {
      padding-left: 12px;
    }

    .stat-item:nth-child(4n+1) {
      padding-right: 12px;
    }

    .stat-label {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: var(--rws-text-muted, #6b7280);
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    .icon-stat {
      width: 13px;
      height: 13px;
      color: var(--rws-text-muted, #6b7280);
      flex-shrink: 0;
    }

    .stat-value {
      font-size: 14px;
      font-weight: 600;
      color: var(--rws-text, #1a1d23);
      line-height: 1.3;
    }

    .mono {
      font-family: var(--rws-font-mono, 'IBM Plex Mono', monospace);
      font-size: 13px;
    }

    .overtime-positive {
      color: var(--rws-gold, #C2924F);
    }

    .idle-warn {
      color: var(--rws-error, #A31D1D);
    }

    .text-success {
      color: var(--rws-success, #2e9e6c);
    }

    .text-muted {
      color: var(--rws-text-muted, #6b7280);
    }

    /* Attendance badges */
    .attendance-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 10px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
      text-transform: capitalize;
    }

    .attendance-completed {
      background: rgba(46, 158, 108, 0.1);
      color: var(--rws-success, #2e9e6c);
    }

    .attendance-overtime {
      background: rgba(194, 146, 79, 0.1);
      color: var(--rws-gold, #C2924F);
    }

    .attendance-underworked {
      background: rgba(163, 29, 29, 0.1);
      color: var(--rws-error, #A31D1D);
    }

    .attendance-absent {
      background: rgba(107, 114, 128, 0.1);
      color: var(--rws-text-muted, #6b7280);
    }

    .attendance-day_off {
      background: rgba(19, 141, 158, 0.1);
      color: var(--rws-accent, #138D9E);
    }

    /* ── Policy Panel ── */

    .policy-list {
      display: flex;
      flex-direction: column;
    }

    .policy-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 0;
      border-bottom: 1px solid var(--rws-border, #d6dce5);
    }

    .policy-item:last-child {
      border-bottom: none;
    }

    .policy-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: 8px;
      background: rgba(11, 74, 90, 0.06);
      flex-shrink: 0;
    }

    .icon-policy {
      width: 16px;
      height: 16px;
      color: var(--rws-primary, #0B4A5A);
    }

    .policy-label {
      flex: 1;
      font-size: 13px;
      color: var(--rws-text, #1a1d23);
    }

    .policy-value {
      font-size: 13px;
      font-weight: 600;
      color: var(--rws-text, #1a1d23);
      white-space: nowrap;
    }

    .policy-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 32px 20px;
      color: var(--rws-text-muted, #6b7280);
    }

    .policy-empty p {
      margin: 0;
      font-size: 14px;
    }

    /* ── Export Section ── */

    .export-description {
      margin: 0 0 16px;
      font-size: 14px;
      color: var(--rws-text-muted, #6b7280);
    }

    .export-actions {
      display: flex;
      gap: 12px;
    }

    .export-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 20px;
      border: 1.5px solid var(--rws-accent, #138D9E);
      border-radius: var(--rws-radius, 8px);
      background: transparent;
      color: var(--rws-accent, #138D9E);
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .export-btn:hover {
      background: var(--rws-accent, #138D9E);
      color: #ffffff;
    }

    .export-btn:active {
      transform: scale(0.98);
    }

    .icon-btn {
      width: 16px;
      height: 16px;
    }

    .export-btn--secondary {
      border-color: var(--rws-border, #d6dce5);
      color: var(--rws-text, #1a1d23);
    }

    .export-btn--secondary:hover {
      background: var(--rws-text, #1a1d23);
      border-color: var(--rws-text, #1a1d23);
      color: #ffffff;
    }

    .export-note {
      margin: 12px 0 0;
      font-size: 12px;
      color: var(--rws-text-muted, #6b7280);
      font-style: italic;
    }

    /* ── Skeleton ── */

    .skeleton {
      display: inline-block;
      height: 14px;
      background: linear-gradient(90deg, var(--rws-bg, #f5f3f0) 25%, rgba(214, 220, 229, 0.4) 50%, var(--rws-bg, #f5f3f0) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
      border-radius: 4px;
    }

    .skeleton-text {
      width: 80px;
    }

    .skeleton-value {
      width: 60px;
      height: 18px;
    }

    .skeleton-short {
      width: 60px;
    }

    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    /* ── Responsive ── */

    @media (max-width: 1024px) {
      .details-layout {
        grid-template-columns: 1fr;
      }

      .export-card {
        grid-column: 1;
      }
    }

    @media (max-width: 768px) {
      .stats-grid {
        grid-template-columns: repeat(2, 1fr);
        gap: 0 16px;
      }

      .stat-item {
        padding-left: 0;
        padding-right: 0;
      }

      .stat-item:nth-child(4n) {
        padding-left: 0;
      }

      .stat-item:nth-child(2n) {
        padding-left: 16px;
      }

      .stat-item:last-child {
        border-bottom: none;
      }

      .stat-item:nth-last-child(2) {
        border-bottom: none;
      }

      .export-actions {
        flex-direction: column;
      }

      .export-btn {
        justify-content: center;
      }
    }

    @media (max-width: 480px) {
      .stats-grid {
        grid-template-columns: 1fr;
      }

      .stat-item:nth-child(2n) {
        padding-left: 0;
      }

      .stat-item {
        border-bottom: 1px solid var(--rws-border, #d6dce5);
      }

      .stat-item:last-child {
        border-bottom: none;
      }
    }
  `],
})
export class TimeDetailsComponent {
  readonly dailyStats = input<DailyStats | null>(null);
  readonly policy = input<CompanyWorkPolicy | null>(null);
  readonly todaySessions = input<SessionWithWorked[]>([]);
  readonly allSessions = input<SessionWithWorked[]>([]);
  readonly filterLabel = input<string>('Last 7 Days');
  readonly loading = input<boolean>(false);

  readonly exportCsv = output<void>();

  protected readonly skeletonItems = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  protected readonly skeletonPolicyItems = [1, 2, 3, 4, 5, 6, 7, 8];

  private formatMinutes(minutes: number): string {
    const h = Math.floor(Math.abs(minutes) / 60);
    const m = Math.abs(minutes) % 60;
    if (h === 0 && m === 0) return '0m';
    if (m === 0) return `${h}h`;
    if (h === 0) return `${m}m`;
    return `${h}h ${m}m`;
  }

  // ── Daily Details computed ──

  protected readonly workedTimeLabel = computed(() => {
    const s = this.dailyStats();
    return s ? this.formatMinutes(s.workedMinutes) : '0h';
  });

  protected readonly expectedTimeLabel = computed(() => {
    const s = this.dailyStats();
    if (s) return this.formatMinutes(s.expectedMinutes);
    const p = this.policy();
    return p ? this.formatMinutes(p.expectedDailyHours * 60) : '0h';
  });

  protected readonly remainingTimeLabel = computed(() => {
    const s = this.dailyStats();
    if (!s) return '0h';
    return this.formatMinutes(s.missingMinutes);
  });

  protected readonly remainingColor = computed(() => {
    const s = this.dailyStats();
    if (!s || s.missingMinutes <= 0) return 'var(--rws-success, #2e9e6c)';
    return 'var(--rws-text-muted, #6b7280)';
  });

  protected readonly overtimeLabel = computed(() => {
    const s = this.dailyStats();
    return s ? this.formatMinutes(s.overtimeMinutes) : '0h';
  });

  protected readonly hasOvertime = computed(() => {
    const s = this.dailyStats();
    return !!s && s.overtimeMinutes > 0;
  });

  protected readonly breakTimeLabel = computed(() => {
    const s = this.dailyStats();
    return s ? this.formatMinutes(s.breakMinutes) : '0m';
  });

  protected readonly idleTimeLabel = computed(() => {
    const s = this.dailyStats();
    return s ? this.formatMinutes(s.idleMinutes) : '0m';
  });

  protected readonly isIdleHigh = computed(() => {
    const s = this.dailyStats();
    return !!s && s.idleMinutes > 30;
  });

  protected readonly activeTimeLabel = computed(() => {
    const s = this.dailyStats();
    if (!s) return '0h';
    return this.formatMinutes(s.workedMinutes - s.breakMinutes);
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
    if (p > 80) return 'var(--rws-success, #2e9e6c)';
    if (p > 50) return 'var(--rws-gold, #C2924F)';
    return 'var(--rws-error, #A31D1D)';
  });

  protected readonly attendanceStatus = computed(() => {
    const s = this.dailyStats();
    return s ? s.attendanceStatus : 'absent';
  });

  protected readonly attendanceLabel = computed(() => {
    const s = this.dailyStats();
    if (!s) return 'N/A';
    return s.attendanceStatus.replace('_', ' ');
  });

  protected readonly longestSessionLabel = computed(() => {
    const sessions = this.todaySessions();
    if (!sessions.length) return '0h';
    const longest = Math.max(...sessions.map(s => s.workedMinutes));
    return this.formatMinutes(longest);
  });

  protected readonly autoBreaksCount = computed(() => {
    const sessions = this.todaySessions();
    return sessions.filter(s => s.totalBreakMinutes > 0 && !s.breakStart).length;
  });

  protected readonly manualBreaksCount = computed(() => {
    const sessions = this.todaySessions();
    return sessions.filter(s => s.totalBreakMinutes > 0 && !!s.breakStart).length;
  });

  // ── Policy computed ──

  protected readonly formatWorkingDays = computed(() => {
    const p = this.policy();
    if (!p || !p.workingDays?.length) return 'Mon-Fri';
    const abbr: Record<string, string> = {
      mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu',
      fri: 'Fri', sat: 'Sat', sun: 'Sun',
      monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed',
      thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
    };
    const short = p.workingDays.map(d => abbr[d.toLowerCase()] || d);
    if (short.length === 5 &&
        short.includes('Mon') && short.includes('Tue') && short.includes('Wed') &&
        short.includes('Thu') && short.includes('Fri')) {
      return 'Mon-Fri';
    }
    return short.join(', ');
  });

  // ── Export ──

  protected onExportCsv(): void {
    this.exportCsv.emit();
  }

  protected onExportPdf(): void {
    this.exportCsv.emit();
  }
}
