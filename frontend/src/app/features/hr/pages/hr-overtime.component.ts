import { Component, inject, OnInit, signal, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  LucideCalendarClock, LucideCheck, LucideXCircle, LucideSearch, LucideX,
  LucideHourglass, LucideUserCheck, LucideUserX, LucideClock,
} from '@lucide/angular';
import { HrOvertimeService, HrOvertimeStats } from '../services/hr-overtime.service';
import { HrOvertimeDeclaration } from '../models/hr.models';
import { RealtimeService, OvertimeStatusEvent } from '../../../core/services/realtime.service';

type TabKey = 'pending' | 'approved' | 'rejected' | 'all';

@Component({
  selector: 'app-hr-overtime',
  imports: [
    DatePipe, DecimalPipe, FormsModule,
    LucideCalendarClock, LucideCheck, LucideXCircle, LucideSearch, LucideX,
    LucideHourglass, LucideUserCheck, LucideUserX, LucideClock,
  ],
  template: `
    <div class="page-container">
      <div class="page-header">
        <h1 class="page-title">Overtime Management</h1>
      </div>

      <!-- ============================================ -->
      <!-- STATISTICS CARDS                             -->
      <!-- ============================================ -->
      @if (statsLoading()) {
        <div class="stats-skeleton">
          @for (i of [1,2,3,4,5,6]; track i) {
            <div class="sk-stat"></div>
          }
        </div>
      } @else {
        <div class="stats-grid">
          <div class="stat-card stat-pending">
            <div class="stat-card-icon"><svg lucideHourglass class="icon-lg"></svg></div>
            <div class="stat-card-body">
              <span class="stat-card-value">{{ stats().pendingCount }}</span>
              <span class="stat-card-label">Pending Requests</span>
            </div>
          </div>
          <div class="stat-card stat-approved">
            <div class="stat-card-icon"><svg lucideUserCheck class="icon-lg"></svg></div>
            <div class="stat-card-body">
              <span class="stat-card-value">{{ stats().approvedToday }}</span>
              <span class="stat-card-label">Approved Today</span>
            </div>
          </div>
          <div class="stat-card stat-rejected">
            <div class="stat-card-icon"><svg lucideUserX class="icon-lg"></svg></div>
            <div class="stat-card-body">
              <span class="stat-card-value">{{ stats().rejectedToday }}</span>
              <span class="stat-card-label">Rejected Today</span>
            </div>
          </div>
          <div class="stat-card stat-pending">
            <div class="stat-card-icon"><svg lucideClock class="icon-lg"></svg></div>
            <div class="stat-card-body">
              <span class="stat-card-value">{{ stats().pendingHours }}</span>
              <span class="stat-card-label">Pending Hours</span>
            </div>
          </div>
          <div class="stat-card stat-approved">
            <div class="stat-card-icon"><svg lucideCalendarClock class="icon-lg"></svg></div>
            <div class="stat-card-body">
              <span class="stat-card-value">{{ stats().approvedHoursThisWeek }}</span>
              <span class="stat-card-label">Approved Hours (Week)</span>
            </div>
          </div>
          <div class="stat-card stat-rejected">
            <div class="stat-card-icon"><svg lucideXCircle class="icon-lg"></svg></div>
            <div class="stat-card-body">
              <span class="stat-card-value">{{ stats().rejectedHoursThisWeek }}</span>
              <span class="stat-card-label">Rejected Hours (Week)</span>
            </div>
          </div>
        </div>
      }

      <!-- ============================================ -->
      <!-- TABS + FILTERS                               -->
      <!-- ============================================ -->
      <div class="toolbar">
        <div class="tabs">
          @for (tab of tabs; track tab.key) {
            <button
              class="tab"
              [class.active]="activeTab() === tab.key"
              (click)="switchTab(tab.key)"
            >
              {{ tab.label }}
              @if (tab.key === 'pending' && stats().pendingCount > 0) {
                <span class="tab-badge">{{ stats().pendingCount }}</span>
              }
            </button>
          }
        </div>
        <div class="toolbar-right">
          <span class="result-count">{{ total() }} result{{ total() !== 1 ? 's' : '' }}</span>
        </div>
      </div>

      <div class="filter-bar">
        <div class="filter-row">
          <div class="search-box">
            <svg lucideSearch class="search-icon" aria-hidden="true"></svg>
            <input
              class="search-input"
              type="text"
              placeholder="Search reason or notes..."
              [(ngModel)]="searchQuery"
              (ngModelChange)="onSearchChange()"
            />
            @if (searchQuery()) {
              <button class="search-clear" type="button" (click)="searchQuery.set(''); applyFilters()">
                <svg lucideX class="icon-xs"></svg>
              </button>
            }
          </div>
          <select class="form-input form-select" [(ngModel)]="filterSort" (ngModelChange)="applyFilters()">
            <option value="createdAt:desc">Newest</option>
            <option value="createdAt:asc">Oldest</option>
            <option value="overtimeMinutes:desc">Longest</option>
            <option value="overtimeMinutes:asc">Shortest</option>
          </select>
        </div>
        <div class="filter-row secondary">
          <div class="filter-date">
            <input class="form-input" type="date" [(ngModel)]="filterDateFrom" (ngModelChange)="applyFilters()" placeholder="From" />
            <span class="date-sep">—</span>
            <input class="form-input" type="date" [(ngModel)]="filterDateTo" (ngModelChange)="applyFilters()" placeholder="To" />
          </div>
          <div class="filter-duration">
            <input class="form-input" type="number" min="0" step="0.5" [(ngModel)]="filterMinHours" (ngModelChange)="applyFilters()" placeholder="Min hrs" />
            <span class="date-sep">—</span>
            <input class="form-input" type="number" min="0" step="0.5" [(ngModel)]="filterMaxHours" (ngModelChange)="applyFilters()" placeholder="Max hrs" />
          </div>
        </div>
      </div>

      <!-- ============================================ -->
      <!-- TABLE                                        -->
      <!-- ============================================ -->
      @if (loading()) {
        <div class="card">
          <div class="sk-list-padded">
            @for (i of [1,2,3,4,5]; track i) {
              <div class="sk sk-row"></div>
            }
          </div>
        </div>
      } @else if (declarations().length === 0) {
        <div class="card empty-card">
          <div class="empty-state">
            <svg lucideCalendarClock class="empty-icon" aria-hidden="true"></svg>
            <p class="empty-title">
              @if (activeTab() === 'pending') { No pending overtime requests }
              @else { No overtime declarations found }
            </p>
            <p class="empty-sub">Try adjusting your filters to see more results.</p>
          </div>
        </div>
      } @else {
        <div class="card">
          <div class="table-wrap">
            <table class="ot-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Date</th>
                  <th class="num-col">Worked</th>
                  <th class="num-col">Expected</th>
                  <th class="num-col">Overtime</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Submitted</th>
                  <th>Reviewer</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                @for (decl of declarations(); track decl.id) {
                  <tr>
                    <td class="name-cell">{{ decl.user?.fullName }}</td>
                    <td>{{ decl.date | date:'mediumDate' }}</td>
                    <td class="num-col">{{ (decl.workedMinutes / 60) | number:'1.1-1' }}h</td>
                    <td class="num-col">{{ (decl.expectedMinutes / 60) | number:'1.1-1' }}h</td>
                    <td class="num-col td-ot">{{ (decl.overtimeMinutes / 60) | number:'1.1-1' }}h</td>
                    <td class="reason-cell">{{ reasonLabel(decl.reason) }}</td>
                    <td>
                      <span class="status-badge" [class]="'status-' + decl.status">{{ statusLabel(decl.status) }}</span>
                    </td>
                    <td class="date-cell">{{ decl.justificationSubmittedAt ? (decl.justificationSubmittedAt | date:'short') : '—' }}</td>
                    <td>{{ decl.reviewer?.fullName || '—' }}</td>
                    <td>
                      @if (decl.status === 'submitted') {
                        <div class="row-actions">
                          <button class="btn-icon btn-approve" (click)="handleApprove(decl.id)" title="Approve">
                            <svg lucideCheck class="icon-xs"></svg>
                          </button>
                          <button class="btn-icon btn-reject" (click)="handleReject(decl.id)" title="Reject">
                            <svg lucideXCircle class="icon-xs"></svg>
                          </button>
                        </div>
                      } @else if (decl.status === 'approved') {
                        <span class="resolved-text resolved-ok">Approved</span>
                      } @else if (decl.status === 'rejected') {
                        <span class="resolved-text resolved-no">Rejected</span>
                      } @else {
                        <span class="resolved-text">—</span>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          @if (totalPages() > 1) {
            <div class="pagination">
              <button class="btn btn-ghost btn-sm" [disabled]="currentPage() <= 1" (click)="goToPage(currentPage() - 1)">Previous</button>
              <span class="page-info">Page {{ currentPage() }} of {{ totalPages() }}</span>
              <button class="btn btn-ghost btn-sm" [disabled]="currentPage() >= totalPages()" (click)="goToPage(currentPage() + 1)">Next</button>
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
      margin-bottom: 1.25rem;
    }

    .page-title {
      margin: 0;
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--rws-text);
    }

    /* ============================================ */
    /* STATISTICS                                   */
    /* ============================================ */
    .stats-skeleton {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
      gap: 0.75rem;
      margin-bottom: 1.25rem;
    }

    .sk-stat {
      height: 90px;
      background: linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
      border-radius: 12px;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
      gap: 0.75rem;
      margin-bottom: 1.25rem;
    }

    .stat-card {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 1rem;
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    }

    .stat-card-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      border-radius: 10px;
      flex-shrink: 0;
    }

    .stat-pending .stat-card-icon { background: #e8f1fb; color: #2b3a67; }
    .stat-approved .stat-card-icon { background: #e8f8f6; color: #167d72; }
    .stat-rejected .stat-card-icon { background: #fde8e8; color: #d64545; }

    .stat-card-body {
      display: flex;
      flex-direction: column;
    }

    .stat-card-value {
      font-size: 1.375rem;
      font-weight: 700;
      color: var(--rws-text);
      line-height: 1.2;
    }

    .stat-card-label {
      font-size: 0.6875rem;
      color: var(--rws-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .icon-lg { width: 22px; height: 22px; }

    /* ============================================ */
    /* TOOLBAR + TABS                               */
    /* ============================================ */
    .toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 0.75rem;
    }

    .tabs {
      display: flex;
      gap: 0.25rem;
      background: var(--rws-bg);
      border-radius: 10px;
      padding: 0.25rem;
    }

    .tab {
      padding: 0.5rem 1rem;
      border: none;
      border-radius: 8px;
      background: transparent;
      font-size: 0.8125rem;
      font-weight: 500;
      color: var(--rws-text-muted);
      cursor: pointer;
      transition: all 150ms ease;
      font-family: inherit;
      display: flex;
      align-items: center;
      gap: 0.375rem;

      &:hover { color: var(--rws-text); }
      &.active {
        background: #fff;
        color: var(--rws-text);
        font-weight: 600;
        box-shadow: 0 1px 3px rgba(0,0,0,0.08);
      }
    }

    .tab-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 20px;
      height: 20px;
      padding: 0 0.375rem;
      border-radius: 999px;
      background: #e8f1fb;
      color: #2b3a67;
      font-size: 0.6875rem;
      font-weight: 600;
    }

    .toolbar-right {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .result-count { font-size: 0.875rem; color: var(--rws-text-muted); }

    /* ============================================ */
    /* FILTERS                                      */
    /* ============================================ */
    .filter-bar {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      margin-bottom: 1rem;
    }

    .filter-row {
      display: flex;
      gap: 0.625rem;
      flex-wrap: wrap;
      align-items: center;

      &.secondary { gap: 0.75rem; }
    }

    .search-box {
      position: relative;
      flex: 1;
      min-width: 200px;
    }

    .search-icon {
      position: absolute;
      left: 0.75rem;
      top: 50%;
      transform: translateY(-50%);
      width: 16px;
      height: 16px;
      color: var(--rws-text-muted);
      pointer-events: none;
    }

    .search-input {
      width: 100%;
      padding: 0.5rem 2.25rem 0.5rem 2.25rem;
      border: 1px solid var(--rws-border);
      border-radius: var(--rws-radius);
      font-size: 0.875rem;
      font-family: inherit;
      color: var(--rws-text);
      background: #fff;
      transition: border-color 150ms ease;
      &:focus { outline: none; border-color: var(--rws-accent); box-shadow: 0 0 0 2px rgba(31, 182, 166, 0.15); }
      &::placeholder { color: var(--rws-text-muted); }
    }

    .search-clear {
      position: absolute;
      right: 0.375rem;
      top: 50%;
      transform: translateY(-50%);
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      border: none;
      border-radius: var(--rws-radius);
      background: transparent;
      color: var(--rws-text-muted);
      cursor: pointer;
      &:hover { background: var(--rws-bg); }
    }

    .filter-selects {
      display: flex;
      gap: 0.5rem;
    }

    .filter-date, .filter-duration {
      display: flex;
      align-items: center;
      gap: 0.375rem;
    }

    .date-sep { color: var(--rws-text-muted); font-size: 0.875rem; }

    .form-input {
      padding: 0.5rem 0.625rem;
      border: 1px solid var(--rws-border);
      border-radius: var(--rws-radius);
      font-size: 0.8125rem;
      font-family: inherit;
      color: var(--rws-text);
      background: #fff;
      transition: border-color 150ms ease;
      max-width: 160px;
      &:focus { outline: none; border-color: var(--rws-accent); box-shadow: 0 0 0 2px rgba(31, 182, 166, 0.15); }
    }

    .form-select {
      appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 0.5rem center;
      background-size: 14px;
      padding-right: 2rem;
    }

    /* ============================================ */
    /* TABLE                                        */
    /* ============================================ */
    .card, .empty-card {
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    }

    .table-wrap { overflow-x: auto; }

    .ot-table {
      width: 100%;
      border-collapse: collapse;

      th, td {
        padding: 0.75rem 0.875rem;
        text-align: left;
        border-bottom: 1px solid #f0f2f5;
        font-size: 0.8125rem;
      }

      th {
        font-weight: 600;
        color: var(--rws-text-muted);
        font-size: 0.6875rem;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        background: #fafbfc;
        white-space: nowrap;
      }

      td { color: var(--rws-text); }
      tbody tr {
        transition: background 150ms ease;
        &:hover { background: #fafbfc; }
      }
      .num-col { text-align: right; }
      th.num-col { text-align: right; }
    }

    .name-cell { font-weight: 500; white-space: nowrap; }
    .td-ot { color: #d9973b; font-weight: 600; }
    .date-cell { font-size: 0.75rem; white-space: nowrap; }

    .reason-cell {
      max-width: 140px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .status-badge {
      display: inline-flex;
      align-items: center;
      padding: 0.25rem 0.5rem;
      border-radius: 999px;
      font-size: 0.6875rem;
      font-weight: 600;
      white-space: nowrap;
    }

    .status-detected { background: #fef3e2; color: #92610a; }
    .status-submitted { background: #e8f1fb; color: #2b3a67; }
    .status-approved { background: #e8f8f6; color: #167d72; }
    .status-rejected { background: #fde8e8; color: #d64545; }
    .status-cancelled { background: #f3f4f6; color: #6b7280; }

    .row-actions { display: flex; gap: 0.25rem; }

    .btn-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border: none;
      border-radius: var(--rws-radius);
      cursor: pointer;
      transition: background-color 150ms ease, transform 100ms ease;

      &:active { transform: scale(0.92); }
      &:focus-visible { outline: 3px solid var(--rws-focus-ring); outline-offset: 2px; }
    }

    .btn-approve { background: #e8f8f6; color: #167d72; &:hover { background: #d0f0ec; } }
    .btn-reject { background: #fde8e8; color: #d64545; &:hover { background: #fbd5d5; } }

    .resolved-text {
      font-size: 0.75rem;
      color: var(--rws-text-muted);
      &.resolved-ok { color: #167d72; font-weight: 500; }
      &.resolved-no { color: #d64545; font-weight: 500; }
    }

    /* ============================================ */
    /* PAGINATION                                   */
    /* ============================================ */
    .pagination {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 1rem;
      padding: 1rem;
      border-top: 1px solid #f0f2f5;
    }

    .page-info { font-size: 0.8125rem; color: var(--rws-text-muted); }

    /* ============================================ */
    /* BUTTONS                                      */
    /* ============================================ */
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.375rem;
      padding: 0.375rem 0.75rem;
      border: none;
      border-radius: var(--rws-radius);
      font-size: 0.8125rem;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
      transition: opacity 150ms ease;
      &:hover:not(:disabled) { opacity: 0.9; }
      &:disabled { opacity: 0.5; cursor: not-allowed; }
      &:focus-visible { outline: 3px solid var(--rws-focus-ring); outline-offset: 2px; }
    }

    .btn-sm { font-size: 0.75rem; padding: 0.25rem 0.5rem; }
    .btn-ghost { background: transparent; color: var(--rws-text-muted); border: 1px solid var(--rws-border); }

    .icon-xs { width: 14px; height: 14px; }

    /* ============================================ */
    /* EMPTY STATES                                 */
    /* ============================================ */
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 4rem 0;
      text-align: center;
    }

    .empty-icon { width: 48px; height: 48px; color: var(--rws-text-muted); opacity: 0.4; margin-bottom: 1rem; }
    .empty-title { margin: 0 0 0.375rem; font-size: 1.0625rem; font-weight: 600; color: var(--rws-text); }
    .empty-sub { margin: 0; font-size: 0.875rem; color: var(--rws-text-muted); }

    /* ============================================ */
    /* SKELETON                                     */
    /* ============================================ */
    .sk-list-padded { display: flex; flex-direction: column; gap: 0.5rem; padding: 1rem; }

    .sk-row {
      height: 48px;
      background: linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
      border-radius: 8px;
    }

    @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }

    @media (max-width: 767px) {
      .stats-grid { grid-template-columns: repeat(2, 1fr); }
      .filter-row { flex-direction: column; align-items: stretch; }
      .filter-selects { flex-direction: column; }
      .search-box { min-width: 0; }
      .form-input { max-width: 100%; }
      .ot-table { font-size: 0.75rem; }
      .ot-table th, .ot-table td { padding: 0.5rem 0.625rem; }
      .filter-date, .filter-duration { flex-wrap: wrap; }
    }
  `],
})
export class HrOvertimeComponent implements OnInit {
  private readonly overtimeService = inject(HrOvertimeService);
  private readonly realtime = inject(RealtimeService);
  private readonly destroyRef = inject(DestroyRef);

