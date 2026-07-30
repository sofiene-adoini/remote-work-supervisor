import { Component, inject, OnInit, signal, computed, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  LucideClock, LucideCheck, LucideSearch, LucideX, LucideHistory,
  LucideHourglass, LucideUserCheck, LucideUserX, LucideSend, LucideAlertTriangle,
} from '@lucide/angular';
import { OvertimeService } from '../services/overtime.service';
import { OvertimeDeclaration } from '../models/employee.models';
import { RealtimeService, OvertimeStatusEvent } from '../../../core/services/realtime.service';

type SortField = 'date' | 'createdAt' | 'overtimeMinutes';
type SortDir = 'asc' | 'desc';

@Component({
  selector: 'app-employee-overtime',
  imports: [
    DatePipe, DecimalPipe, FormsModule,
    LucideClock, LucideCheck, LucideSearch, LucideX, LucideHistory,
    LucideHourglass, LucideUserCheck, LucideUserX, LucideSend, LucideAlertTriangle,
  ],
  template: `
    <div class="page-container">
      <div class="page-header">
        <h1 class="page-title">Overtime</h1>
      </div>

      <!-- ============================================ -->
      <!-- SECTION 1: PENDING REQUESTS                  -->
      <!-- ============================================ -->
      <section class="section">
        <div class="section-header">
          <h2 class="section-title">
            <svg lucideHourglass class="section-icon" aria-hidden="true"></svg>
            Pending Requests
          </h2>
          @if (pendingCount() > 0) {
            <span class="count-badge pending">{{ pendingCount() }}</span>
          }
        </div>

        @if (pendingLoading()) {
          <div class="skeleton-row-group">
            @for (i of [1,2]; track i) {
              <div class="sk-card"></div>
            }
          </div>
        } @else if (pendingDeclarations().length === 0) {
          <div class="empty-state">
            <svg lucideCheck class="empty-icon success" aria-hidden="true"></svg>
            <p class="empty-title">No pending overtime requests</p>
            <p class="empty-sub">All overtime declarations have been reviewed. New requests will appear here.</p>
          </div>
        } @else {
          <div class="card-grid">
            @for (d of pendingDeclarations(); track d.id) {
              <div class="req-card pending-card">
                <div class="req-card-header">
                  <span class="req-date">{{ d.date | date:'mediumDate' }}</span>
                  @if (d.status === 'detected') {
                    <span class="status-badge status-detected">
                      <svg lucideAlertTriangle class="icon-xs" aria-hidden="true"></svg>
                      Detected
                    </span>
                  } @else {
                    <span class="status-badge status-submitted">
                      <svg lucideClock class="icon-xs" aria-hidden="true"></svg>
                      Pending Review
                    </span>
                  }
                </div>
                <div class="req-card-body">
                  <div class="req-metric">
                    <span class="req-metric-value">{{ (d.overtimeMinutes / 60) | number:'1.1-1' }}h</span>
                    <span class="req-metric-label">Overtime</span>
                  </div>
                  <div class="req-detail">
                    <div class="req-detail-row">
                      <span class="req-detail-label">Worked</span>
                      <span class="req-detail-value">{{ (d.workedMinutes / 60) | number:'1.1-1' }}h</span>
                    </div>
                    <div class="req-detail-row">
                      <span class="req-detail-label">Expected</span>
                      <span class="req-detail-value">{{ (d.expectedMinutes / 60) | number:'1.1-1' }}h</span>
                    </div>
                    @if (d.session) {
                      <div class="req-detail-row">
                        <span class="req-detail-label">Session</span>
                        <span class="req-detail-value">{{ d.session.clockIn | date:'shortTime' }} – {{ d.session.clockOut ? (d.session.clockOut | date:'shortTime') : 'now' }}</span>
                      </div>
                    }
                  </div>
                  @if (d.status === 'submitted' && d.reason) {
                    <div class="req-reason">
                      <span class="req-reason-label">Reason</span>
                      <span class="req-reason-text">{{ reasonLabel(d.reason) }}</span>
                    </div>
                  }
                  @if (d.notes) {
                    <p class="req-notes">{{ d.notes }}</p>
                  }
                  <div class="req-footer">
                    @if (d.status === 'detected') {
                      <span class="req-submitted">Waiting for justification</span>
                      <div class="req-actions">
                        <button class="btn btn-primary btn-xs" type="button" (click)="openSubmitDialog(d)">
                          <svg lucideSend class="icon-xs" aria-hidden="true"></svg>
                          Submit
                        </button>
                        <button class="btn btn-ghost btn-xs" type="button" (click)="handleCancel(d.id)">
                          Cancel
                        </button>
                      </div>
                    } @else {
                      <span class="req-submitted">Submitted {{ d.justificationSubmittedAt | date:'short' }}</span>
                      <div class="req-actions">
                        <button class="btn btn-ghost btn-xs" type="button" (click)="handleCancel(d.id)">
                          Cancel
                        </button>
                      </div>
                    }
                  </div>
                </div>
              </div>
            }
          </div>
        }
      </section>

      <!-- ============================================ -->
      <!-- SECTION 2: RECENT DECISIONS                  -->
      <!-- ============================================ -->
      <section class="section">
        <div class="section-header">
          <h2 class="section-title">
            <svg lucideHistory class="section-icon" aria-hidden="true"></svg>
            Recent Decisions
          </h2>
          @if (recentCount() > 0) {
            <span class="count-badge muted">{{ recentCount() }}</span>
          }
        </div>

        @if (recentLoading()) {
          <div class="skeleton-row-group">
            @for (i of [1,2]; track i) {
              <div class="sk-card"></div>
            }
          </div>
        } @else if (recentDeclarations().length === 0) {
          <div class="empty-state">
            <svg lucideClock class="empty-icon" aria-hidden="true"></svg>
            <p class="empty-title">No recent decisions</p>
            <p class="empty-sub">Approved or rejected declarations will appear here.</p>
          </div>
        } @else {
          <div class="card-grid">
            @for (d of recentDeclarations(); track d.id) {
              <div class="req-card" [class.approved-card]="d.status === 'approved'" [class.rejected-card]="d.status === 'rejected'">
                <div class="req-card-header">
                  <span class="req-date">{{ d.date | date:'mediumDate' }}</span>
                  <span class="status-badge" [class]="'status-' + d.status">
                    @if (d.status === 'approved') {
                      <svg lucideUserCheck class="icon-xs" aria-hidden="true"></svg>
                      Approved
                    } @else {
                      <svg lucideUserX class="icon-xs" aria-hidden="true"></svg>
                      Rejected
                    }
                  </span>
                </div>
                <div class="req-card-body">
                  <div class="req-metric">
                    <span class="req-metric-value">{{ (d.overtimeMinutes / 60) | number:'1.1-1' }}h</span>
                    <span class="req-metric-label">Requested</span>
                  </div>
                  <div class="req-detail">
                    <div class="req-detail-row">
                      <span class="req-detail-label">Reviewed</span>
                      <span class="req-detail-value">{{ d.reviewedAt | date:'short' }}</span>
                    </div>
                    @if (d.reviewer) {
                      <div class="req-detail-row">
                        <span class="req-detail-label">Reviewer</span>
                        <span class="req-detail-value">{{ d.reviewer.fullName }}</span>
                      </div>
                    }
                    @if (d.reason) {
                      <div class="req-detail-row">
                        <span class="req-detail-label">Reason</span>
                        <span class="req-detail-value">{{ reasonLabel(d.reason) }}</span>
                      </div>
                    }
                  </div>
                  @if (d.notes) {
                    <p class="req-notes">{{ d.notes }}</p>
                  }
                </div>
              </div>
            }
          </div>
        }
      </section>

      <!-- ============================================ -->
      <!-- SECTION 3: VIEW FULL HISTORY                 -->
      <!-- ============================================ -->
      <div class="history-section">
        <button class="btn btn-secondary btn-history" type="button" (click)="openHistoryDrawer()">
          <svg lucideHistory class="icon-sm" aria-hidden="true"></svg>
          View Full History
        </button>
      </div>

      <!-- ============================================ -->
      <!-- HISTORY DRAWER                               -->
      <!-- ============================================ -->
      @if (historyDrawerOpen()) {
        <div class="drawer-overlay" (click)="closeHistoryDrawer()"></div>
        <div class="drawer" role="dialog" aria-modal="true" aria-label="Overtime History">
          <div class="drawer-header">
            <h2 class="drawer-title">
              <svg lucideHistory class="icon-sm" aria-hidden="true"></svg>
              Overtime History
            </h2>
            <button class="drawer-close" type="button" (click)="closeHistoryDrawer()" aria-label="Close">
              <svg lucideX class="icon-sm"></svg>
            </button>
          </div>

          <div class="drawer-body">
            <!-- Search -->
            <div class="search-bar">
              <svg lucideSearch class="search-icon" aria-hidden="true"></svg>
              <input
                class="search-input"
                type="text"
                placeholder="Search by reason or notes..."
                [(ngModel)]="historySearch"
                (ngModelChange)="onHistorySearch()"
              />
              @if (historySearch()) {
                <button class="search-clear" type="button" (click)="historySearch.set(''); onHistorySearch()">
                  <svg lucideX class="icon-xs"></svg>
                </button>
              }
            </div>

            <!-- Filters -->
            <div class="history-filters">
              <div class="filter-row">
                <div class="filter-group">
                  <label class="filter-label">Status</label>
                  <select class="form-input form-select" [(ngModel)]="historyStatus" (ngModelChange)="onHistoryFilter()">
                    <option value="">All</option>
                    <option value="detected">Detected</option>
                    <option value="submitted">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <div class="filter-group">
                  <label class="filter-label">Sort</label>
                  <select class="form-input form-select" [(ngModel)]="historySortBy" (ngModelChange)="onHistoryFilter()">
                    <option value="createdAt">Newest</option>
                    <option value="date">Date</option>
                    <option value="overtimeMinutes">Duration</option>
                  </select>
                </div>
                <div class="filter-group">
                  <label class="filter-label">Order</label>
                  <select class="form-input form-select" [(ngModel)]="historySortOrder" (ngModelChange)="onHistoryFilter()">
                    <option value="desc">Desc</option>
                    <option value="asc">Asc</option>
                  </select>
                </div>
              </div>
              <div class="filter-row">
                <div class="filter-group">
                  <label class="filter-label">From</label>
                  <input class="form-input" type="date" [(ngModel)]="historyDateFrom" (ngModelChange)="onHistoryFilter()" />
                </div>
                <div class="filter-group">
                  <label class="filter-label">To</label>
                  <input class="form-input" type="date" [(ngModel)]="historyDateTo" (ngModelChange)="onHistoryFilter()" />
                </div>
                <div class="filter-group">
                  <label class="filter-label">Min Hours</label>
                  <input class="form-input" type="number" min="0" step="0.5" [(ngModel)]="historyMinHours" (ngModelChange)="onHistoryFilter()" />
                </div>
                <div class="filter-group">
                  <label class="filter-label">Max Hours</label>
                  <input class="form-input" type="number" min="0" step="0.5" [(ngModel)]="historyMaxHours" (ngModelChange)="onHistoryFilter()" />
                </div>
              </div>
            </div>

            @if (historyLoading()) {
              <div class="sk-list-padded">
                @for (i of [1,2,3,4]; track i) {
                  <div class="sk sk-row"></div>
                }
              </div>
            } @else if (historyDeclarations().length === 0) {
              <div class="empty-state">
                <svg lucideSearch class="empty-icon" aria-hidden="true"></svg>
                <p class="empty-title">{{ historySearch() || historyStatus() || historyDateFrom() || historyDateTo() ? 'No matching overtime declarations' : 'No overtime history found' }}</p>
                <p class="empty-sub">{{ historySearch() || historyStatus() || historyDateFrom() || historyDateTo() ? 'Try adjusting your filters.' : 'Overtime declarations will appear here once reviewed.' }}</p>
              </div>
            } @else {
              <div class="history-list">
                @for (d of historyDeclarations(); track d.id) {
                  <div class="history-item">
                    <div class="history-item-left">
                      <span class="history-item-date">{{ d.date | date:'mediumDate' }}</span>
                      <span class="history-item-hours">{{ (d.overtimeMinutes / 60) | number:'1.1-1' }}h</span>
                      <span class="status-badge status-{{ d.status }}">{{ statusLabel(d.status) }}</span>
                    </div>
                    <div class="history-item-right">
                      @if (d.reason) {
                        <span class="history-item-reason">{{ reasonLabel(d.reason) }}</span>
                      }
                      <span class="history-item-meta">{{ d.createdAt | date:'short' }}</span>
                    </div>
                  </div>
                }
              </div>
            }

            @if (historyTotalPages() > 1) {
              <div class="pagination">
                <button class="btn btn-ghost btn-sm" [disabled]="historyPage() <= 1" (click)="goToHistoryPage(historyPage() - 1)">Previous</button>
                <span class="page-info">Page {{ historyPage() }} of {{ historyTotalPages() }}</span>
                <button class="btn btn-ghost btn-sm" [disabled]="historyPage() >= historyTotalPages()" (click)="goToHistoryPage(historyPage() + 1)">Next</button>
              </div>
            }
          </div>
        </div>
      }

      <!-- ============================================ -->
      <!-- SUBMIT DIALOG (preserved)                    -->
      <!-- ============================================ -->
      @if (submitDialogOpen()) {
        <div class="dialog-overlay" (click)="closeSubmitDialog()"></div>
        <div class="dialog" role="dialog" aria-modal="true" aria-label="Submit Overtime Justification">
          <div class="dialog-header">
            <h2 class="dialog-title">Overtime Justification</h2>
            <button class="dialog-close" type="button" (click)="closeSubmitDialog()" aria-label="Close">
              <svg lucideX class="icon-sm"></svg>
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

    /* ============================================ */
    /* SECTIONS                                     */
    /* ============================================ */
    .section { margin-bottom: 2rem; }

    .section-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 1rem;
    }

    .section-title {
      margin: 0;
      font-size: 1.125rem;
      font-weight: 600;
      color: var(--rws-text);
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .section-icon { width: 20px; height: 20px; color: var(--rws-accent); }

    .count-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 22px;
      height: 22px;
      padding: 0 0.5rem;
      border-radius: 999px;
      font-size: 0.75rem;
      font-weight: 600;
      &.pending { background: #e8f1fb; color: #2b3a67; }
      &.muted { background: var(--rws-bg); color: var(--rws-text-muted); }
    }

    /* ============================================ */
    /* CARD GRID                                    */
    /* ============================================ */
    .card-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
      gap: 1rem;
    }

    .req-card {
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
      overflow: hidden;
      transition: box-shadow 150ms ease;
      &:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
    }

    .pending-card { border-left: 3px solid #2b3a67; }
    .approved-card { border-left: 3px solid #167d72; }
    .rejected-card { border-left: 3px solid #d64545; }

    .req-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.875rem 1rem;
      border-bottom: 1px solid var(--rws-border);
      background: var(--rws-bg);
    }

    .req-date {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--rws-text);
    }

    .req-card-body { padding: 1rem; display: flex; flex-direction: column; gap: 0.75rem; }

    .req-metric {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 0.625rem;
      background: var(--rws-bg);
      border-radius: 8px;
    }

    .req-metric-value {
      font-size: 1.5rem;
      font-weight: 700;
      color: #d9973b;
      font-family: var(--rws-font-mono);
    }

    .req-metric-label {
      font-size: 0.6875rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--rws-text-muted);
    }

    .req-detail { display: flex; flex-direction: column; gap: 0.375rem; }

    .req-detail-row {
      display: flex;
      justify-content: space-between;
      font-size: 0.8125rem;
    }

    .req-detail-label { color: var(--rws-text-muted); }
    .req-detail-value { font-weight: 500; color: var(--rws-text); }

    .req-reason {
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
    }

    .req-reason-label {
      font-size: 0.6875rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--rws-text-muted);
    }

    .req-reason-text { font-size: 0.875rem; font-weight: 500; color: var(--rws-text); }

    .req-notes {
      margin: 0;
      font-size: 0.8125rem;
      color: var(--rws-text-muted);
      font-style: italic;
      line-height: 1.4;
    }

    .req-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-top: 0.625rem;
      border-top: 1px solid var(--rws-border);
    }

    .req-submitted {
      font-size: 0.75rem;
      color: var(--rws-text-muted);
    }

    .req-actions { display: flex; gap: 0.375rem; }

    /* ============================================ */
    /* HISTORY SECTION                              */
    /* ============================================ */
    .history-section {
      display: flex;
      justify-content: center;
      padding: 0.5rem 0 2rem;
    }

    .btn-history {
      padding: 0.625rem 1.5rem;
      font-size: 0.875rem;
    }

    /* ============================================ */
    /* DRAWER                                       */
    /* ============================================ */
    .drawer-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.4);
      z-index: 90;
      animation: fade-in 150ms ease;
    }

    .drawer {
      position: fixed;
      top: 0;
      right: 0;
      width: 560px;
      max-width: calc(100vw - 2rem);
      height: 100vh;
      background: #fff;
      box-shadow: -4px 0 24px rgba(0,0,0,0.12);
      z-index: 91;
      display: flex;
      flex-direction: column;
      animation: slide-in 200ms ease;
    }

    .drawer-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1.25rem 1.5rem;
      border-bottom: 1px solid var(--rws-border);
      flex-shrink: 0;
    }

    .drawer-title {
      margin: 0;
      font-size: 1.125rem;
      font-weight: 600;
      color: var(--rws-text);
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .drawer-close {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border: none;
      border-radius: var(--rws-radius);
      background: transparent;
      color: var(--rws-text-muted);
      cursor: pointer;
      &:hover { background: var(--rws-bg); color: var(--rws-text); }
    }

    .drawer-body {
      flex: 1;
      overflow-y: auto;
      padding: 1.25rem 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    /* ============================================ */
    /* SEARCH BAR                                   */
    /* ============================================ */
    .search-bar {
      position: relative;
      display: flex;
      align-items: center;
    }

    .search-icon {
      position: absolute;
      left: 0.75rem;
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

    /* ============================================ */
    /* HISTORY FILTERS                              */
    /* ============================================ */
    .history-filters {
      display: flex;
      flex-direction: column;
      gap: 0.625rem;
    }

    .filter-row {
      display: flex;
      gap: 0.625rem;
      flex-wrap: wrap;
    }

    .filter-group {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      flex: 1;
      min-width: 120px;
    }

    .filter-label {
      font-size: 0.6875rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--rws-text-muted);
    }

    .form-input {
      padding: 0.5rem 0.625rem;
      border: 1px solid var(--rws-border);
      border-radius: var(--rws-radius);
      font-size: 0.8125rem;
      font-family: inherit;
      color: var(--rws-text);
      background: #fff;
      transition: border-color 150ms ease;
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
    /* HISTORY LIST                                 */
    /* ============================================ */
    .history-list {
      display: flex;
      flex-direction: column;
      border: 1px solid var(--rws-border);
      border-radius: 10px;
      overflow: hidden;
    }

    .history-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.75rem 1rem;
      border-bottom: 1px solid var(--rws-border);
      background: #fff;
      transition: background 150ms ease;
      &:last-child { border-bottom: none; }
      &:hover { background: #fafbfc; }
    }

    .history-item-left {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .history-item-date {
      font-size: 0.8125rem;
      font-weight: 500;
      color: var(--rws-text);
      min-width: 100px;
    }

    .history-item-hours {
      font-size: 0.8125rem;
      font-weight: 600;
      color: #d9973b;
      font-family: var(--rws-font-mono);
      min-width: 50px;
    }

    .history-item-right {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .history-item-reason {
      font-size: 0.75rem;
      color: var(--rws-text-muted);
    }

    .history-item-meta {
      font-size: 0.6875rem;
      color: var(--rws-text-muted);
      white-space: nowrap;
    }

    /* ============================================ */
    /* PAGINATION                                   */
    /* ============================================ */
    .pagination {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 1rem;
      padding: 0.75rem 0;
    }

    .page-info { font-size: 0.8125rem; color: var(--rws-text-muted); }

    /* ============================================ */
    /* EMPTY STATES                                 */
    /* ============================================ */
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 2.5rem 1rem;
      text-align: center;
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    }

    .empty-icon {
      width: 40px; height: 40px; color: var(--rws-text-muted); opacity: 0.4; margin-bottom: 0.75rem;
      &.success { color: #167d72; opacity: 0.6; }
    }

    .empty-title {
      margin: 0 0 0.25rem;
      font-size: 0.9375rem;
      font-weight: 600;
      color: var(--rws-text);
    }

    .empty-sub {
      margin: 0;
      font-size: 0.8125rem;
      color: var(--rws-text-muted);
      max-width: 320px;
    }

    /* ============================================ */
    /* STATUS BADGES                                */
    /* ============================================ */
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.25rem 0.625rem;
      border-radius: 999px;
      font-size: 0.75rem;
      font-weight: 600;
      white-space: nowrap;

      &.status-detected { background: #fef3e2; color: #92610a; }
      &.status-submitted { background: #e8f1fb; color: #2b3a67; }
      &.status-approved { background: #e8f8f6; color: #167d72; }
      &.status-rejected { background: #fde8e8; color: #b91c1c; }
      &.status-cancelled { background: #f3f4f6; color: #6b7280; }
    }

    /* ============================================ */
    /* BUTTONS                                      */
    /* ============================================ */
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.375rem;
      padding: 0.5rem 0.875rem;
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

    .btn-sm { font-size: 0.75rem; padding: 0.375rem 0.75rem; }
    .btn-xs { font-size: 0.6875rem; padding: 0.25rem 0.5rem; }
    .btn-primary { background: var(--rws-accent); color: var(--rws-primary); }
    .btn-secondary { background: var(--rws-bg); color: var(--rws-text); border: 1px solid var(--rws-border); }
    .btn-ghost { background: transparent; color: var(--rws-text-muted); border: 1px solid var(--rws-border); }

    .icon-sm { width: 16px; height: 16px; }
    .icon-xs { width: 14px; height: 14px; }

    /* ============================================ */
    /* SKELETON                                     */
    /* ============================================ */
    .skeleton-row-group { display: flex; flex-direction: column; gap: 0.75rem; }

    .sk-card {
      height: 180px;
      background: linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
      border-radius: 12px;
    }

    .sk-list-padded { display: flex; flex-direction: column; gap: 0.5rem; padding: 1rem; }

    .sk-row {
      height: 48px;
      background: linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
      border-radius: 8px;
    }

    /* ============================================ */
    /* DIALOG (preserved from original)             */
    /* ============================================ */
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
    @keyframes slide-in { from { transform: translateX(100%); } to { transform: translateX(0); } }
    @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }

    @media (max-width: 639px) {
      .card-grid { grid-template-columns: 1fr; }
      .drawer { width: 100vw; max-width: 100vw; }
      .filter-row { flex-direction: column; }
      .filter-group { min-width: 0; }
    }

    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
    }
  `],
})
export class EmployeeOvertimeComponent implements OnInit {
  private readonly overtimeService = inject(OvertimeService);
  private readonly realtime = inject(RealtimeService);
  private readonly destroyRef = inject(DestroyRef);

