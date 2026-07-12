import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { LucidePlus, LucideX, LucideClock, LucideCheck, LucideXCircle } from '@lucide/angular';
import { OvertimeService } from '../services/overtime.service';
import { OvertimeDeclaration } from '../models/employee.models';

@Component({
  selector: 'app-employee-overtime',
  imports: [FormsModule, DatePipe, TitleCasePipe, LucidePlus, LucideX, LucideClock, LucideCheck, LucideXCircle],
  template: `
    <div class="page-container">
      <div class="page-header">
        <h1 class="page-title">Overtime</h1>
        <button class="btn btn-primary" type="button" (click)="openDeclareDialog()">
          <svg lucidePlus class="icon-sm" aria-hidden="true"></svg>
          Declare Overtime
        </button>
      </div>

      @if (loading()) {
        <div class="loading-state">
          @for (i of [1,2,3]; track i) {
            <div class="skeleton-row"></div>
          }
        </div>
      } @else if (declarations().length === 0) {
        <div class="empty-state">
          <svg lucideClock class="empty-icon" aria-hidden="true"></svg>
          <p class="empty-text">No overtime declared</p>
          <p class="empty-sub">Click "Declare Overtime" to submit your first entry.</p>
        </div>
      } @else {
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th class="th-hours">Hours</th>
                <th>Reason</th>
                <th class="th-status">Status</th>
              </tr>
            </thead>
            <tbody>
              @for (d of declarations(); track d.id) {
                <tr>
                  <td class="td-date">{{ d.date | date:'mediumDate' }}</td>
                  <td class="td-hours">{{ d.hours }}h</td>
                  <td class="td-reason">{{ d.reason }}</td>
                  <td class="td-status">
                    <span class="status-badge" [class]="'status-' + d.status">
                      @if (d.status === 'approved') {
                        <svg lucideCheck class="icon-xs" aria-hidden="true"></svg>
                      } @else if (d.status === 'rejected') {
                        <svg lucideXCircle class="icon-xs" aria-hidden="true"></svg>
                      } @else {
                        <svg lucideClock class="icon-xs" aria-hidden="true"></svg>
                      }
                      {{ d.status | titlecase }}
                    </span>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      @if (declareDialogOpen()) {
        <div class="dialog-overlay" (click)="closeDeclareDialog()"></div>
        <div class="dialog" role="dialog" aria-modal="true" aria-label="Declare Overtime">
          <div class="dialog-header">
            <h2 class="dialog-title">Declare Overtime</h2>
            <button class="dialog-close" type="button" (click)="closeDeclareDialog()" aria-label="Close">
              <svg lucideX class="icon-sm" aria-hidden="true"></svg>
            </button>
          </div>
          <div class="dialog-body">
            <div class="form-group">
              <label class="form-label" for="ot-date">Date</label>
              <input class="form-input" id="ot-date" type="date" [(ngModel)]="declareDate" [max]="todayStr">
            </div>
            <div class="form-group">
              <label class="form-label" for="ot-hours">Hours</label>
              <input class="form-input" id="ot-hours" type="number" [(ngModel)]="declareHours" min="0.25" max="24" step="0.25">
            </div>
            <div class="form-group">
              <label class="form-label" for="ot-reason">Reason</label>
              <textarea class="form-input form-textarea" id="ot-reason" [(ngModel)]="declareReason" rows="3" placeholder="Why did you work overtime?"></textarea>
            </div>
            @if (declareError()) {
              <p class="form-error">{{ declareError() }}</p>
            }
          </div>
          <div class="dialog-footer">
            <button class="btn btn-secondary" type="button" (click)="closeDeclareDialog()">Cancel</button>
            <button class="btn btn-primary" type="button" (click)="submitDeclaration()" [disabled]="declareSubmitting()">
              {{ declareSubmitting() ? 'Submitting...' : 'Submit' }}
            </button>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    @use 'styles/design-tokens' as t;

    .page-container { max-width: 800px; }

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
    .icon-xs { width: 12px; height: 12px; }

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

    .loading-state { display: flex; flex-direction: column; gap: 0.75rem; }
    .skeleton-row {
      height: 52px;
      border-radius: 8px;
      background: linear-gradient(90deg, var(--rws-bg) 25%, #eef0f2 50%, var(--rws-bg) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
    }
    @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

    .table-wrapper {
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
      overflow: hidden;
    }

    .data-table { width: 100%; border-collapse: collapse; }

    th, td { text-align: left; padding: 0.875rem 1.25rem; }

    thead tr { border-bottom: 1px solid var(--rws-border); background: var(--rws-bg); }

    th {
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--rws-text-muted);
    }

    .th-hours, .th-status { text-align: right; width: 100px; }

    tbody tr {
      border-bottom: 1px solid var(--rws-border);
      &:last-child { border-bottom: none; }
      &:hover { background: #fafbfc; }
    }

    .td-date { font-weight: 500; color: var(--rws-text); }
    .td-hours { text-align: right; font-family: var(--rws-font-mono); font-weight: 500; color: var(--rws-text); }
    .td-reason { color: var(--rws-text); max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .td-status { text-align: right; }

    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.25rem 0.625rem;
      border-radius: 999px;
      font-size: 0.75rem;
      font-weight: 600;

      &.status-pending { background: #fef3e2; color: #92610a; }
      &.status-approved { background: #e8f8f6; color: #167d72; }
      &.status-rejected { background: #fde8e8; color: #b91c1c; }
    }

    // ── Dialog ─────────────────────────────────────────────────
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
      width: 440px;
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

    // ── Form ───────────────────────────────────────────────────
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

    // ── Buttons ────────────────────────────────────────────────
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      border: none;
      border-radius: var(--rws-radius);
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
      transition: opacity 150ms ease;
      &:hover:not(:disabled) { opacity: 0.9; }
      &:disabled { opacity: 0.5; cursor: not-allowed; }
      &:focus-visible { outline: 3px solid var(--rws-focus-ring); outline-offset: 2px; }
    }

    .btn-primary { background: var(--rws-accent); color: var(--rws-primary); }
    .btn-secondary { background: var(--rws-bg); color: var(--rws-text); border: 1px solid var(--rws-border); }

    @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
    @keyframes dialog-in { from { opacity: 0; transform: translate(-50%, -48%); } to { opacity: 1; transform: translate(-50%, -50%); } }

    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
    }
  `],
})
export class EmployeeOvertimeComponent implements OnInit {
  private readonly overtimeService = inject(OvertimeService);

