import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe, DecimalPipe } from '@angular/common';
import { LucideClock, LucideCheck, LucideXCircle, LucideAlertTriangle, LucideSend } from '@lucide/angular';
import { OvertimeService } from '../services/overtime.service';
import { OvertimeDeclaration } from '../models/employee.models';

@Component({
  selector: 'app-employee-overtime',
  imports: [FormsModule, DatePipe, DecimalPipe, LucideClock, LucideCheck, LucideXCircle, LucideAlertTriangle, LucideSend],
  template: `
    <div class="page-container">
      <div class="page-header">
        <h1 class="page-title">Overtime</h1>
      </div>

      @if (loading()) {
        <div class="sk-list">
          @for (i of [1,2,3]; track i) {
            <div class="sk sk-row-lg"></div>
          }
        </div>
      } @else if (declarations().length === 0) {
        <div class="empty-state">
          <svg lucideClock class="empty-icon" aria-hidden="true"></svg>
          <p class="empty-text">No overtime recorded</p>
          <p class="empty-sub">Overtime is automatically detected when you work more than your expected hours.</p>
        </div>
      } @else {
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th class="th-hours">Worked</th>
                <th class="th-hours">Expected</th>
                <th class="th-hours">Overtime</th>
                <th>Reason</th>
                <th class="th-status">Status</th>
                <th class="th-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (d of declarations(); track d.id) {
                <tr>
                  <td class="td-date">{{ d.date | date:'mediumDate' }}</td>
                  <td class="td-hours">{{ (d.workedMinutes / 60) | number:'1.1-1' }}h</td>
                  <td class="td-hours">{{ (d.expectedMinutes / 60) | number:'1.1-1' }}h</td>
                  <td class="td-hours td-ot">{{ (d.overtimeMinutes / 60) | number:'1.1-1' }}h</td>
                  <td class="td-reason">{{ d.reason || '—' }}</td>
                  <td class="td-status">
                    <span class="status-badge" [class]="'status-' + d.status">
                      @switch (d.status) {
                        @case ('detected') { <svg lucideAlertTriangle class="icon-xs"></svg> Pending }
                        @case ('submitted') { <svg lucideClock class="icon-xs"></svg> Pending Review }
                        @case ('approved') { <svg lucideCheck class="icon-xs"></svg> Approved }
                        @case ('rejected') { <svg lucideXCircle class="icon-xs"></svg> Rejected }
                        @case ('cancelled') { <svg lucideXCircle class="icon-xs"></svg> Cancelled }
                      }
                    </span>
                  </td>
                  <td class="td-actions">
                    @if (d.status === 'detected') {
                      <button class="btn btn-primary btn-sm" type="button" (click)="openSubmitDialog(d)">
                        <svg lucideSend class="icon-xs"></svg>
                        Submit
                      </button>
                      <button class="btn btn-ghost btn-sm" type="button" (click)="handleCancel(d.id)">
                        Cancel
                      </button>
                    }
                    @if (d.status === 'submitted') {
                      <button class="btn btn-ghost btn-sm" type="button" (click)="handleCancel(d.id)">
                        Cancel
                      </button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      @if (submitDialogOpen()) {
        <div class="dialog-overlay" (click)="closeSubmitDialog()"></div>
        <div class="dialog" role="dialog" aria-modal="true" aria-label="Submit Overtime Justification">
          <div class="dialog-header">
            <h2 class="dialog-title">Overtime Justification</h2>
            <button class="dialog-close" type="button" (click)="closeSubmitDialog()" aria-label="Close">
              <svg lucideXCircle class="icon-sm"></svg>
            </button>
          </div>
          <div class="dialog-body">
            <div class="readonly-stats">
              <div class="stat-item">
                <span class="stat-label">Worked</span>
                <span class="stat-value">{{ (selectedOt()?.workedMinutes ?? 0) / 60 | number:'1.1-1' }}h</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">Expected</span>
                <span class="stat-value">{{ (selectedOt()?.expectedMinutes ?? 0) / 60 | number:'1.1-1' }}h</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">Overtime</span>
                <span class="stat-value ot">{{ (selectedOt()?.overtimeMinutes ?? 0) / 60 | number:'1.1-1' }}h</span>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label" for="ot-reason">Reason</label>
              <select class="form-input" id="ot-reason" [(ngModel)]="submitReason">
                <option value="">Select a reason...</option>
                <option value="project_deadline">Project Deadline</option>
                <option value="urgent_task">Urgent Task</option>
                <option value="client_request">Client Request</option>
                <option value="system_maintenance">System Maintenance</option>
                <option value="team_collaboration">Team Collaboration</option>
                <option value="meeting_overtime">Meeting Overtime</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="ot-notes">Additional Notes (optional)</label>
              <textarea class="form-input form-textarea" id="ot-notes" [(ngModel)]="submitNotes" rows="3" placeholder="Optional details about this overtime..."></textarea>
            </div>
            @if (submitError()) {
              <p class="form-error">{{ submitError() }}</p>
            }
          </div>
          <div class="dialog-footer">
            <button class="btn btn-secondary" type="button" (click)="closeSubmitDialog()">Cancel</button>
            <button class="btn btn-primary" type="button" (click)="submitJustification()" [disabled]="submitSubmitting() || !submitReason()">
              {{ submitSubmitting() ? 'Submitting...' : 'Submit Justification' }}
            </button>
          </div>
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

    .icon-sm { width: 16px; height: 16px; }
    .icon-xs { width: 14px; height: 14px; }

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

    .table-wrapper {
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
      overflow-x: auto;
    }

    .data-table { width: 100%; border-collapse: collapse; }

    th, td { text-align: left; padding: 0.875rem 1rem; }

    thead tr { border-bottom: 1px solid var(--rws-border); background: var(--rws-bg); }

    th {
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--rws-text-muted);
    }

    .th-date { width: 1%; white-space: nowrap; }
    .th-status, .th-actions { text-align: center; width: 120px; }
    .th-hours { text-align: right; width: 100px; }

    tbody tr {
      border-bottom: 1px solid var(--rws-border);
      &:last-child { border-bottom: none; }
      &:hover { background: #fafbfc; }
    }

    .td-date { font-weight: 500; color: var(--rws-text); white-space: nowrap; }
    .td-hours { text-align: right; font-family: var(--rws-font-mono); font-weight: 500; color: var(--rws-text); }
    .td-ot { color: #d9973b; font-weight: 600; }
    .td-reason { color: var(--rws-text); max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .td-status { text-align: center; }
    .td-actions { text-align: center; display: flex; gap: 0.375rem; justify-content: center; }

    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.25rem 0.625rem;
      border-radius: 999px;
      font-size: 0.75rem;
      font-weight: 600;

      &.status-detected { background: #fef3e2; color: #92610a; }
      &.status-submitted { background: #e8f1fb; color: #2b3a67; }
      &.status-approved { background: #e8f8f6; color: #167d72; }
      &.status-rejected { background: #fde8e8; color: #b91c1c; }
      &.status-cancelled { background: #f3f4f6; color: #6b7280; }
    }

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
    .btn-primary { background: var(--rws-accent); color: var(--rws-primary); }
    .btn-secondary { background: var(--rws-bg); color: var(--rws-text); border: 1px solid var(--rws-border); }
    .btn-ghost { background: transparent; color: var(--rws-text-muted); border: 1px solid var(--rws-border); }

    .dialog-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.4);
      z-index: 90;
      animation: fade-in 150ms ease;
    }

    .dialog {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 480px;
      max-width: calc(100vw - 2rem);
      max-height: calc(100vh - 4rem);
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
      z-index: 91;
      display: flex;
      flex-direction: column;
      animation: dialog-in 200ms ease;
    }

    .dialog-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1.25rem 1.5rem;
      border-bottom: 1px solid var(--rws-border);
    }

    .dialog-title { margin: 0; font-size: 1.0625rem; font-weight: 600; color: var(--rws-text); }

    .dialog-close {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border: none;
      border-radius: var(--rws-radius);
      background: transparent;
      color: var(--rws-text-muted);
      cursor: pointer;
      &:hover { background: var(--rws-bg); color: var(--rws-text); }
    }

    .dialog-body { padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; overflow-y: auto; }
    .dialog-footer { display: flex; justify-content: flex-end; gap: 0.75rem; padding: 1rem 1.5rem; border-top: 1px solid var(--rws-border); }

    .readonly-stats {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 0.75rem;
      padding: 1rem;
      background: var(--rws-bg);
      border-radius: var(--rws-radius);
    }

    .stat-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.25rem;
    }

    .stat-label {
      font-size: 0.6875rem;
      color: var(--rws-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .stat-value {
      font-size: 1.125rem;
      font-weight: 700;
      color: var(--rws-text);
      font-family: var(--rws-font-mono);

      &.ot { color: #d9973b; }
    }

    .form-group { display: flex; flex-direction: column; gap: 0.375rem; }
    .form-label { font-size: 0.8125rem; font-weight: 600; color: var(--rws-text); }

    .form-input {
      padding: 0.5rem 0.75rem;
      border: 1px solid var(--rws-border);
      border-radius: var(--rws-radius);
      font-size: 0.9rem;
      font-family: inherit;
      color: var(--rws-text);
      background: #fff;
      transition: border-color 150ms ease;
      &:focus { outline: none; border-color: var(--rws-accent); box-shadow: 0 0 0 2px rgba(31, 182, 166, 0.15); }
    }

    .form-textarea { resize: vertical; min-height: 80px; }
    .form-error { margin: 0; font-size: 0.8125rem; color: var(--rws-error); }

    @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
    @keyframes dialog-in { from { opacity: 0; transform: translate(-50%, -48%); } to { opacity: 1; transform: translate(-50%, -50%); } }

    @media (max-width: 639px) {
      .td-reason { max-width: 120px; }
    }

    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
    }
  `],
})
export class EmployeeOvertimeComponent implements OnInit {
  private readonly overtimeService = inject(OvertimeService);

