import { Component, computed, effect, input, signal } from '@angular/core';
import { LucideChevronLeft, LucideChevronRight, LucideDownload, LucideSearch, LucideChevronDown, LucideChevronUp } from '@lucide/angular';
import { SessionWithWorked, CompanyWorkPolicy } from '../../models/employee.models';

@Component({
  selector: 'app-time-history',
  imports: [LucideChevronLeft, LucideChevronRight, LucideDownload, LucideSearch, LucideChevronDown, LucideChevronUp],
  template: `
    <div class="history-card">
      <!-- Header -->
      <div class="card-header">
        <div class="header-left">
          <h3 class="card-title">Work History</h3>
          <span class="row-count" [class.hidden]="loading()">{{ sortedSessions().length }} entries</span>
        </div>
        <div class="header-right">
          <div class="search-wrap">
            <svg lucideSearch class="search-icon" aria-hidden="true"></svg>
            <input
              type="text"
              class="search-input"
              placeholder="Search by date, status..."
              [value]="searchQuery()"
              (input)="onSearchInput($event)"
              aria-label="Search sessions" />
          </div>
          <button
            class="export-btn"
            type="button"
            [disabled]="loading() || sortedSessions().length === 0"
            (click)="onExport()"
            aria-label="Export history">
            <svg lucideDownload class="icon-sm" aria-hidden="true"></svg>
            Export
          </button>
        </div>
      </div>

      <!-- Table -->
      <div class="table-wrap">
        <table class="history-table">
          <thead>
            <tr>
              <th class="col-date">Date</th>
              <th class="col-time">Clock In</th>
              <th class="col-time">Clock Out</th>
              <th class="col-time">Worked</th>
              <th class="col-time">Expected</th>
              <th class="col-time">Break</th>
              <th class="col-time">Difference</th>
              <th class="col-status">Status</th>
            </tr>
          </thead>
          <tbody>
            @if (loading()) {
              @for (i of skeletonRows; track i) {
                <tr class="skeleton-row">
                  <td><span class="sk sk-text" style="width:90px"></span></td>
                  <td><span class="sk sk-text" style="width:72px"></span></td>
                  <td><span class="sk sk-text" style="width:72px"></span></td>
                  <td><span class="sk sk-text" style="width:56px"></span></td>
                  <td><span class="sk sk-text" style="width:56px"></span></td>
                  <td><span class="sk sk-text" style="width:36px"></span></td>
                  <td><span class="sk sk-text" style="width:52px"></span></td>
                  <td><span class="sk sk-badge"></span></td>
                </tr>
              }
            } @else if (paginatedSessions().length === 0) {
              <tr>
                <td colspan="8" class="empty-cell">
                  <div class="empty-state">
                    <span class="empty-text">No work sessions found for this period</span>
                  </div>
                </td>
              </tr>
            } @else {
              @for (session of paginatedSessions(); track session.id) {
                <tr
                  class="data-row"
                  [class.today-row]="isToday(session.clockIn)"
                  [class.alt]="$index % 2 === 1"
                  [class.expanded]="expandedSessionId() === session.id"
                  (click)="toggleExpand(session.id)">
                  <td class="col-date">
                    <div class="date-cell">
                      <button
                        class="expand-btn"
                        type="button"
                        [attr.aria-expanded]="expandedSessionId() === session.id"
                        (click)="$event.stopPropagation(); toggleExpand(session.id)"
                        aria-label="Toggle session details">
                        @if (expandedSessionId() === session.id) {
                          <svg lucideChevronUp class="icon-xs" aria-hidden="true"></svg>
                        } @else {
                          <svg lucideChevronDown class="icon-xs" aria-hidden="true"></svg>
                        }
                      </button>
                      <span class="date-text">{{ formatDate(session.clockIn) }}</span>
                      @if (sessionAlerts().has(session.id)) {
                        <span class="alert-dot" title="Session has alerts"></span>
                      }
                    </div>
                  </td>
                  <td class="col-time mono">{{ formatTime(session.clockIn) }}</td>
                  <td class="col-time mono">
                    @if (session.clockOut) {
                      {{ formatTime(session.clockOut) }}
                    } @else {
                      <span class="dash">—</span>
                    }
                  </td>
                  <td class="col-time mono worked">{{ formatMinutes(session.workedMinutes) }}</td>
                  <td class="col-time mono muted">{{ formatMinutes(expectedMinutes()) }}</td>
                  <td class="col-time mono">{{ formatBreak(session.totalBreakMinutes) }}</td>
                  <td class="col-time mono" [class]="diffClass(session)">
                    {{ diffPrefix(session) }}{{ formatMinutes(diffMinutes(session)) }}
                  </td>
                  <td class="col-status">
                    <span class="status-badge" [class]="'badge-' + session.status">
                      @if (session.status === 'active') {
                        <span class="pulse-dot"></span>
                      }
                      {{ statusLabel(session.status) }}
                    </span>
                  </td>
                </tr>
                @if (expandedSessionId() === session.id) {
                  <tr class="detail-row">
                    <td colspan="8">
                      <div class="session-detail">
                        <div class="detail-grid">
                          <div class="detail-item">
                            <span class="detail-label">Clock In</span>
                            <span class="detail-value mono">{{ formatTime(session.clockIn) }} · {{ formatDate(session.clockIn) }}</span>
                          </div>
                          <div class="detail-item">
                            <span class="detail-label">Clock Out</span>
                            <span class="detail-value mono">{{ session.clockOut ? formatTime(session.clockOut) + ' · ' + formatDate(session.clockOut) : '—' }}</span>
                          </div>
                          <div class="detail-item">
                            <span class="detail-label">Total Worked</span>
                            <span class="detail-value mono worked">{{ formatMinutes(session.workedMinutes) }}</span>
                          </div>
                          <div class="detail-item">
                            <span class="detail-label">Total Break</span>
                            <span class="detail-value mono">{{ formatBreak(session.totalBreakMinutes) }}</span>
                          </div>
                        </div>
                        @if (session.breaks && session.breaks.length > 0) {
                          <div class="breaks-section">
                            <h4 class="breaks-title">Break History</h4>
                            <div class="breaks-list">
                              @for (brk of session.breaks; track brk.id; let i = $index) {
                                <div class="break-item">
                                  <span class="break-index">#{{ i + 1 }}</span>
                                  <span class="break-time mono">{{ formatTime(brk.start) }} — {{ brk.end ? formatTime(brk.end) : 'ongoing' }}</span>
                                  <span class="break-duration mono">{{ formatBreak(brk.duration) }}</span>
                                  <span class="break-type" [class.auto]="brk.isAuto">{{ brk.isAuto ? 'Auto' : 'Manual' }}</span>
                                  @if (brk.reason) {
                                    <span class="break-reason">{{ brk.reason }}</span>
                                  }
                                </div>
                              }
                            </div>
                          </div>
                        } @else if (session.totalBreakMinutes > 0) {
                          <div class="breaks-section">
                            <h4 class="breaks-title">Break History</h4>
                            <p class="breaks-note">Total break: {{ formatBreak(session.totalBreakMinutes) }} (details not available)</p>
                          </div>
                        }
                      </div>
                    </td>
                  </tr>
                }
              }
            }
          </tbody>
        </table>
      </div>

      <!-- Mobile cards -->
      <div class="mobile-cards">
        @if (loading()) {
          @for (i of skeletonRows; track i) {
            <div class="mobile-card sk-card-row"></div>
          }
        } @else if (paginatedSessions().length === 0) {
          <div class="empty-state">
            <span class="empty-text">No work sessions found for this period</span>
          </div>
        } @else {
          @for (session of paginatedSessions(); track session.id) {
            <div
              class="mobile-card"
              [class.today-row]="isToday(session.clockIn)"
              [class.expanded]="expandedSessionId() === session.id"
              (click)="toggleExpand(session.id)">
              <div class="mc-top">
                <div class="mc-date-wrap">
                  <button
                    class="expand-btn"
                    type="button"
                    [attr.aria-expanded]="expandedSessionId() === session.id"
                    (click)="$event.stopPropagation(); toggleExpand(session.id)"
                    aria-label="Toggle session details">
                    @if (expandedSessionId() === session.id) {
                      <svg lucideChevronUp class="icon-xs" aria-hidden="true"></svg>
                    } @else {
                      <svg lucideChevronDown class="icon-xs" aria-hidden="true"></svg>
                    }
                  </button>
                  <span class="mc-date">{{ formatDate(session.clockIn) }}</span>
                  @if (sessionAlerts().has(session.id)) {
                    <span class="alert-dot" title="Session has alerts"></span>
                  }
                </div>
                <span class="status-badge" [class]="'badge-' + session.status">
                  @if (session.status === 'active') {
                    <span class="pulse-dot"></span>
                  }
                  {{ statusLabel(session.status) }}
                </span>
              </div>
              <div class="mc-times">
                <div class="mc-time-block">
                  <span class="mc-label">In</span>
                  <span class="mc-value mono">{{ formatTime(session.clockIn) }}</span>
                </div>
                <div class="mc-divider"></div>
                <div class="mc-time-block">
                  <span class="mc-label">Out</span>
                  <span class="mc-value mono">{{ session.clockOut ? formatTime(session.clockOut) : '—' }}</span>
                </div>
                <div class="mc-divider"></div>
                <div class="mc-time-block">
                  <span class="mc-label">Worked</span>
                  <span class="mc-value mono worked">{{ formatMinutes(session.workedMinutes) }}</span>
                </div>
              </div>
              <div class="mc-footer">
                <span class="mc-detail">Expected: <span class="mono muted">{{ formatMinutes(expectedMinutes()) }}</span></span>
                <span class="mc-detail">Break: <span class="mono">{{ formatBreak(session.totalBreakMinutes) }}</span></span>
                <span class="mc-detail" [class]="diffClass(session)">
                  Diff: {{ diffPrefix(session) }}{{ formatMinutes(diffMinutes(session)) }}
                </span>
              </div>
              @if (expandedSessionId() === session.id) {
                <div class="mc-expanded-detail">
                  @if (session.breaks && session.breaks.length > 0) {
                    <h4 class="breaks-title">Break History</h4>
                    @for (brk of session.breaks; track brk.id; let i = $index) {
                      <div class="break-item">
                        <span class="break-index">#{{ i + 1 }}</span>
                        <span class="break-time mono">{{ formatTime(brk.start) }} — {{ brk.end ? formatTime(brk.end) : 'ongoing' }}</span>
                        <span class="break-duration mono">{{ formatBreak(brk.duration) }}</span>
                        <span class="break-type" [class.auto]="brk.isAuto">{{ brk.isAuto ? 'Auto' : 'Manual' }}</span>
                        @if (brk.reason) {
                          <span class="break-reason">{{ brk.reason }}</span>
                        }
                      </div>
                    }
                  } @else if (session.totalBreakMinutes > 0) {
                    <p class="breaks-note">Total break: {{ formatBreak(session.totalBreakMinutes) }}</p>
                  }
                </div>
              }
            </div>
          }
        }
      </div>

      <!-- Pagination -->
      @if (!loading() && sortedSessions().length > 0) {
        <div class="pagination-bar">
          <span class="pagination-info">
            Showing {{ rangeStart() + 1 }}–{{ rangeEnd() }} of {{ sortedSessions().length }} entries
          </span>
          <div class="pagination-controls">
            <button
              class="page-btn"
              type="button"
              [disabled]="currentPage() === 1"
              (click)="goToPage(currentPage() - 1)"
              aria-label="Previous page">
              <svg lucideChevronLeft class="icon-xs" aria-hidden="true"></svg>
            </button>
            @for (p of visiblePages(); track p) {
              <button
                class="page-num"
                [class.active]="p === currentPage()"
                type="button"
                (click)="goToPage(p)"
                [attr.aria-current]="p === currentPage() ? 'page' : null">
                {{ p }}
              </button>
            }
            <button
              class="page-btn"
              type="button"
              [disabled]="currentPage() === totalPages()"
              (click)="goToPage(currentPage() + 1)"
              aria-label="Next page">
              <svg lucideChevronRight class="icon-xs" aria-hidden="true"></svg>
            </button>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    @use 'styles/design-tokens' as t;

    :host { display: block; }

    /* ── Card ─────────────────────────────────────────────────────── */

    .history-card {
      background: var(--rws-card, #fff);
      border-radius: var(--rws-radius, 8px);
      box-shadow:
        0 1px 3px rgba(0, 0, 0, 0.06),
        0 1px 2px rgba(0, 0, 0, 0.04);
      overflow: hidden;
    }

    /* ── Header ───────────────────────────────────────────────────── */

    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1.25rem 1.5rem;
      border-bottom: 1px solid var(--rws-border, #d6dce5);
    }

    .header-left {
      display: flex;
      align-items: baseline;
      gap: 0.625rem;
    }

    .card-title {
      margin: 0;
      font-size: 1.0625rem;
      font-weight: 600;
      color: var(--rws-text, #1a1d23);
    }

    .row-count {
      font-size: 0.8125rem;
      color: var(--rws-text-muted, #6b7280);
      font-weight: 500;
      transition: opacity 150ms ease;
    }

    .row-count.hidden { opacity: 0; }

    .export-btn {
      appearance: none;
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.5rem 0.875rem;
      border: 1px solid var(--rws-border, #d6dce5);
      border-radius: var(--rws-radius, 8px);
      background: #fff;
      color: var(--rws-text, #1a1d23);
      font-size: 0.8125rem;
      font-weight: 500;
      font-family: inherit;
      cursor: pointer;
      transition:
        background 150ms ease,
        border-color 150ms ease,
        box-shadow 150ms ease;
    }

    .export-btn:hover:not(:disabled) {
      background: var(--rws-bg, #f5f3f0);
      border-color: #b0b8c4;
    }

    .export-btn:focus-visible {
      outline: 2px solid var(--rws-accent, #138D9E);
      outline-offset: 2px;
    }

    .export-btn:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: 0.625rem;
    }

    .search-wrap {
      position: relative;
      display: flex;
      align-items: center;
    }

    .search-icon {
      position: absolute;
      left: 0.625rem;
      width: 14px;
      height: 14px;
      color: var(--rws-text-muted, #6b7280);
      pointer-events: none;
    }

    .search-input {
      appearance: none;
      width: 200px;
      padding: 0.4375rem 0.75rem 0.4375rem 2rem;
      border: 1px solid var(--rws-border, #d6dce5);
      border-radius: var(--rws-radius, 8px);
      background: #fff;
      color: var(--rws-text, #1a1d23);
      font-size: 0.8125rem;
      font-family: inherit;
      transition: border-color 150ms ease, box-shadow 150ms ease;
    }

    .search-input::placeholder {
      color: var(--rws-text-muted, #9ca3af);
    }

    .search-input:focus {
      outline: none;
      border-color: var(--rws-accent, #138D9E);
      box-shadow: 0 0 0 3px rgba(19, 141, 158, 0.12);
    }

    .expand-btn {
      appearance: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      border: none;
      border-radius: 4px;
      background: transparent;
      color: var(--rws-text-muted, #6b7280);
      cursor: pointer;
      transition: background 120ms ease, color 120ms ease;
      flex-shrink: 0;
    }

    .expand-btn:hover {
      background: var(--rws-bg, #f5f3f0);
      color: var(--rws-text, #1a1d23);
    }

    .expand-btn:focus-visible {
      outline: 2px solid var(--rws-accent, #138D9E);
      outline-offset: 1px;
    }

    .date-cell {
      display: flex;
      align-items: center;
      gap: 0.375rem;
    }

    .alert-dot {
      display: inline-block;
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--rws-warning, #f59e0b);
      flex-shrink: 0;
    }

    .data-row.expanded {
      background: rgba(19, 141, 158, 0.04);
    }

    .detail-row td {
      padding: 0 1rem 1rem 1rem;
    }

    .session-detail {
      background: var(--rws-bg, #f9fafb);
      border-radius: var(--rws-radius, 8px);
      padding: 1rem 1.25rem;
      border: 1px solid var(--rws-border, #e5e7eb);
    }

    .detail-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 0.75rem;
      margin-bottom: 0.75rem;
    }

    .detail-item {
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
    }

    .detail-label {
      font-size: 0.6875rem;
      font-weight: 600;
      color: var(--rws-text-muted, #6b7280);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .detail-value {
      font-size: 0.8125rem;
      color: var(--rws-text, #1a1d23);
    }

    .breaks-section {
      border-top: 1px solid var(--rws-border, #e5e7eb);
      padding-top: 0.75rem;
      margin-top: 0.5rem;
    }

    .breaks-title {
      margin: 0 0 0.5rem;
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--rws-text-muted, #6b7280);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .breaks-list {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
    }

    .break-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.375rem 0.625rem;
      background: #fff;
      border-radius: 6px;
      border: 1px solid var(--rws-border, #e5e7eb);
      font-size: 0.8125rem;
    }

    .break-index {
      font-size: 0.6875rem;
      font-weight: 600;
      color: var(--rws-text-muted, #9ca3af);
      min-width: 1.5rem;
    }

    .break-time {
      flex: 1;
      color: var(--rws-text, #1a1d23);
    }

    .break-duration {
      font-weight: 600;
      color: var(--rws-text, #1a1d23);
    }

    .break-type {
      font-size: 0.6875rem;
      font-weight: 600;
      padding: 0.125rem 0.5rem;
      border-radius: 999px;
      background: rgba(19, 141, 158, 0.1);
      color: var(--rws-accent, #138D9E);
    }

    .break-type.auto {
      background: rgba(245, 158, 11, 0.1);
      color: #d97706;
    }

    .break-reason {
      font-size: 0.75rem;
      color: var(--rws-text-muted, #6b7280);
      font-style: italic;
      margin-left: auto;
      max-width: 140px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .breaks-note {
      margin: 0;
      font-size: 0.8125rem;
      color: var(--rws-text-muted, #6b7280);
      font-style: italic;
    }

    .mc-date-wrap {
      display: flex;
      align-items: center;
      gap: 0.375rem;
    }

    .mc-expanded-detail {
      padding: 0.75rem 0 0;
      border-top: 1px solid var(--rws-border, #e5e7eb);
      margin-top: 0.75rem;
    }

    .mc-expanded-detail .breaks-title {
      margin-bottom: 0.5rem;
    }

    .icon-sm { width: 15px; height: 15px; }
    .icon-xs { width: 13px; height: 13px; }

    /* ── Table ─────────────────────────────────────────────────────── */

    .table-wrap {
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }

    .history-table {
      width: 100%;
      border-collapse: collapse;
      white-space: nowrap;
    }

    .history-table th {
      padding: 0.6875rem 1rem;
      font-size: 0.6875rem;
      font-weight: 600;
      color: var(--rws-text-muted, #6b7280);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      text-align: left;
      background: var(--rws-bg, #f5f3f0);
      border-bottom: 1px solid var(--rws-border, #d6dce5);
      user-select: none;
    }

    .history-table td {
      padding: 0.75rem 1rem;
      font-size: 0.875rem;
      color: var(--rws-text, #1a1d23);
      border-bottom: 1px solid var(--rws-border, #d6dce5);
      vertical-align: middle;
    }

    /* ── Row states ────────────────────────────────────────────────── */

    .data-row {
      transition: background 150ms ease;
    }

    .data-row:hover {
      background: rgba(19, 141, 158, 0.03);
    }

    .data-row.alt {
      background: rgba(245, 243, 240, 0.5);
    }

    .data-row.alt:hover {
      background: rgba(19, 141, 158, 0.04);
    }

    .data-row.today-row {
      background: rgba(19, 141, 158, 0.04);
      border-left: 3px solid var(--rws-accent, #138D9E);
    }

    .data-row.today-row:hover {
      background: rgba(19, 141, 158, 0.06);
    }

    .data-row:last-child td {
      border-bottom: none;
    }

    /* ── Cell variants ─────────────────────────────────────────────── */

    .col-date {
      min-width: 110px;
    }

    .date-text {
      font-weight: 500;
      color: var(--rws-text, #1a1d23);
    }

    .col-time {
      min-width: 80px;
    }

    .col-status {
      min-width: 96px;
    }

    .mono {
      font-family: var(--rws-font-mono, 'IBM Plex Mono', monospace);
      font-size: 0.8125rem;
      letter-spacing: -0.01em;
    }

    .muted {
      color: var(--rws-text-muted, #6b7280);
    }

    .worked {
      font-weight: 700;
      color: var(--rws-primary, #0B4A5A);
    }

    .dash {
      color: var(--rws-text-muted, #6b7280);
    }

    /* ── Diff colours ──────────────────────────────────────────────── */

    .diff-positive { color: var(--rws-success, #2e9e6c); }
    .diff-negative { color: var(--rws-error, #A31D1D); }
    .diff-zero     { color: var(--rws-text-muted, #6b7280); }

    /* ── Status badges ─────────────────────────────────────────────── */

    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.25rem 0.625rem;
      border-radius: 999px;
      font-size: 0.75rem;
      font-weight: 500;
      white-space: nowrap;
    }

    .badge-active {
      background: rgba(46, 158, 108, 0.1);
      color: var(--rws-success, #2e9e6c);
    }

    .badge-break {
      background: rgba(194, 146, 79, 0.1);
      color: var(--rws-gold, #C2924F);
    }

    .badge-completed {
      background: var(--rws-bg, #f5f3f0);
      color: var(--rws-text-muted, #6b7280);
    }

    .pulse-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--rws-success, #2e9e6c);
      animation: pulse 2s ease-in-out infinite;
      flex-shrink: 0;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(46, 158, 108, 0.4); }
      50%      { opacity: 0.6; box-shadow: 0 0 0 4px rgba(46, 158, 108, 0); }
    }

    /* ── Empty state ───────────────────────────────────────────────── */

    .empty-cell {
      text-align: center;
      padding: 3rem 1rem !important;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }

    .empty-text {
      font-size: 0.875rem;
      color: var(--rws-text-muted, #6b7280);
      font-weight: 500;
    }

    /* ── Skeleton ──────────────────────────────────────────────────── */

    .skeleton-row td {
      padding: 0.75rem 1rem;
    }

    .skeleton-row .sk {
      display: inline-block;
      height: 14px;
      background: linear-gradient(
        90deg,
        var(--rws-bg, #f5f3f0) 25%,
        rgba(214, 220, 229, 0.4) 50%,
        var(--rws-bg, #f5f3f0) 75%
      );
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
      border-radius: 4px;
    }

    .sk-badge {
      width: 72px;
      height: 20px;
      border-radius: 999px;
    }

    @keyframes shimmer {
      0%   { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    /* ── Pagination ────────────────────────────────────────────────── */

    .pagination-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.875rem 1.25rem;
      border-top: 1px solid var(--rws-border, #d6dce5);
      background: var(--rws-bg, #f5f3f0);
    }

    .pagination-info {
      font-size: 0.8125rem;
      color: var(--rws-text-muted, #6b7280);
      font-weight: 500;
    }

    .pagination-controls {
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }

    .page-btn {
      appearance: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border: 1px solid var(--rws-border, #d6dce5);
      border-radius: var(--rws-radius, 8px);
      background: #fff;
      color: var(--rws-text-muted, #6b7280);
      cursor: pointer;
      transition: border-color 150ms ease, color 150ms ease, background 150ms ease;
    }

    .page-btn:hover:not(:disabled) {
      border-color: var(--rws-accent, #138D9E);
      color: var(--rws-accent, #138D9E);
      background: rgba(19, 141, 158, 0.04);
    }

    .page-btn:disabled {
      opacity: 0.35;
      cursor: not-allowed;
    }

    .page-btn:focus-visible {
      outline: 2px solid var(--rws-accent, #138D9E);
      outline-offset: 2px;
    }

    .page-num {
      appearance: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 32px;
      height: 32px;
      padding: 0 0.375rem;
      border: 1px solid transparent;
      border-radius: var(--rws-radius, 8px);
      background: transparent;
      color: var(--rws-text-muted, #6b7280);
      font-size: 0.8125rem;
      font-weight: 500;
      font-family: inherit;
      cursor: pointer;
      transition: background 150ms ease, color 150ms ease, border-color 150ms ease;
    }

    .page-num:hover:not(.active) {
      background: rgba(19, 141, 158, 0.06);
      color: var(--rws-text, #1a1d23);
    }

    .page-num.active {
      background: var(--rws-accent, #138D9E);
      color: #fff;
      border-color: var(--rws-accent, #138D9E);
      font-weight: 600;
    }

    .page-num:focus-visible {
      outline: 2px solid var(--rws-accent, #138D9E);
      outline-offset: 2px;
    }

    /* ── Mobile cards ──────────────────────────────────────────────── */

    .mobile-cards { display: none; }

    .sk-card-row {
      height: 100px;
      border-radius: var(--rws-radius, 8px);
      margin: 0 1rem 0.75rem;
      background: linear-gradient(
        90deg,
        var(--rws-bg, #f5f3f0) 25%,
        rgba(214, 220, 229, 0.4) 50%,
        var(--rws-bg, #f5f3f0) 75%
      );
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
    }

    /* ── Responsive ────────────────────────────────────────────────── */

    @media (max-width: 768px) {
      .table-wrap { display: none; }

      .mobile-cards {
        display: flex;
        flex-direction: column;
        padding: 0.75rem 0;
        gap: 0.75rem;
      }

      .mobile-card {
        margin: 0 1rem;
        background: var(--rws-card, #fff);
        border: 1px solid var(--rws-border, #d6dce5);
        border-radius: var(--rws-radius, 8px);
        padding: 1rem;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
        transition: border-color 150ms ease;
      }

      .mobile-card.today-row {
        border-left: 3px solid var(--rws-accent, #138D9E);
      }

      .mc-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 0.75rem;
      }

      .mc-date {
        font-size: 0.875rem;
        font-weight: 600;
        color: var(--rws-text, #1a1d23);
      }

      .mc-times {
        display: flex;
        align-items: center;
        gap: 0;
        margin-bottom: 0.75rem;
      }

      .mc-time-block {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.125rem;
      }

      .mc-label {
        font-size: 0.625rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--rws-text-muted, #6b7280);
      }

      .mc-value {
        font-family: var(--rws-font-mono, 'IBM Plex Mono', monospace);
        font-size: 0.8125rem;
        font-weight: 600;
        color: var(--rws-text, #1a1d23);
      }

      .mc-value.worked {
        color: var(--rws-primary, #0B4A5A);
      }

      .mc-divider {
        width: 1px;
        height: 28px;
        background: var(--rws-border, #d6dce5);
        flex-shrink: 0;
      }

      .mc-footer {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem 1rem;
        padding-top: 0.625rem;
        border-top: 1px solid var(--rws-border, #d6dce5);
      }

      .mc-detail {
        font-size: 0.75rem;
        color: var(--rws-text-muted, #6b7280);
      }

      .mc-detail .mono {
        font-size: 0.75rem;
        font-weight: 600;
      }

      .pagination-bar {
        flex-direction: column;
        gap: 0.625rem;
      }
    }

    @media (max-width: 480px) {
      .card-header {
        padding: 1rem;
        flex-wrap: wrap;
        gap: 0.625rem;
      }

      .header-right {
        width: 100%;
      }

      .search-input {
        width: 100%;
        flex: 1;
      }

      .card-title {
        font-size: 0.9375rem;
      }

      .export-btn {
        padding: 0.375rem 0.625rem;
        font-size: 0.75rem;
      }

      .pagination-info {
        font-size: 0.75rem;
      }

      .break-item {
        flex-wrap: wrap;
        gap: 0.375rem;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .pulse-dot { animation: none; }
      .skeleton-row .sk { animation: none; }
      .sk-card-row { animation: none; }
    }
  `],
})
export class TimeHistoryComponent {
  readonly sessions = input.required<SessionWithWorked[]>();
  readonly loading = input<boolean>(false);
  readonly policy = input<CompanyWorkPolicy | null>(null);
  readonly sessionAlerts = input<Map<number, boolean>>(new Map());

