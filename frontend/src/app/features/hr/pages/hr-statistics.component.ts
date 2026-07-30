import {
  Component, inject, OnInit, signal, computed, OnDestroy, ChangeDetectionStrategy, ViewChild,
  ElementRef, effect, AfterViewInit,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe, DecimalPipe, CommonModule } from '@angular/common';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData as NgChartData, Chart, CategoryScale, LinearScale, BarElement, BarController, Legend, Tooltip } from 'chart.js';

Chart.register(CategoryScale, LinearScale, BarElement, BarController, Legend, Tooltip);
import {
  LucideBarChart3, LucideDownload, LucideSearch, LucideX, LucideCalendar,
  LucideUsers, LucideClock, LucideAlertTriangle, LucideTrendingUp,
  LucideChevronLeft, LucideChevronRight, LucideChevronUp, LucideChevronDown,
  LucideRefreshCw, LucideFilter, LucideArrowUpDown, LucideActivity,
  LucideMonitor, LucideCoffee, LucideShield,
} from '@lucide/angular';
import { HrAnalyticsService, EmployeeQuery } from '../services/hr-analytics.service';
import {
  AnalyticsSummary, AnalyticsEmployee, EmployeeDetailSummary,
  TimelineEntry, ChartData,
} from '../models/hr-analytics.models';