  /* ---- Tabs ---- */
  protected readonly activeTab = signal<TabKey>('pending');
  protected readonly tabs: { key: TabKey; label: string }[] = [
    { key: 'pending', label: 'Pending' },
    { key: 'approved', label: 'Approved' },
    { key: 'rejected', label: 'Rejected' },
    { key: 'all', label: 'All' },
  ];

  /* ---- Data ---- */
  protected readonly declarations = signal<HrOvertimeDeclaration[]>([]);
  protected readonly loading = signal(true);
  protected readonly total = signal(0);
  protected readonly currentPage = signal(1);
  protected readonly totalPages = signal(1);
  protected readonly pageSize = 50;

  /* ---- Stats ---- */
  protected readonly stats = signal<HrOvertimeStats>({
    pendingCount: 0, approvedToday: 0, rejectedToday: 0,
    pendingHours: 0, approvedHoursThisWeek: 0, rejectedHoursThisWeek: 0,
  });
  protected readonly statsLoading = signal(true);

  /* ---- Filters ---- */
  protected readonly searchQuery = signal('');
  protected readonly filterSort = signal('createdAt:desc');
  protected readonly filterDateFrom = signal('');
  protected readonly filterDateTo = signal('');
  protected readonly filterMinHours = signal<number | null>(null);
  protected readonly filterMaxHours = signal<number | null>(null);