  readonly rowsPerPage = 10;
  readonly skeletonRows = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

  readonly currentPage = signal(1);
  readonly exportClick = signal(0);
  readonly searchQuery = signal('');
  readonly expandedSessionId = signal<number | null>(null);

  protected readonly expectedMinutes = computed(() => {
    const p = this.policy();
    return p ? Math.round(p.expectedDailyHours * 60) : 480;
  });

  protected readonly filteredSessions = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const all = this.sessions();
    if (!query) return all;
    return all.filter((s) => {
      const dateStr = new Date(s.clockIn).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).toLowerCase();
      const statusStr = s.status.toLowerCase();
      const clockInStr = new Date(s.clockIn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase();
      const clockOutStr = s.clockOut ? new Date(s.clockOut).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase() : '';
      return dateStr.includes(query) || statusStr.includes(query) || clockInStr.includes(query) || clockOutStr.includes(query);
    });
  });

  protected readonly sortedSessions = computed(() => {
    return [...this.filteredSessions()].sort((a, b) =>
      new Date(b.clockIn).getTime() - new Date(a.clockIn).getTime()
    );
  });

  protected readonly totalPages = computed(() => {
    return Math.max(1, Math.ceil(this.sortedSessions().length / this.rowsPerPage));
  });

  protected readonly rangeStart = computed(() => {
    return (this.currentPage() - 1) * this.rowsPerPage;
  });

  protected readonly rangeEnd = computed(() => {
    return Math.min(this.rangeStart() + this.rowsPerPage, this.sortedSessions().length);
  });

  protected readonly paginatedSessions = computed(() => {
    const all = this.sortedSessions();
    return all.slice(this.rangeStart(), this.rangeEnd());
  });

  protected readonly visiblePages = computed(() => {
    const total = this.totalPages();
    const current = this.currentPage();
    const pages: number[] = [];

    if (total <= 5) {
      for (let i = 1; i <= total; i++) pages.push(i);
    } else {
      let start = Math.max(1, current - 2);
      let end = Math.min(total, start + 4);
      if (end - start < 4) start = Math.max(1, end - 4);
      for (let i = start; i <= end; i++) pages.push(i);
    }

    return pages;
  });

  constructor() {
    effect(() => {
      this.sessions();
      this.currentPage.set(1);
      this.expandedSessionId.set(null);
    });
  }

  toggleExpand(sessionId: number): void {
    this.expandedSessionId.set(this.expandedSessionId() === sessionId ? null : sessionId);
  }

  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchQuery.set(value);
    this.currentPage.set(1);
    this.expandedSessionId.set(null);
  }

  goToPage(page: number): void {
    const total = this.totalPages();
    if (page >= 1 && page <= total) {
      this.currentPage.set(page);
    }
  }

  formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  formatTime(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  }

  formatMinutes(minutes: number): string {
    const h = Math.floor(Math.abs(minutes) / 60);
    const m = Math.abs(minutes) % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  formatBreak(minutes: number): string {
    if (minutes === 0) return '0m';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  diffMinutes(session: SessionWithWorked): number {
    return session.workedMinutes - this.expectedMinutes();
  }

  diffPrefix(session: SessionWithWorked): string {
    return this.diffMinutes(session) >= 0 ? '+' : '−';
  }

  diffClass(session: SessionWithWorked): string {
    const diff = this.diffMinutes(session);
    if (diff > 0) return 'mono diff-positive';
    if (diff < 0) return 'mono diff-negative';
    return 'mono diff-zero';
  }

  statusLabel(status: string): string {
    switch (status) {
      case 'active': return 'Active';
      case 'break': return 'Break';
      case 'completed': return 'Completed';
      default: return status;
    }
  }

  isToday(iso: string): boolean {
    const d = new Date(iso);
    const now = new Date();
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  }

  onExport(): void {
    const rows = this.sortedSessions();
    if (rows.length === 0) return;

    const headers = ['Date', 'Clock In', 'Clock Out', 'Worked', 'Expected', 'Break', 'Difference', 'Status'];
    const csvRows = [headers.join(',')];

    for (const s of rows) {
      const diff = this.diffMinutes(s);
      const diffStr = `${diff >= 0 ? '+' : '-'}${this.formatMinutes(Math.abs(diff))}`;
      csvRows.push([
        this.formatDate(s.clockIn),
        this.formatTime(s.clockIn),
        s.clockOut ? this.formatTime(s.clockOut) : '',
        this.formatMinutes(s.workedMinutes),
        this.formatMinutes(this.expectedMinutes()),
        this.formatBreak(s.totalBreakMinutes),
        diffStr,
        this.statusLabel(s.status),
      ].join(','));
    }

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `work-history-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