  /* ---- Pending ---- */
  protected readonly pendingDeclarations = signal<OvertimeDeclaration[]>([]);
  protected readonly pendingLoading = signal(true);

  /* ---- Recent ---- */
  protected readonly recentDeclarations = signal<OvertimeDeclaration[]>([]);
  protected readonly recentLoading = signal(true);

  /* ---- History Drawer ---- */
  protected readonly historyDrawerOpen = signal(false);
  protected readonly historyDeclarations = signal<OvertimeDeclaration[]>([]);
  protected readonly historyLoading = signal(false);
  protected readonly historyTotal = signal(0);
  protected readonly historyPage = signal(1);
  protected readonly historyTotalPages = signal(1);

  protected readonly historySearch = signal('');
  protected readonly historyStatus = signal('');
  protected readonly historySortBy = signal<SortField>('createdAt');
  protected readonly historySortOrder = signal<SortDir>('desc');
  protected readonly historyDateFrom = signal('');
  protected readonly historyDateTo = signal('');
  protected readonly historyMinHours = signal<number | null>(null);
  protected readonly historyMaxHours = signal<number | null>(null);

  private historySearchTimeout: ReturnType<typeof setTimeout> | null = null;

  /* ---- Submit Dialog ---- */
  protected readonly submitDialogOpen = signal(false);
  protected readonly selectedOt = signal<OvertimeDeclaration | null>(null);
  protected readonly submitReason = signal('');
  protected readonly submitNotes = signal('');
  protected readonly submitSubmitting = signal(false);
  protected readonly submitError = signal('');

