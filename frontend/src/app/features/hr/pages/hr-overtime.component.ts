import { Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { LucideCalendarClock, LucideCheck, LucideXCircle } from '@lucide/angular';
import { HrOvertimeService } from '../services/hr-overtime.service';
import { HrOvertimeDeclaration } from '../models/hr.models';

@Component({
  selector: 'app-hr-overtime',
  imports: [DatePipe, TitleCasePipe, LucideCalendarClock, LucideCheck, LucideXCircle],
  template: `
    <div class="page-header">
      <h2 class="page-heading">Overtime Declarations</h2>
    </div>

    @if (loading()) {
      <div class="card">
        <div class="skeleton-list">
          @for (i of [1,2,3,4]; track i) {
            <div class="skeleton skeleton-row"></div>
          }
        </div>
      </div>
    } @else if (declarations().length === 0) {
      <div class="empty-state">
        <svg lucideCalendarClock class="empty-icon"></svg>
        <p class="empty-title">No overtime declarations</p>
        <p class="empty-sub">Declarations from employees will appear here.</p>
      </div>
    } @else {
      <div class="card">
        <div class="table-wrap">
          <table class="ot-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Date</th>
                <th class="num-col">Hours</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (decl of declarations(); track decl.id) {
                <tr>
                  <td class="name-cell">{{ decl.user?.fullName }}</td>
                  <td>{{ decl.date | date:'mediumDate' }}</td>
                  <td class="num-col">{{ decl.hours }}h</td>
                  <td class="reason-cell">{{ decl.reason }}</td>
                  <td>
                    <span class="status-badge" [class]="'status-' + decl.status">
                      {{ decl.status | titlecase }}
                    </span>
                  </td>
                  <td>
                    @if (decl.status === 'pending') {
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

    .table-wrap { overflow-x: auto; }

    .ot-table {
      width: 100%;
      border-collapse: collapse;

      th, td {
        padding: 0.75rem 1rem;
        text-align: left;
        border-bottom: 1px solid #f0f2f5;
        font-size: 0.875rem;
      }

      th {
        font-weight: 600;
        color: var(--rws-text-muted);
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        background: #fafbfc;
      }

      td { color: var(--rws-text); }
      tbody tr {
        transition: background 150ms ease;
        &:hover { background: #fafbfc; }
      }
      .num-col { text-align: right; }
      th.num-col { text-align: right; }
    }

    .name-cell { font-weight: 500; }

    .reason-cell {
      max-width: 200px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .status-badge {
      display: inline-flex;
      align-items: center;
      padding: 0.25rem 0.625rem;
      border-radius: 999px;
      font-size: 0.75rem;
      font-weight: 600;
      white-space: nowrap;
    }

    .status-pending { background: #fef3e2; color: #92610a; }
    .status-approved { background: #e8f8f6; color: #167d72; }
    .status-rejected { background: #fde8e8; color: #d64545; }

    .row-actions {
      display: flex;
      gap: 0.375rem;
    }

    .btn-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 30px;
      height: 30px;
      border: none;
      border-radius: var(--rws-radius);
      cursor: pointer;
      transition: background-color 150ms ease, transform 100ms ease;

      &:active { transform: scale(0.92); }
      &:focus-visible { outline: 3px solid var(--rws-focus-ring); outline-offset: 2px; }
    }

    .btn-approve {
      background: #e8f8f6;
      color: #167d72;
      &:hover { background: #d0f0ec; }
    }

    .btn-reject {
      background: #fde8e8;
      color: #d64545;
      &:hover { background: #fbd5d5; }
    }

    .resolved-text { color: var(--rws-text-muted); }

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
    .skeleton-row { height: 48px; }
    @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
    .icon-xs { width: 14px; height: 14px; }

    @media (max-width: 767px) {
      .ot-table { font-size: 0.8125rem; }
      .ot-table th, .ot-table td { padding: 0.625rem 0.75rem; }
    }
  `],
})
export class HrOvertimeComponent implements OnInit {
  private readonly overtimeService = inject(HrOvertimeService);
  protected readonly declarations = signal<HrOvertimeDeclaration[]>([]);
  protected readonly loading = signal(true);

  ngOnInit(): void {
    this.loadDeclarations();
  }

  private loadDeclarations(): void {
    this.overtimeService.getAllDeclarations().subscribe({
      next: (res) => {
        this.declarations.set(res.declarations);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  handleApprove(id: number): void {
    this.overtimeService.approve(id).subscribe({
      next: () => {
        this.declarations.update((list) =>
          list.map((d) => d.id === id ? { ...d, status: 'approved' as const } : d),
        );
      },
    });
  }

  handleReject(id: number): void {
    this.overtimeService.reject(id).subscribe({
      next: () => {
        this.declarations.update((list) =>
          list.map((d) => d.id === id ? { ...d, status: 'rejected' as const } : d),
        );
      },
    });
  }
}