  protected readonly declarations = signal<OvertimeDeclaration[]>([]);
  protected readonly loading = signal(true);

  protected readonly submitDialogOpen = signal(false);
  protected readonly selectedOt = signal<OvertimeDeclaration | null>(null);
  protected readonly submitReason = signal('');
  protected readonly submitNotes = signal('');
  protected readonly submitSubmitting = signal(false);
  protected readonly submitError = signal('');

  ngOnInit(): void {
    this.loadDeclarations();
  }

  private loadDeclarations(): void {
    this.loading.set(true);
    this.overtimeService.getMyDeclarations().subscribe({
      next: (res) => {
        this.declarations.set(res.declarations);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  openSubmitDialog(ot: OvertimeDeclaration): void {
    this.selectedOt.set(ot);
    this.submitReason.set('');
    this.submitNotes.set('');
    this.submitError.set('');
    this.submitDialogOpen.set(true);
  }

  closeSubmitDialog(): void {
    this.submitDialogOpen.set(false);
    this.selectedOt.set(null);
  }

  submitJustification(): void {
    const ot = this.selectedOt();
    if (!ot) return;

    const reason = this.submitReason();
    if (!reason) {
      this.submitError.set('Please select a reason');
      return;
    }

    this.submitSubmitting.set(true);
    this.overtimeService.submitJustification(ot.id, {
      reason,
      notes: this.submitNotes() || undefined,
    }).subscribe({
      next: () => {
        this.submitSubmitting.set(false);
        this.closeSubmitDialog();
        this.loadDeclarations();
      },
      error: (err) => {
        this.submitSubmitting.set(false);
        this.submitError.set(err.error?.error?.message || 'Failed to submit justification');
      },
    });
  }

  handleCancel(id: number): void {
    if (!confirm('Cancel this overtime declaration?')) return;
    this.overtimeService.cancel(id).subscribe({
      next: () => this.loadDeclarations(),
    });
  }
}
