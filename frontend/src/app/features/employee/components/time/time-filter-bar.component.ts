import { Component, computed, input, output, signal } from '@angular/core';
import { LucideCalendar, LucideClock } from '@lucide/angular';

interface FilterPreset {
  key: string;
  label: string;
}

@Component({
  selector: 'app-time-filter-bar',
  imports: [LucideCalendar, LucideClock],
  template: `
    <div class="filter-card">
      <div class="filter-header">
        <span class="filter-label">
          <svg lucideCalendar class="icon-sm" aria-hidden="true"></svg>
          Date Range
        </span>
        @if (loading()) {
          <span class="filter-loading">
            <svg lucideClock class="icon-xs spin" aria-hidden="true"></svg>
            Loading...
          </span>
        }
      </div>

      <div class="presets-row">
        @for (preset of presets; track preset.key) {
          <button
            class="preset-chip"
            [class.active]="activePreset() === preset.key"
            (click)="onPresetClick(preset.key)"
            [disabled]="loading()">
            {{ preset.label }}
          </button>
        }
      </div>

      @if (activePreset() === 'custom') {
        <div class="custom-range">
          <div class="date-input-group">
            <label class="date-label" for="range-start">From</label>
            <input
              id="range-start"
              type="date"
              class="date-input"
              [value]="startDate()"
              (change)="onStartDateChange($event)"
              [disabled]="loading()" />
          </div>
          <span class="date-separator">—</span>
          <div class="date-input-group">
            <label class="date-label" for="range-end">To</label>
            <input
              id="range-end"
              type="date"
              class="date-input"
              [value]="endDate()"
              (change)="onEndDateChange($event)"
              [disabled]="loading()" />
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    @use 'styles/design-tokens' as t;

    .filter-card {
      background: var(--rws-card);
      border-radius: var(--rws-radius);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04);
      padding: 1rem 1.25rem;
      transition: box-shadow 200ms ease;
    }

    .filter-card:hover {
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.04);
    }

    /* ── Header ──────────────────────────────────────────────── */

    .filter-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 0.875rem;
    }

    .filter-label {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--rws-text);
    }

    .filter-loading {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      font-size: 0.75rem;
      color: var(--rws-text-muted);
      font-weight: 500;
    }

    /* ── Preset chips ────────────────────────────────────────── */

    .presets-row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.375rem;
    }

    .preset-chip {
      appearance: none;
      border: 1px solid var(--rws-border);
      background: var(--rws-bg);
      color: var(--rws-text-muted);
      border-radius: 999px;
      padding: 0.375rem 0.75rem;
      font-size: 0.75rem;
      font-weight: 500;
      font-family: inherit;
      cursor: pointer;
      white-space: nowrap;
      transition:
        background 150ms ease,
        color 150ms ease,
        border-color 150ms ease,
        box-shadow 150ms ease;
    }

    .preset-chip:hover:not(:disabled):not(.active) {
      background: #e9e6e2;
      color: var(--rws-text);
      border-color: #c4ccd6;
    }

    .preset-chip:focus-visible {
      outline: 2px solid var(--rws-accent);
      outline-offset: 2px;
    }

    .preset-chip.active {
      background: var(--rws-accent);
      color: #fff;
      border-color: var(--rws-accent);
      box-shadow: 0 1px 3px rgba(19, 141, 158, 0.25);
    }

    .preset-chip:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }

    /* ── Custom range inputs ─────────────────────────────────── */

    .custom-range {
      display: flex;
      align-items: flex-end;
      gap: 0.625rem;
      margin-top: 0.875rem;
      padding-top: 0.875rem;
      border-top: 1px solid var(--rws-border);
      animation: slide-down 180ms ease;
    }

    @keyframes slide-down {
      from {
        opacity: 0;
        transform: translateY(-4px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .date-input-group {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .date-label {
      font-size: 0.6875rem;
      font-weight: 600;
      color: var(--rws-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .date-input {
      appearance: none;
      border: 1px solid var(--rws-border);
      border-radius: var(--rws-radius);
      padding: 0.5rem 0.625rem;
      font-size: 0.8125rem;
      font-family: var(--rws-font-mono);
      color: var(--rws-text);
      background: #fff;
      min-width: 140px;
      transition: border-color 150ms ease, box-shadow 150ms ease;
    }

    .date-input:hover:not(:disabled) {
      border-color: #b0b8c4;
    }

    .date-input:focus {
      outline: none;
      border-color: var(--rws-accent);
      box-shadow: 0 0 0 3px var(--rws-focus-ring);
    }

    .date-input:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }

    .date-separator {
      color: var(--rws-text-muted);
      font-size: 0.875rem;
      padding-bottom: 0.5rem;
      flex-shrink: 0;
    }

    /* ── Utilities ───────────────────────────────────────────── */

    .icon-sm { width: 15px; height: 15px; }
    .icon-xs { width: 13px; height: 13px; }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    .spin {
      animation: spin 1s linear infinite;
    }

    /* ── Responsive ──────────────────────────────────────────── */

    @media (max-width: 640px) {
      .filter-card {
        padding: 0.875rem 1rem;
      }

      .presets-row {
        gap: 0.3rem;
      }

      .preset-chip {
        padding: 0.3rem 0.625rem;
        font-size: 0.6875rem;
      }

      .custom-range {
        flex-direction: column;
        align-items: stretch;
        gap: 0.5rem;
      }

      .date-separator {
        display: none;
      }

      .date-input {
        min-width: 0;
        width: 100%;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .spin { animation: none; }
      .custom-range { animation: none; }
    }
  `],
})
export class TimeFilterBarComponent {
  readonly activePreset = input<string>('last-7-days');
  readonly loading = input(false);

  readonly presetChange = output<string>();
  readonly dateRangeChange = output<{ start: string; end: string }>();

  readonly presets: FilterPreset[] = [
    { key: 'today',          label: 'Today' },
    { key: 'yesterday',      label: 'Yesterday' },
    { key: 'last-7-days',    label: 'Last 7 Days' },
    { key: 'last-14-days',   label: 'Last 14 Days' },
    { key: 'last-30-days',   label: 'Last 30 Days' },
    { key: 'this-week',      label: 'This Week' },
    { key: 'previous-week',  label: 'Previous Week' },
    { key: 'this-month',     label: 'This Month' },
    { key: 'previous-month', label: 'Previous Month' },
    { key: 'custom',         label: 'Custom Range' },
  ];

  readonly startDate = signal('');
  readonly endDate = signal('');

  onPresetClick(key: string): void {
    this.presetChange.emit(key);

    if (key !== 'custom') {
      this.startDate.set('');
      this.endDate.set('');
    }
  }

  onStartDateChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.startDate.set(value);
    this.emitDateRangeIfReady();
  }

  onEndDateChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.endDate.set(value);
    this.emitDateRangeIfReady();
  }

  private emitDateRangeIfReady(): void {
    const start = this.startDate();
    const end = this.endDate();
    if (start && end) {
      this.dateRangeChange.emit({ start, end });
    }
  }
}