@Component({
  selector: 'app-hr-statistics',
  imports: [
    CommonModule, FormsModule, DatePipe, DecimalPipe, BaseChartDirective,
    LucideBarChart3, LucideDownload, LucideSearch, LucideX, LucideCalendar,
    LucideUsers, LucideClock, LucideAlertTriangle, LucideTrendingUp,
    LucideChevronLeft, LucideChevronRight, LucideChevronUp, LucideChevronDown,
    LucideRefreshCw, LucideFilter, LucideArrowUpDown, LucideActivity,
    LucideMonitor, LucideCoffee, LucideShield,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <!-- Header -->
      <div class="page-header">
        <div class="header-left">
          <svg lucideBarChart3 class="header-icon"></svg>
          <div>
            <h1 class="page-title">HR Analytics</h1>
            <p class="page-subtitle">Workforce insights &amp; performance metrics</p>
          </div>
        </div>
        <button class="btn-export" (click)="exportCsv()">
          <svg lucideDownload class="icon-sm"></svg>
          Export CSV
        </button>
      </div>

      <!-- Filter Bar -->
      <div class="filter-bar">
        <div class="filter-left">
          <div class="search-box">
            <svg lucideSearch class="search-icon"></svg>
            <input class="search-input" placeholder="Search employees..."
              [(ngModel)]="searchTerm" (input)="onSearch()">
          </div>
          <select class="filter-select" [(ngModel)]="statusFilter" (change)="loadEmployees()">
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="break">On Break</option>
            <option value="clocked_out">Clocked Out</option>
          </select>
          <select class="filter-select" [(ngModel)]="attendanceFilter" (change)="loadEmployees()">
            <option value="">All Attendance</option>
            <option value="excellent">Excellent</option>
            <option value="good">Good</option>
            <option value="acceptable">Acceptable</option>
            <option value="underworked">Underworked</option>
            <option value="absent">Absent</option>
            <option value="overtime">Overtime</option>
          </select>
        </div>
        <div class="filter-right">
          @for (preset of datePresets; track preset.label) {
            <button class="date-preset" [class.active]="activePreset() === preset.label"
              (click)="setDatePreset(preset)">
              {{ preset.label }}
            </button>
          }
          <div class="date-range">
            <input type="date" class="date-input" [(ngModel)]="startDate" (change)="onDateChange()">
            <span class="date-sep">to</span>
            <input type="date" class="date-input" [(ngModel)]="endDate" (change)="onDateChange()">
          </div>
        </div>
      </div>

      <!-- Summary Cards -->
      @if (summary()) {
        <div class="summary-grid">
          <div class="summary-card">
            <div class="sc-icon sc-icon-teams">
              <svg lucideUsers class="sc-icon-svg"></svg>
            </div>
            <div class="sc-body">
              <span class="sc-value">{{ summary()!.totalEmployees }}</span>
              <span class="sc-label">Employees</span>
            </div>
          </div>
          <div class="summary-card">
            <div class="sc-icon sc-icon-clock">
              <svg lucideClock class="sc-icon-svg"></svg>
            </div>
            <div class="sc-body">
              <span class="sc-value">{{ summary()!.totalWorkedHours | number:'1.0-1' }}</span>
              <span class="sc-label">Hours Worked</span>
            </div>
          </div>
          <div class="summary-card">
            <div class="sc-icon sc-icon-ot">
              <svg lucideTrendingUp class="sc-icon-svg"></svg>
            </div>
            <div class="sc-body">
              <span class="sc-value">{{ summary()!.totalOvertimeHours | number:'1.0-1' }}</span>
              <span class="sc-label">Overtime Hours</span>
            </div>
          </div>
          <div class="summary-card">
            <div class="sc-icon sc-icon-attendance">
              <svg lucideActivity class="sc-icon-svg"></svg>
            </div>
            <div class="sc-body">
              <span class="sc-value">{{ summary()!.averageAttendancePct }}%</span>
              <span class="sc-label">Avg Attendance</span>
            </div>
          </div>
          <div class="summary-card">
            <div class="sc-icon sc-icon-break">
              <svg lucideCoffee class="sc-icon-svg"></svg>
            </div>
            <div class="sc-body">
              <span class="sc-value">{{ summary()!.totalBreakHours | number:'1.0-1' }}</span>
              <span class="sc-label">Break Hours</span>
            </div>
          </div>
          <div class="summary-card">
            <div class="sc-icon sc-icon-alert">
              <svg lucideAlertTriangle class="sc-icon-svg"></svg>
            </div>
            <div class="sc-body">
              <span class="sc-value">{{ summary()!.breakViolations }}</span>
              <span class="sc-label">Break Violations</span>
            </div>
          </div>
        </div>
      }

      <!-- Charts Row -->
      @if (chartData()) {
        <div class="charts-row">
          <div class="chart-card">
            <h3 class="chart-title">Daily Worked Hours</h3>
            @if (chartData()!.dailyData.length > 0) {
              <div class="chart-wrap">
                <canvas baseChart #dailyChart
                  [data]="workedChartData()"
                  [options]="barChartOptions"
                  [type]="'bar'">
                </canvas>
              </div>
            } @else {
              <div class="chart-empty">
                <svg lucideBarChart3 class="chart-empty-icon"></svg>
                <span>No work sessions recorded in this period</span>
              </div>
            }
          </div>
          <div class="chart-card">
            <h3 class="chart-title">Top Productive Employees</h3>
            @if (chartData()!.topProductive.length > 0) {
              <div class="chart-wrap">
                <canvas baseChart #productiveChart
                  [data]="productiveChartData()"
                  [options]="horizontalBarOptions"
                  [type]="'bar'">
                </canvas>
              </div>
            } @else {
              <div class="chart-empty">
                <svg lucideBarChart3 class="chart-empty-icon"></svg>
                <span>No employee data in this period</span>
              </div>
            }
          </div>
        </div>
      }

      <!-- Employee Table -->
      <div class="table-card">
        <div class="table-header">
          <h3 class="table-title">Employee Details</h3>
          <span class="table-count">{{ pagination().total }} employees</span>
        </div>

        @if (loading()) {
          <div class="table-skeleton">
            @for (i of [1,2,3,4,5]; track i) {
              <div class="sk-row">
                <div class="sk sk-cell" style="width:160px;height:16px"></div>
                <div class="sk sk-cell" style="width:80px;height:16px"></div>
                <div class="sk sk-cell" style="width:60px;height:16px"></div>
                <div class="sk sk-cell" style="width:100px;height:16px"></div>
              </div>
            }
          </div>
        } @else {
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  @for (col of columns; track col.key) {
                    <th class="th-sortable" (click)="onSort(col.key)">
                      <div class="th-inner">
                        {{ col.label }}
                        @if (sortBy() === col.key) {
                          @if (sortDir() === 'asc') {
                            <svg lucideChevronUp class="sort-icon"></svg>
                          } @else {
                            <svg lucideChevronDown class="sort-icon"></svg>
                          }
                        } @else {
                          <svg lucideArrowUpDown class="sort-icon sort-icon-dim"></svg>
                        }
                      </div>
                    </th>
                  }
                </tr>
              </thead>
              <tbody>
                @for (emp of employees(); track emp.userId) {
                  <tr class="data-row" [class.row-active]="emp.currentStatus === 'active'"
                    [class.row-break]="emp.currentStatus === 'break'"
                    (click)="openDetail(emp.userId)">
                    <td>
                      <div class="emp-name-cell">
                        <span class="emp-dot" [class.dot-active]="emp.agentOnline"></span>
                        <div>
                          <span class="emp-name">{{ emp.fullName }}</span>
                          <span class="emp-email">{{ emp.email }}</span>
                        </div>
                      </div>
                    </td>
                    <td>{{ emp.team?.name || '—' }}</td>
                    <td>
                      <span class="status-badge" [class]="'badge-' + emp.currentStatus">
                        {{ emp.currentStatus === 'active' ? 'Active' : emp.currentStatus === 'break' ? 'Break' : 'Out' }}
                      </span>
                    </td>
                    <td class="num">{{ emp.workedHours | number:'1.0-1' }}h</td>
                    <td class="num">{{ emp.expectedHours | number:'1.0-1' }}h</td>
                    <td class="num">{{ emp.overtimeHours | number:'1.0-1' }}h</td>
                    <td>
                      <div class="att-bar-wrap">
                        <div class="att-bar">
                          <div class="att-bar-fill" [style.width.%]="emp.attendancePct"
                            [class]="'att-' + emp.evaluation"></div>
                        </div>
                        <span class="att-pct">{{ emp.attendancePct }}%</span>
                      </div>
                    </td>
                    <td>
                      <span class="eval-badge" [class]="'eval-' + emp.evaluation">
                        {{ emp.evaluation }}
                      </span>
                    </td>
                    <td>
                      <svg lucideChevronRight class="row-arrow"></svg>
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="9" class="empty-row">No employees match the current filters</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <!-- Pagination -->
          @if (pagination().totalPages > 1) {
            <div class="pagination">
              <button class="pg-btn" [disabled]="pagination().page <= 1" (click)="goPage(pagination().page - 1)">
                <svg lucideChevronLeft class="icon-xs"></svg>
              </button>
              @for (p of pageNumbers(); track p) {
                <button class="pg-btn pg-num" [class.pg-active]="p === pagination().page"
                  (click)="goPage(p)">{{ p }}</button>
              }
              <button class="pg-btn" [disabled]="pagination().page >= pagination().totalPages"
                (click)="goPage(pagination().page + 1)">
                <svg lucideChevronRight class="icon-xs"></svg>
              </button>
            </div>
          }
        }
      </div>

      <!-- Detail Side Panel (Overlay) -->
      @if (detailOpen()) {
        <div class="detail-overlay" (click)="closeDetail()"></div>
        <div class="detail-panel">
          <div class="detail-header">
            <h2 class="detail-name">{{ detailEmployee()?.employee?.fullName }}</h2>
            <button class="detail-close" (click)="closeDetail()">
              <svg lucideX class="icon-sm"></svg>
            </button>
          </div>

          @if (detailLoading()) {
            <div class="detail-skeleton">
              @for (i of [1,2,3,4]; track i) {
                <div class="sk sk-detail-block"></div>
              }
            </div>
          } @else if (detailEmployee()) {
            <div class="detail-body">
              <!-- Employee Summary Cards -->
              <div class="det-summary">
                <div class="det-stat">
                  <span class="det-stat-val">{{ detailEmployee()!.summary.workedHours | number:'1.0-1' }}h</span>
                  <span class="det-stat-lbl">Worked</span>
                </div>
                <div class="det-stat">
                  <span class="det-stat-val">{{ detailEmployee()!.summary.expectedHours | number:'1.0-1' }}h</span>
                  <span class="det-stat-lbl">Expected</span>
                </div>
                <div class="det-stat">
                  <span class="det-stat-val">{{ detailEmployee()!.summary.overtimeHours | number:'1.0-1' }}h</span>
                  <span class="det-stat-lbl">Overtime</span>
                </div>
                <div class="det-stat">
                  <span class="det-stat-val">{{ detailEmployee()!.summary.missingHours | number:'1.0-1' }}h</span>
                  <span class="det-stat-lbl">Missing</span>
                </div>
              </div>

              <div class="det-details">
                <div class="det-row"><span class="det-label">Average Daily</span><span class="det-val">{{ detailEmployee()!.summary.averageDailyHours | number:'1.0-1' }}h</span></div>
                <div class="det-row"><span class="det-label">Longest Day</span><span class="det-val">{{ detailEmployee()!.summary.longestDayHours | number:'1.0-1' }}h</span></div>
                <div class="det-row"><span class="det-label">Break Violations</span><span class="det-val">{{ detailEmployee()!.summary.breakViolations }}</span></div>
                <div class="det-row"><span class="det-label">Screenshots Flagged</span><span class="det-val">{{ detailEmployee()!.summary.suspiciousScreenshotCount }}</span></div>
                <div class="det-row"><span class="det-label">Auto Breaks</span><span class="det-val">{{ detailEmployee()!.summary.autoBreakCount }}</span></div>
                <div class="det-row"><span class="det-label">Manual Breaks</span><span class="det-val">{{ detailEmployee()!.summary.manualBreakCount }}</span></div>
                <div class="det-row"><span class="det-label">Days Present</span><span class="det-val">{{ detailEmployee()!.summary.daysPresent }} / {{ detailEmployee()!.summary.workingDaysInRange }}</span></div>
              </div>

              <!-- Daily Timeline -->
              @if (timeline().length > 0) {
                <h3 class="detail-section-title">Daily Timeline</h3>
                <div class="timeline">
                  @for (day of timeline(); track day.date) {
                    <div class="tl-day" [class.tl-absent]="day.attendance === 'absent'" [class.tl-day-off]="day.attendance === 'day_off'">
                      <div class="tl-header">
                        <span class="tl-date">{{ day.date | date:'EEE, MMM d' }}</span>
                        <span class="eval-badge eval-sm" [class]="'eval-' + day.attendance">{{ day.attendance }}</span>
                      </div>
                      @if (day.isWorkingDay && day.clockIn) {
                        <div class="tl-times">
                          <span class="tl-time">
                            <svg lucideClock class="icon-xs"></svg>
                            {{ day.clockIn | date:'HH:mm' }}
                            {{ day.clockOut ? ' → ' + (day.clockOut | date:'HH:mm') : ' → now' }}
                          </span>
                          <span class="tl-hours">{{ (day.workedMinutes / 60) | number:'1.0-1' }}h worked</span>
                        </div>
@if (day.breaks.length > 0) {
  <div class="tl-breaks">
    <svg lucideCoffee class="icon-xs"></svg>
    {{ day.breaks.length }} break(s) — {{ day.breakMinutes }}min total
  </div>
  @for (brk of day.breaks; track $index) {
    <div class="tl-break-detail">
      <span class="tl-break-tag" [class.tl-break-auto]="brk.isAutomatic">
        {{ brk.isAutomatic ? 'Auto' : 'Manual' }}
      </span>
      <span class="tl-break-time">{{ brk.start | date:'HH:mm' }} → {{ brk.end ? (brk.end | date:'HH:mm') : 'ongoing' }}</span>
      <span class="tl-break-mins">{{ brk.minutes }}min</span>
      @if (brk.isAutomatic) {
        <span class="tl-break-auto-text">Automatic Break</span>
      } @else if (brk.reason) {
        <span class="tl-break-reason">{{ brk.reason }}</span>
      } @else {
        <span class="tl-break-noreason">No reason provided</span>
      }
    </div>
  }
}
                        @if (day.overtimeMinutes > 0) {
                          <div class="tl-ot">{{ (day.overtimeMinutes / 60) | number:'1.0-1' }}h overtime</div>
                        }
                        @if (day.suspiciousCount > 0) {
                          <div class="tl-alert">{{ day.suspiciousCount }} suspicious screenshot(s)</div>
                        }
                      } @else if (day.attendance === 'day_off') {
                        <div class="tl-dayoff">Day off</div>
                      } @else {
                        <div class="tl-absent-text">No activity recorded</div>
                      }
                    </div>
                  }
                </div>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    @use 'styles/design-tokens' as t;

    .page { padding: 0; }
    .page-header {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 1.5rem;
    }
    .header-left { display: flex; align-items: center; gap: 0.75rem; }
    .header-icon { width: 28px; height: 28px; color: var(--rws-accent); }
    .page-title { margin: 0; font-size: 1.5rem; font-weight: 700; color: var(--rws-text); }
    .page-subtitle { margin: 0.125rem 0 0; font-size: 0.875rem; color: var(--rws-text-muted); }
    .btn-export {
      display: flex; align-items: center; gap: 0.5rem;
      padding: 0.5rem 1rem; border: 1px solid var(--rws-border); border-radius: var(--rws-radius);
      background: #fff; color: var(--rws-text); font-size: 0.875rem; font-weight: 500;
      cursor: pointer; transition: all 150ms;
    }
    .btn-export:hover { border-color: var(--rws-accent); color: var(--rws-accent); background: var(--rws-bg-hover); }

    /* Filter Bar */
    .filter-bar {
      display: flex; align-items: center; justify-content: space-between;
      flex-wrap: wrap; gap: 0.75rem; margin-bottom: 1.25rem;
      padding: 0.875rem 1.125rem; background: #fff; border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05); border: 1px solid var(--rws-border);
    }
    .filter-left { display: flex; align-items: center; gap: 0.625rem; flex-wrap: wrap; }
    .filter-right { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
    .search-box {
      position: relative; display: flex; align-items: center;
      background: var(--rws-bg); border: 1px solid var(--rws-border); border-radius: var(--rws-radius);
      padding: 0 0.75rem;
    }
    .search-icon { width: 16px; height: 16px; color: var(--rws-text-muted); flex-shrink: 0; }
    .search-input {
      border: none; background: transparent; padding: 0.5rem 0.5rem; font-size: 0.875rem;
      color: var(--rws-text); width: 200px; outline: none;
    }
    .filter-select {
      padding: 0.5rem 0.75rem; border: 1px solid var(--rws-border); border-radius: var(--rws-radius);
      font-size: 0.8125rem; color: var(--rws-text); background: #fff; cursor: pointer;
    }
    .date-preset {
      padding: 0.375rem 0.75rem; border: 1px solid var(--rws-border); border-radius: var(--rws-radius);
      font-size: 0.75rem; font-weight: 500; color: var(--rws-text-muted); background: #fff;
      cursor: pointer; transition: all 150ms;
    }
    .date-preset:hover { border-color: var(--rws-accent); color: var(--rws-accent); }
    .date-preset.active { background: var(--rws-accent); color: #fff; border-color: var(--rws-accent); }
    .date-range { display: flex; align-items: center; gap: 0.375rem; }
    .date-input {
      padding: 0.375rem 0.5rem; border: 1px solid var(--rws-border); border-radius: var(--rws-radius);
      font-size: 0.8125rem; color: var(--rws-text); width: 140px;
    }
    .date-sep { font-size: 0.75rem; color: var(--rws-text-muted); }

    /* Summary Cards */
    .summary-grid {
      display: grid; grid-template-columns: repeat(6, 1fr); gap: 0.875rem; margin-bottom: 1.25rem;
    }
    .summary-card {
      display: flex; align-items: center; gap: 0.75rem;
      padding: 1rem; background: #fff; border-radius: 12px; border: 1px solid var(--rws-border);
      box-shadow: 0 1px 2px rgba(0,0,0,0.04);
    }
    .sc-icon {
      width: 40px; height: 40px; border-radius: 10px;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .sc-icon-svg { width: 20px; height: 20px; }
    .sc-icon-teams { background: #eef2ff; color: #4f46e5; }
    .sc-icon-clock { background: #ecfdf5; color: #059669; }
    .sc-icon-ot { background: #fef3c7; color: #d97706; }
    .sc-icon-attendance { background: #dbeafe; color: #2563eb; }
    .sc-icon-break { background: #fdf2f8; color: #db2777; }
    .sc-icon-alert { background: #fef2f2; color: #dc2626; }
    .sc-body { display: flex; flex-direction: column; }
    .sc-value { font-size: 1.25rem; font-weight: 700; color: var(--rws-text); line-height: 1.2; }
    .sc-label { font-size: 0.75rem; color: var(--rws-text-muted); margin-top: 0.125rem; }

    /* Charts */
    .charts-row { display: grid; grid-template-columns: 1.4fr 1fr; gap: 0.875rem; margin-bottom: 1.25rem; }
    .chart-card {
      background: #fff; border-radius: 12px; border: 1px solid var(--rws-border);
      padding: 1rem 1.25rem; box-shadow: 0 1px 2px rgba(0,0,0,0.04);
      min-width: 0; overflow: hidden;
    }
    .chart-title { margin: 0 0 0.75rem; font-size: 0.9375rem; font-weight: 600; color: var(--rws-text); }
    .chart-wrap { position: relative; width: 100%; min-height: 220px; max-height: 320px; }
    .chart-empty {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 0.625rem; padding: 3rem 1rem; color: var(--rws-text-muted);
    }
    .chart-empty-icon { width: 32px; height: 32px; opacity: 0.35; }
    .chart-empty span { font-size: 0.8125rem; }

    /* Table Card */
    .table-card {
      background: #fff; border-radius: 12px; border: 1px solid var(--rws-border);
      box-shadow: 0 1px 2px rgba(0,0,0,0.04); overflow: hidden;
    }
    .table-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 1rem 1.25rem; border-bottom: 1px solid var(--rws-border);
    }
    .table-title { margin: 0; font-size: 1rem; font-weight: 600; color: var(--rws-text); }
    .table-count { font-size: 0.8125rem; color: var(--rws-text-muted); }
    .table-wrap { overflow-x: auto; }
    .data-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
    .data-table th {
      text-align: left; padding: 0.75rem 1rem; font-size: 0.75rem; font-weight: 600;
      color: var(--rws-text-muted); text-transform: uppercase; letter-spacing: 0.04em;
      border-bottom: 1px solid var(--rws-border); background: var(--rws-bg);
      white-space: nowrap;
    }
    .th-sortable { cursor: pointer; user-select: none; }
    .th-inner { display: flex; align-items: center; gap: 0.25rem; }
    .sort-icon { width: 14px; height: 14px; }
    .sort-icon-dim { opacity: 0.3; }
    .data-table td {
      padding: 0.75rem 1rem; border-bottom: 1px solid var(--rws-border);
      color: var(--rws-text); vertical-align: middle;
    }
    .data-row { cursor: pointer; transition: background 100ms; }
    .data-row:hover { background: var(--rws-bg-hover); }
    .row-active { background: #f0fdf9; }
    .row-break { background: #fffbeb; }
    .emp-name-cell { display: flex; align-items: center; gap: 0.625rem; }
    .emp-dot {
      width: 8px; height: 8px; border-radius: 50%; background: #d1d5db; flex-shrink: 0;
    }
    .dot-active { background: #22c55e; box-shadow: 0 0 0 3px rgba(34,197,94,0.2); }
    .emp-name { display: block; font-weight: 600; font-size: 0.875rem; color: var(--rws-text); }
    .emp-email { display: block; font-size: 0.75rem; color: var(--rws-text-muted); margin-top: 1px; }
    .num { font-family: var(--rws-font-mono); text-align: right; white-space: nowrap; }
    .status-badge {
      display: inline-flex; align-items: center; padding: 0.25rem 0.625rem;
      border-radius: 999px; font-size: 0.75rem; font-weight: 600;
    }
    .badge-active { background: #dcfce7; color: #166534; }
    .badge-break { background: #fef3c7; color: #92400e; }
    .badge-clocked_out { background: #f3f4f6; color: #6b7280; }
    .att-bar-wrap { display: flex; align-items: center; gap: 0.5rem; min-width: 120px; }
    .att-bar { flex: 1; height: 6px; background: #e5e7eb; border-radius: 999px; overflow: hidden; }
    .att-bar-fill { height: 100%; border-radius: 999px; transition: width 300ms ease; }
    .att-excellent { background: #22c55e; }
    .att-good { background: #3b82f6; }
    .att-acceptable { background: #eab308; }
    .att-underworked { background: #f97316; }
    .att-absent { background: #ef4444; }
    .att-overtime { background: #8b5cf6; }
    .att-pct { font-size: 0.75rem; font-weight: 600; color: var(--rws-text-muted); min-width: 32px; text-align: right; }
    .eval-badge {
      display: inline-flex; padding: 0.25rem 0.625rem; border-radius: 999px;
      font-size: 0.75rem; font-weight: 600; text-transform: capitalize; white-space: nowrap;
    }
    .eval-excellent { background: #dcfce7; color: #166534; }
    .eval-good { background: #dbeafe; color: #1e40af; }
    .eval-acceptable { background: #fef9c3; color: #854d0e; }
    .eval-underworked { background: #ffedd5; color: #9a3412; }
    .eval-absent { background: #f3f4f6; color: #6b7280; }
    .eval-overtime { background: #ede9fe; color: #5b21b6; }
    .eval-day_off { background: #f0fdf4; color: #166534; }
    .eval-sm { font-size: 0.6875rem; padding: 0.125rem 0.5rem; }
    .row-arrow { width: 16px; height: 16px; color: var(--rws-text-muted); opacity: 0.4; }
    .empty-row { text-align: center; padding: 2rem 1rem; color: var(--rws-text-muted); }

    /* Pagination */
    .pagination {
      display: flex; align-items: center; justify-content: center; gap: 0.375rem;
      padding: 1rem; border-top: 1px solid var(--rws-border);
    }
    .pg-btn {
      display: flex; align-items: center; justify-content: center;
      min-width: 36px; height: 36px; border-radius: var(--rws-radius);
      border: 1px solid var(--rws-border); background: #fff; color: var(--rws-text);
      cursor: pointer; font-size: 0.875rem; font-weight: 500; transition: all 150ms;
    }
    .pg-btn:hover:not(:disabled) { border-color: var(--rws-accent); color: var(--rws-accent); }
    .pg-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .pg-active { background: var(--rws-accent); color: #fff; border-color: var(--rws-accent); }

    /* Skeleton */
    .table-skeleton { padding: 1.25rem; }
    .sk-row {
      display: flex; gap: 2rem; padding: 0.875rem 0;
      border-bottom: 1px solid var(--rws-border);
    }
    .sk {
      background: #f0f2f5; border-radius: 6px;
      animation: shimmer 1.5s ease-in-out infinite;
    }
    .sk-detail-block { height: 48px; margin-bottom: 0.75rem; border-radius: 8px; }
    @keyframes shimmer { 0%,100% { opacity:1; } 50% { opacity:0.5; } }

    /* Detail Panel (Overlay Slide-in) */
    .detail-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.3); z-index: 100;
      animation: fadeIn 200ms ease;
    }
    .detail-panel {
      position: fixed; top: 0; right: 0; bottom: 0;
      width: 480px; max-width: 100vw; background: #fff;
      box-shadow: -4px 0 24px rgba(0,0,0,0.12); z-index: 101;
      overflow-y: auto; animation: slideInRight 250ms ease;
    }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
    .detail-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--rws-border);
      position: sticky; top: 0; background: #fff; z-index: 1;
    }
    .detail-name { margin: 0; font-size: 1.125rem; font-weight: 700; color: var(--rws-text); }
    .detail-close {
      display: flex; align-items: center; justify-content: center;
      width: 32px; height: 32px; border-radius: 8px; border: none;
      background: transparent; cursor: pointer; color: var(--rws-text-muted); transition: background 150ms;
    }
    .detail-close:hover { background: var(--rws-bg); }
    .detail-skeleton { padding: 1.5rem; }
    .detail-body { padding: 1.25rem 1.5rem 2rem; }
    .det-summary {
      display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.75rem; margin-bottom: 1.25rem;
    }
    .det-stat {
      display: flex; flex-direction: column; padding: 0.75rem;
      background: var(--rws-bg); border-radius: 10px; text-align: center;
    }
    .det-stat-val { font-size: 1.125rem; font-weight: 700; color: var(--rws-text); font-family: var(--rws-font-mono); }
    .det-stat-lbl { font-size: 0.6875rem; color: var(--rws-text-muted); margin-top: 2px; }
    .det-details { display: flex; flex-direction: column; gap: 0.625rem; margin-bottom: 1.5rem; }
    .det-row {
      display: flex; justify-content: space-between; align-items: center;
      padding: 0.5rem 0; border-bottom: 1px solid var(--rws-border);
    }
    .det-label { font-size: 0.8125rem; color: var(--rws-text-muted); }
    .det-val { font-size: 0.875rem; font-weight: 600; font-family: var(--rws-font-mono); color: var(--rws-text); }
    .detail-section-title {
      margin: 0 0 0.875rem; font-size: 0.9375rem; font-weight: 600; color: var(--rws-text);
    }

    /* Timeline */
    .timeline { display: flex; flex-direction: column; gap: 0.625rem; }
    .tl-day {
      padding: 0.875rem 1rem; border: 1px solid var(--rws-border); border-radius: 10px;
      background: #fff; transition: background 150ms;
    }
    .tl-day:hover { background: var(--rws-bg); }
    .tl-absent { border-left: 3px solid #ef4444; }
    .tl-day-off { border-left: 3px solid #22c55e; background: #f0fdf9; }
    .tl-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.375rem; }
    .tl-date { font-weight: 600; font-size: 0.875rem; color: var(--rws-text); }
    .tl-times { display: flex; align-items: center; justify-content: space-between; font-size: 0.8125rem; color: var(--rws-text); }
    .tl-time { display: flex; align-items: center; gap: 0.375rem; }
    .tl-hours { font-family: var(--rws-font-mono); font-weight: 500; }
    .tl-breaks {
      display: flex; align-items: center; gap: 0.375rem; margin-top: 0.375rem;
      font-size: 0.8125rem; color: #9333ea;
    }
    .tl-ot { margin-top: 0.375rem; font-size: 0.8125rem; font-weight: 500; color: #d97706; }
    .tl-break-detail { display: flex; align-items: center; flex-wrap: wrap; gap: 0.25rem 0.375rem; margin-top: 0.25rem; font-size: 0.75rem; color: var(--rws-text-muted); }
    .tl-break-tag { font-size: 0.625rem; font-weight: 600; padding: 0.0625rem 0.375rem; border-radius: 4px; background: rgba(19,141,158,0.1); color: var(--rws-accent); white-space: nowrap; }
    .tl-break-tag.tl-break-auto { background: rgba(245,158,11,0.1); color: #d97706; }
    .tl-break-time { font-size: 0.6875rem; font-family: var(--rws-font-mono); color: var(--rws-text-muted); white-space: nowrap; }
    .tl-break-mins { font-size: 0.6875rem; color: var(--rws-text-muted); font-family: var(--rws-font-mono); }
    .tl-break-reason { font-style: italic; color: var(--rws-text); }
    .tl-break-auto-text { font-size: 0.6875rem; color: #d97706; font-weight: 500; }
    .tl-break-noreason { font-size: 0.6875rem; color: var(--rws-text-muted); font-style: italic; opacity: 0.7; }
    .tl-alert { margin-top: 0.375rem; font-size: 0.8125rem; font-weight: 500; color: #dc2626; }
    .tl-dayoff { font-size: 0.8125rem; color: #16a34a; font-style: italic; }
    .tl-absent-text { font-size: 0.8125rem; color: var(--rws-text-muted); font-style: italic; }

    .icon-sm { width: 16px; height: 16px; }
    .icon-xs { width: 14px; height: 14px; }

    @media (max-width: 1100px) {
      .summary-grid { grid-template-columns: repeat(3, 1fr); }
      .charts-row { grid-template-columns: 1fr; }
      .filter-bar { flex-direction: column; align-items: stretch; gap: 0.75rem; }
      .filter-left, .filter-right { justify-content: flex-start; flex-wrap: wrap; }
      .date-preset { font-size: 0.6875rem; padding: 0.3rem 0.5rem; }
    }
    @media (max-width: 768px) {
      .page-header { flex-direction: column; align-items: flex-start; gap: 0.75rem; }
      .summary-grid { grid-template-columns: repeat(2, 1fr); }
      .chart-wrap { min-height: 180px; }
      .detail-panel { width: 100vw; }
      .det-summary { grid-template-columns: repeat(2, 1fr); }
      .data-table { font-size: 0.8125rem; }
      .data-table th, .data-table td { padding: 0.5rem 0.625rem; }
      .emp-email { display: none; }
    }
    @media (max-width: 480px) {
      .summary-grid { grid-template-columns: 1fr 1fr; gap: 0.5rem; }
      .summary-card { padding: 0.75rem; }
      .sc-value { font-size: 1.05rem; }
      .charts-row { gap: 0.5rem; }
      .chart-card { padding: 0.75rem; }
      .chart-wrap { min-height: 160px; }
      .date-range { width: 100%; }
      .date-input { flex: 1; width: auto; }
    }
  `],
})
export class HrStatisticsComponent implements OnInit, OnDestroy {
  @ViewChild('dailyChart') dailyChart?: BaseChartDirective;
  @ViewChild('productiveChart') productiveChart?: BaseChartDirective;

  private readonly analyticsService = inject(HrAnalyticsService);
  private searchTimeout: ReturnType<typeof setTimeout> | null = null;

  protected readonly summary = signal<AnalyticsSummary | null>(null);
  protected readonly employees = signal<AnalyticsEmployee[]>([]);
  protected readonly pagination = signal({ page: 1, pageSize: 20, total: 0, totalPages: 0 });
  protected readonly loading = signal(true);
  protected readonly sortBy = signal('fullName');
  protected readonly sortDir = signal<'asc' | 'desc'>('asc');
  protected readonly searchTerm = '';
  protected statusFilter = '';
  protected attendanceFilter = '';
  protected startDate = '';
  protected endDate = '';
  protected activePreset = signal('Last 30 Days');
  protected readonly chartData = signal<ChartData | null>(null);
  protected readonly detailOpen = signal(false);
  protected readonly detailLoading = signal(false);
  protected readonly detailEmployee = signal<EmployeeDetailSummary | null>(null);
  protected readonly timeline = signal<TimelineEntry[]>([]);

  protected readonly datePresets = [
    { label: 'Last 7 Days', days: 7 },
    { label: 'Last 14 Days', days: 14 },
    { label: 'Last 30 Days', days: 30 },
    { label: 'Last 60 Days', days: 60 },
    { label: 'Last 90 Days', days: 90 },
  ];

  protected readonly columns = [
    { key: 'fullName', label: 'Employee' },
    { key: 'team', label: 'Team' },
    { key: 'currentStatus', label: 'Status' },
    { key: 'workedHours', label: 'Worked' },
    { key: 'expectedHours', label: 'Expected' },
    { key: 'overtimeHours', label: 'OT' },
    { key: 'attendancePct', label: 'Attendance' },
    { key: 'evaluation', label: 'Eval' },
    { key: '_arrow', label: '' },
  ];

  protected readonly barChartOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: true, position: 'bottom', labels: { boxWidth: 12, padding: 12, font: { size: 11 } } } },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 45 } },
      y: { beginAtZero: true, ticks: { font: { size: 10 } } },
    },
  };

  protected readonly horizontalBarOptions: ChartConfiguration<'bar'>['options'] = {
    indexAxis: 'y', responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { beginAtZero: true, ticks: { font: { size: 10 } } },
      y: { grid: { display: false }, ticks: { font: { size: 10 } } },
    },
  };

  protected readonly workedChartData = computed((): NgChartData<'bar'> => {
    const d = this.chartData()?.dailyData ?? [];
    return {
      labels: d.map((x) => x.date.substring(5)),
      datasets: [
        { label: 'Worked', data: d.map((x) => x.workedHours), backgroundColor: '#22c55e', borderRadius: 4 },
        { label: 'Overtime', data: d.map((x) => x.overtimeHours), backgroundColor: '#f97316', borderRadius: 4 },
      ],
    };
  });

  protected readonly productiveChartData = computed((): NgChartData<'bar'> => {
    const d = this.chartData()?.topProductive ?? [];
    return {
      labels: d.map((x) => x.name),
      datasets: [
        { label: 'Hours', data: d.map((x) => x.workedHours), backgroundColor: '#3b82f6', borderRadius: 4 },
      ],
    };
  });

  protected readonly pageNumbers = computed(() => {
    const p = this.pagination();
    const pages: number[] = [];
    const start = Math.max(1, p.page - 2);
    const end = Math.min(p.totalPages, p.page + 2);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  });

  ngOnInit(): void {
    this.setDatePreset(this.datePresets[2]);
  }

  ngOnDestroy(): void {
    if (this.searchTimeout) clearTimeout(this.searchTimeout);
  }

  protected setDatePreset(preset: { label: string; days: number }): void {
    this.activePreset.set(preset.label);
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - preset.days);
    this.startDate = start.toISOString().split('T')[0];
    this.endDate = end.toISOString().split('T')[0];
    this.pagination.update((p) => ({ ...p, page: 1 }));
    this.loadAll();
  }

  protected onDateChange(): void {
    this.activePreset.set('');
    this.pagination.update((p) => ({ ...p, page: 1 }));
    this.loadAll();
  }

  protected onSearch(): void {
    if (this.searchTimeout) clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.pagination.update((p) => ({ ...p, page: 1 }));
      this.loadEmployees();
    }, 300);
  }

  protected onSort(key: string): void {
    if (key === '_arrow' || key === 'team') return;
    if (this.sortBy() === key) {
      this.sortDir.update((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortBy.set(key);
      this.sortDir.set('asc');
    }
    this.loadEmployees();
  }

  protected goPage(page: number): void {
    this.pagination.update((p) => ({ ...p, page }));
    this.loadEmployees();
  }

  private loadAll(): void {
    this.loadSummary();
    this.loadEmployees();
    this.loadCharts();
  }

  private loadSummary(): void {
    this.analyticsService.getSummary(this.startDate, this.endDate).subscribe({
      next: (res) => this.summary.set(res),
    });
  }

  loadEmployees(): void {
    this.loading.set(true);
    const q: EmployeeQuery = {
      startDate: this.startDate,
      endDate: this.endDate,
      page: this.pagination().page,
      pageSize: this.pagination().pageSize,
      search: (this as any).searchTerm || '',
      status: this.statusFilter,
      attendance: this.attendanceFilter,
      sortBy: this.sortBy(),
      sortDir: this.sortDir(),
    };
    this.analyticsService.getEmployees(q).subscribe({
      next: (res) => {
        this.employees.set(res.employees);
        this.pagination.set(res.pagination);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private loadCharts(): void {
    this.analyticsService.getCharts(this.startDate, this.endDate).subscribe({
      next: (res) => {
        this.chartData.set(res);
        setTimeout(() => {
          this.dailyChart?.update();
          this.productiveChart?.update();
        }, 50);
      },
    });
  }

  protected openDetail(userId: number): void {
    this.detailOpen.set(true);
    this.detailLoading.set(true);
    this.detailEmployee.set(null);
    this.timeline.set([]);

    this.analyticsService.getEmployeeDetail(userId, this.startDate, this.endDate).subscribe({
      next: (res) => {
        this.detailEmployee.set(res);
        this.detailLoading.set(false);
      },
      error: () => this.detailLoading.set(false),
    });

    this.analyticsService.getTimeline(userId, this.startDate, this.endDate).subscribe({
      next: (res) => this.timeline.set(res.timeline),
    });
  }

  protected closeDetail(): void {
    this.detailOpen.set(false);
    this.detailEmployee.set(null);
    this.timeline.set([]);
  }

  protected exportCsv(): void {
    this.analyticsService.exportCsv({
      startDate: this.startDate,
      endDate: this.endDate,
      search: (this as any).searchTerm || '',
      status: this.statusFilter,
      attendance: this.attendanceFilter,
    });
  }
}