  protected readonly pendingCount = computed(() => this.pendingDeclarations().length);
  protected readonly recentCount = computed(() => this.recentDeclarations().length);

  readonly historyPageSize = 20;

  ngOnInit(): void {
    this.loadPending();
    this.loadRecent();
    this.subscribeToRealtime();
  }

  /* ---- Load Data ---- */
  private loadPending(): void {
    this.pendingLoading.set(true);
    this.overtimeService.getMyDeclarations().subscribe({
      next: (res) => {
        const pending = res.declarations.filter(
          (d) => d.status === 'detected' || d.status === 'submitted',
        );
        this.pendingDeclarations.set(pending);
        this.pendingLoading.set(false);
      },
      error: () => this.pendingLoading.set(false),
    });
  }

  private loadRecent(): void {
    this.recentLoading.set(true);
    this.overtimeService.getRecentDecisions().subscribe({
      next: (res) => {
        this.recentDeclarations.set(res.declarations);
        this.recentLoading.set(false);
      },
      error: () => this.recentLoading.set(false),
    });
  }

  /* ---- Real-time ---- */
  private subscribeToRealtime(): void {
    this.realtime.overtimeChanged$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event: OvertimeStatusEvent) => {
        if (event.status === 'approved' || event.status === 'rejected') {
          this.loadPending();
          this.loadRecent();
        }
        if (event.status === 'submitted') {
          this.loadPending();
        }
      });

    this.realtime.overtimeDetected$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.loadPending();
      });
  }

  /* ---- History Drawer ---- */
  openHistoryDrawer(): void {
    this.historyDrawerOpen.set(true);
    this.historyPage.set(1);
    this.loadHistory();
  }

  closeHistoryDrawer(): void {
    this.historyDrawerOpen.set(false);
  }

  onHistorySearch(): void {
    if (this.historySearchTimeout) clearTimeout(this.historySearchTimeout);
    this.historySearchTimeout = setTimeout(() => {
      this.historyPage.set(1);
      this.loadHistory();
    }, 300);
  }

  onHistoryFilter(): void {
    this.historyPage.set(1);
    this.loadHistory();
  }

  goToHistoryPage(page: number): void {
    this.historyPage.set(page);
    this.loadHistory();
  }

  private loadHistory(): void {
    this.historyLoading.set(true);
    this.overtimeService.getHistory({
      status: this.historyStatus() || undefined,
      search: this.historySearch() || undefined,
      dateFrom: this.historyDateFrom() || undefined,
      dateTo: this.historyDateTo() || undefined,
      minDuration: this.historyMinHours() !== null ? this.historyMinHours()! * 60 : undefined,
      maxDuration: this.historyMaxHours() !== null ? this.historyMaxHours()! * 60 : undefined,
      sortBy: this.historySortBy(),
      sortOrder: this.historySortOrder(),
      page: this.historyPage(),
      pageSize: this.historyPageSize,
    }).subscribe({
      next: (res) => {
        this.historyDeclarations.set(res.declarations);
        this.historyTotal.set(res.total ?? 0);
        this.historyTotalPages.set(res.totalPages ?? 1);
        this.historyLoading.set(false);
      },
      error: () => this.historyLoading.set(false),
    });
  }

  /* ---- Submit Dialog ---- */
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
        this.loadPending();
      },
      error: (err) => {
        this.submitSubmitting.set(false);
        this.submitError.set(err.error?.error?.message || 'Failed to submit justification');
      },
    });
  }

  /* ---- Actions ---- */
  handleCancel(id: number): void {
    if (!confirm('Cancel this overtime request?')) return;
    this.overtimeService.cancel(id).subscribe({
      next: () => {
        this.loadPending();
        this.loadRecent();
      },
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
      submitted: 'Pending',
      approved: 'Approved',
      rejected: 'Rejected',
      cancelled: 'Cancelled',
    };
    return labels[status] || status;
  }
}
