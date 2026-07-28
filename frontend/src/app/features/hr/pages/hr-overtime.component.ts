import { Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideCalendarClock, LucideCheck, LucideXCircle } from '@lucide/angular';
import { HrOvertimeService } from '../services/hr-overtime.service';
import { HrOvertimeDeclaration } from '../models/hr.models';

@Component({
  selector: 'app-hr-overtime',
  imports: [DatePipe, DecimalPipe, FormsModule, LucideCalendarClock, LucideCheck, LucideXCircle],
  template: `
    <div class="page-container">
      <div class="page-header">
        <h2 class="page-heading">Overtime Declarations</h2>
        <div class="header-actions">
          @if (!loading()) {
            <span class="result-count">{{ total() }} declaration{{ total() !== 1 ? 's' : '' }}</span>
          }
        </div>
      </div>

      <div class="filter-bar">
        <div class="filter-chips">
          @for (opt of statusOptions; track opt.value) {
            <button class="chip" [class.active]="activeStatus() === opt.value" (click)="setFilter('status', opt.value)">
              {{ opt.label }}
            </button>
          }
        </div>
      </div>

      @if (loading()) {
        <div class="card">
          <div class="sk-list-padded">
            @for (i of [1,2,3,4,5]; track i) {
              <div class="sk sk-row"></div>
            }
          </div>
        </div>
      } @else if (declarations().length === 0) {
        <div class="empty-state">
          <svg lucideCalendarClock class="empty-icon"></svg>
          <p class="empty-title">No declarations found</p>
          <p class="empty-sub">Try adjusting your filters to see more results.</p>
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
                      <span class="status-badge" [class]="'status-' + decl.status">
                        {{ statusLabel(decl.status) }}
                      </span>
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
    .page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
    .page-heading { margin: 0; font-size: 1.375rem; font-weight: 700; color: var(--rws-text); }

    .header-actions { display: flex; align-items: center; gap: 0.75rem; }
    .result-count { font-size: 0.875rem; color: var(--rws-text-muted); }

    .filter-bar { margin-bottom: 1rem; }
    .filter-chips { display: flex; gap: 0.5rem; flex-wrap: wrap; }

    .chip {
      padding: 0.375rem 0.875rem;
      border-radius: 999px;
      border: 1px solid var(--rws-border);
      background: #fff;
      font-size: 0.8125rem;
      font-weight: 500;
      color: var(--rws-text-muted);
      cursor: pointer;
      transition: all 150ms ease;

      &:hover { border-color: var(--rws-accent); color: var(--rws-accent); }
      &.active { background: var(--rws-accent); color: #fff; border-color: var(--rws-accent); }
    }

    .card {
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
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
      max-width: 160px;
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
    .resolved-text { color: var(--rws-text-muted); font-size: 0.75rem; }

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

    .pagination {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 1rem;
      padding: 1rem;
      border-top: 1px solid #f0f2f5;
    }

    .page-info { font-size: 0.8125rem; color: var(--rws-text-muted); }

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

    .icon-xs { width: 14px; height: 14px; }

    @media (max-width: 767px) {
      .ot-table { font-size: 0.75rem; }
      .ot-table th, .ot-table td { padding: 0.5rem 0.625rem; }
    }
  `],
})
export class HrOvertimeComponent implements OnInit {
  private readonly overtimeService = inject(HrOvertimeService);

  protected readonly declarations = signal<HrOvertimeDeclaration[]>([]);
  protected readonly loading = signal(true);
  protected readonly total = signal(0);
  protected readonly currentPage = signal(1);
  protected readonly totalPages = signal(1);
  protected readonly pageSize = 50;

  protected readonly activeStatus = signal<string>('');

  readonly statusOptions = [
    { value: '', label: 'All' },
    { value: 'submitted', label: 'Pending Review' },
    { value: 'detected', label: 'Detected' },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'cancelled', label: 'Cancelled' },
  ];

  ngOnInit(): void {
    this.loadDeclarations();
  }

  private loadDeclarations(): void {
    this.loading.set(true);
    this.overtimeService.getAllDeclarations({
      status: this.activeStatus() || undefined,
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

  setFilter(key: string, value: string): void {
    if (key === 'status') {
      this.activeStatus.set(value);
      this.currentPage.set(1);
      this.loadDeclarations();
    }
  }

  goToPage(page: number): void {
    this.currentPage.set(page);
    this.loadDeclarations();
  }

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

  handleApprove(id: number): void {
    this.overtimeService.approve(id).subscribe({
      next: () => this.loadDeclarations(),
    });
  }

  handleReject(id: number): void {
    this.overtimeService.reject(id).subscribe({
      next: () => this.loadDeclarations(),
    });
  }
}