  private searchTimeout: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.loadStats();
    this.loadDeclarations();
    this.subscribeToRealtime();
  }

  /* ---- Stats ---- */
  private loadStats(): void {
    this.statsLoading.set(true);
    this.overtimeService.getHrStats().subscribe({
      next: (res) => {
        this.stats.set(res);
        this.statsLoading.set(false);
      },
      error: () => this.statsLoading.set(false),
    });
  }

  /* ---- Data Loading ---- */
  private loadDeclarations(): void {
    const tab = this.activeTab();

    if (tab === 'pending') {
      this.loading.set(true);
      this.overtimeService.getPendingDeclarations({
        search: this.searchQuery() || undefined,
        dateFrom: this.filterDateFrom() || undefined,
        dateTo: this.filterDateTo() || undefined,
        page: this.currentPage(),
        pageSize: this.pageSize,
      }).subscribe({
        next: (res) => {
          this.declarations.set(res.declarations);
          this.total.set(res.total);
          this.totalPages.set(res.totalPages);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
    } else {
      this.loading.set(true);
      const [sortBy, sortOrder] = this.filterSort().split(':') as [string, string];
      this.overtimeService.getAllDeclarations({
        status: tab === 'all' ? undefined : tab,
        search: this.searchQuery() || undefined,
        dateFrom: this.filterDateFrom() || undefined,
        dateTo: this.filterDateTo() || undefined,
        minDuration: this.filterMinHours() !== null ? this.filterMinHours()! * 60 : undefined,
        maxDuration: this.filterMaxHours() !== null ? this.filterMaxHours()! * 60 : undefined,
        sortBy,
        sortOrder,
        limit: this.pageSize,
        page: this.currentPage(),
      }).subscribe({
        next: (res) => {
          this.declarations.set(res.declarations);
          this.total.set(res.total);
          this.totalPages.set(res.totalPages);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
    }
  }

  /* ---- Tab Switching ---- */
  switchTab(tab: TabKey): void {
    if (this.activeTab() === tab) return;
    this.activeTab.set(tab);
    this.currentPage.set(1);
    this.loadDeclarations();
  }

  /* ---- Filters ---- */
  onSearchChange(): void {
    if (this.searchTimeout) clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => this.applyFilters(), 300);
  }

  applyFilters(): void {
    this.currentPage.set(1);
    this.loadDeclarations();
  }

  goToPage(page: number): void {
    this.currentPage.set(page);
    this.loadDeclarations();
  }

  /* ---- Actions ---- */
  handleApprove(id: number): void {
    this.overtimeService.approve(id).subscribe({
      next: () => {
        this.loadDeclarations();
        this.loadStats();
      },
    });
  }

  handleReject(id: number): void {
    this.overtimeService.reject(id).subscribe({
      next: () => {
        this.loadDeclarations();
        this.loadStats();
      },
    });
  }

  /* ---- Real-time ---- */
  private subscribeToRealtime(): void {
    this.realtime.overtimeChanged$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.loadDeclarations();
        this.loadStats();
      });

    this.realtime.overtimeDetected$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.loadDeclarations();
        this.loadStats();
      });
  }

  /* ---- Helpers ---- */
  reasonLabel(reason?: string): string {
    if (!reason) return '—';
    const labels: Record<string, string> = {
      project_deadline: 'Project Deadline',
      urgent_task: 'Urgent Task',
      client_request: 'Client Request',
      system_maintenance: 'System Maintenance',
      team_collaboration: 'Team Collaboration',
      meeting_overtime: 'Meeting Overtime',
      other: 'Other',
    };
    return labels[reason] || reason;
  }

  statusLabel(status: string): string {
    const labels: Record<string, string> = {
      detected: 'Detected',
      submitted: 'Pending Review',
      approved: 'Approved',
      rejected: 'Rejected',
      cancelled: 'Cancelled',
    };
    return labels[status] || status;
  }
}