  protected readonly declarations = signal<OvertimeDeclaration[]>([]);
  protected readonly loading = signal(true);

  protected readonly declareDialogOpen = signal(false);
  protected declareDate = '';
  protected declareHours = 1;
  protected declareReason = '';
  protected readonly declareSubmitting = signal(false);
  protected readonly declareError = signal('');
  protected readonly todayStr = this._todayStr();

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

  openDeclareDialog(): void {
    this.declareDate = this._todayStr();
    this.declareHours = 1;
    this.declareReason = '';
    this.declareError.set('');
    this.declareDialogOpen.set(true);
  }

  closeDeclareDialog(): void {
    this.declareDialogOpen.set(false);
  }

  submitDeclaration(): void {
    this.declareError.set('');
    const hours = Number(this.declareHours);
    const reason = this.declareReason;

    if (!hours || hours < 0.25 || hours > 24) {
      this.declareError.set('Hours must be between 0.25 and 24');
      return;
    }

    if (!reason?.trim()) {
      this.declareError.set('Please provide a reason');
      return;
    }

    this.declareSubmitting.set(true);
    this.overtimeService.declare({
      date: this.declareDate,
      hours,
      reason: reason.trim(),
    }).subscribe({
      next: () => {
        this.declareSubmitting.set(false);
        this.closeDeclareDialog();
        this.loadDeclarations();
      },
      error: (err) => {
        this.declareSubmitting.set(false);
        this.declareError.set(err.error?.error?.message || 'Failed to submit declaration');
      },
    });
  }

  private _todayStr(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
