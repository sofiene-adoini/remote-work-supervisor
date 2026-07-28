import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  LucideSettings, LucideSave, LucideCheck, LucideX,
} from '@lucide/angular';
import { HrSettingsService } from '../services/hr-settings.service';
import { CompanyWorkPolicy } from '../../employee/models/employee.models';

@Component({
  selector: 'app-hr-settings',
  imports: [FormsModule, LucideSettings, LucideSave, LucideCheck, LucideX],
  template: `
    <div class="settings-page">
      @if (loading()) {
        <div class="sk-card">
          <div class="sk sk-title" style="width: 200px; height: 24px;"></div>
          <div class="sk-grid-settings">
            @for (i of [1,2,3,4,5,6,7,8]; track i) {
              <div class="sk-field">
                <div class="sk sk-text-sm" style="width: 120px; height: 14px;"></div>
                <div class="sk sk-input" style="height: 40px;"></div>
              </div>
            }
          </div>
        </div>
      } @else if (policy()) {
        <div class="settings-card">
          <div class="card-header">
            <div class="header-left">
              <svg lucideSettings class="header-icon"></svg>
              <h2 class="card-title">Company Work Policy</h2>
            </div>
            @if (saveMessage()) {
              <div class="save-msg" [class.error]="saveError()">
                @if (!saveError()) {
                  <svg lucideCheck class="icon-xs"></svg>
                } @else {
                  <svg lucideX class="icon-xs"></svg>
                }
                {{ saveMessage() }}
              </div>
            }
          </div>

          <div class="form-grid">
            <!-- Daily Hours Section -->
            <div class="section">
              <h3 class="section-title">Daily Hours</h3>
              <div class="field-grid">
                <div class="field">
                  <label class="field-label">Expected Daily Hours</label>
                  <input class="field-input" type="number" [(ngModel)]="policy()!.expectedDailyHours"
                    [min]="1" [max]="24" step="0.5">
                </div>
                <div class="field">
                  <label class="field-label">Maximum Daily Hours</label>
                  <input class="field-input" type="number" [(ngModel)]="policy()!.maximumDailyHours"
                    [min]="1" [max]="24" step="0.5">
                </div>
              </div>
            </div>

            <!-- Weekly Hours Section -->
            <div class="section">
              <h3 class="section-title">Weekly Hours</h3>
              <div class="field-grid">
                <div class="field">
                  <label class="field-label">Expected Weekly Hours</label>
                  <input class="field-input" type="number" [(ngModel)]="policy()!.expectedWeeklyHours"
                    [min]="1" [max]="168" step="1">
                </div>
                <div class="field">
                  <label class="field-label">Maximum Weekly Hours</label>
                  <input class="field-input" type="number" [(ngModel)]="policy()!.maximumWeeklyHours"
                    [min]="1" [max]="168" step="1">
                </div>
              </div>
            </div>

            <!-- Break Policy Section -->
            <div class="section">
              <h3 class="section-title">Break Policy</h3>
              <div class="field-grid">
                <div class="field">
                  <label class="field-label">Minimum Break Duration (minutes)</label>
                  <input class="field-input" type="number" [(ngModel)]="policy()!.minimumBreakMinutes"
                    [min]="0" [max]="480" step="5">
                </div>
                <div class="field">
                  <label class="field-label">Maximum Continuous Work (hours)</label>
                  <input class="field-input" type="number" [(ngModel)]="policy()!.maximumContinuousWorkHours"
                    [min]="1" [max]="24" step="1">
                </div>
              </div>
            </div>

            <!-- Overtime Section -->
            <div class="section">
              <h3 class="section-title">Overtime</h3>
              <div class="field-grid">
                <div class="field">
                  <label class="field-label">Overtime Starts After (hours)</label>
                  <input class="field-input" type="number" [(ngModel)]="policy()!.overtimeStartsAfterDailyHours"
                    [min]="1" [max]="24" step="0.5">
                </div>
                <div class="field">
                  <label class="field-label">Minimum Overtime Threshold (minutes)</label>
                  <input class="field-input" type="number" [(ngModel)]="policy()!.minimumOvertimeThresholdMinutes"
                    [min]="0" [max]="240" step="5">
                </div>
                <div class="field">
                  <label class="field-label">Auto Overtime</label>
                  <div class="toggle-wrap">
                    <label class="toggle">
                      <input type="checkbox" [(ngModel)]="policy()!.autoOvertimeEnabled">
                      <span class="toggle-slider"></span>
                    </label>
                    <span class="toggle-label">{{ policy()!.autoOvertimeEnabled ? 'Enabled' : 'Disabled' }}</span>
                  </div>
                </div>
                <div class="field">
                  <label class="field-label">Require HR Approval</label>
                  <div class="toggle-wrap">
                    <label class="toggle">
                      <input type="checkbox" [(ngModel)]="policy()!.requireHrApproval">
                      <span class="toggle-slider"></span>
                    </label>
                    <span class="toggle-label">{{ policy()!.requireHrApproval ? 'Required' : 'Auto-approved' }}</span>
                  </div>
                </div>
                <div class="field">
                  <label class="field-label">Require Justification</label>
                  <div class="toggle-wrap">
                    <label class="toggle">
                      <input type="checkbox" [(ngModel)]="policy()!.requireJustification">
                      <span class="toggle-slider"></span>
                    </label>
                    <span class="toggle-label">{{ policy()!.requireJustification ? 'Required' : 'Optional' }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Tolerance Section -->
            <div class="section">
              <h3 class="section-title">Tolerance</h3>
              <div class="field-grid">
                <div class="field">
                  <label class="field-label">Late Tolerance (minutes)</label>
                  <input class="field-input" type="number" [(ngModel)]="policy()!.lateToleranceMinutes"
                    [min]="0" [max]="120" step="1">
                </div>
                <div class="field">
                  <label class="field-label">Early Leave Tolerance (minutes)</label>
                  <input class="field-input" type="number" [(ngModel)]="policy()!.earlyLeaveToleranceMinutes"
                    [min]="0" [max]="120" step="1">
                </div>
              </div>
            </div>

            <!-- Schedule Section -->
            <div class="section">
              <h3 class="section-title">Schedule</h3>
              <div class="field-grid">
                <div class="field">
                  <label class="field-label">Timezone</label>
                  <select class="field-input" [(ngModel)]="policy()!.timezone">
                    <option value="Africa/Tunis">Africa/Tunis (CET)</option>
                    <option value="UTC">UTC</option>
                    <option value="Europe/London">Europe/London (GMT/BST)</option>
                    <option value="Europe/Paris">Europe/Paris (CET)</option>
                    <option value="America/New_York">America/New_York (EST)</option>
                    <option value="America/Los_Angeles">America/Los_Angeles (PST)</option>
                    <option value="Asia/Dubai">Asia/Dubai (GST)</option>
                    <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                  </select>
                </div>
                <div class="field">
                  <label class="field-label">Allow Weekend Work</label>
                  <div class="toggle-wrap">
                    <label class="toggle">
                      <input type="checkbox" [(ngModel)]="policy()!.allowWeekendWork">
                      <span class="toggle-slider"></span>
                    </label>
                    <span class="toggle-label">{{ policy()!.allowWeekendWork ? 'Allowed' : 'Not Allowed' }}</span>
                  </div>
                </div>
              </div>

              <div class="field">
                <label class="field-label">Working Days</label>
                <div class="days-row">
                  @for (day of allDays; track day) {
                    <label class="day-chip" [class.active]="policy()!.workingDays.includes(day)">
                      <input type="checkbox" [checked]="policy()!.workingDays.includes(day)"
                        (change)="toggleWorkingDay(day)" hidden>
                      <span>{{ day.substring(0, 3) }}</span>
                    </label>
                  }
                </div>
              </div>
            </div>
          </div>

          <div class="card-footer">
            <button class="btn-save" (click)="save()" [disabled]="saving()">
              @if (saving()) {
                <span class="spinner"></span>
              } @else {
                <svg lucideSave class="icon-sm"></svg>
              }
              {{ saving() ? 'Saving...' : 'Save Policy' }}
            </button>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    @use 'styles/design-tokens' as t;

    .settings-page {
      max-width: 800px;
    }

    .settings-card {
      background: #fff;
      border-radius: 14px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
      padding: 0;
      overflow: hidden;
    }

    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1.25rem 1.5rem;
      border-bottom: 1px solid var(--rws-border);
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 0.625rem;
    }

    .header-icon {
      width: 22px;
      height: 22px;
      color: var(--rws-accent);
    }

    .card-title {
      margin: 0;
      font-size: 1.125rem;
      font-weight: 600;
      color: var(--rws-text);
    }

    .save-msg {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      font-size: 0.8125rem;
      font-weight: 500;
      color: #167d72;
      padding: 0.375rem 0.75rem;
      border-radius: var(--rws-radius);
      background: #e8f8f6;
      animation: fadeIn 200ms ease;

      &.error {
        color: #d64545;
        background: #fde8e8;
      }
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .form-grid {
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 2rem;
    }

    .section {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .section-title {
      margin: 0;
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--rws-accent);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .field-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;

      @media (max-width: 639px) {
        grid-template-columns: 1fr;
      }
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
    }

    .field-label {
      font-size: 0.8125rem;
      font-weight: 500;
      color: var(--rws-text-muted);
    }

    .field-input {
      padding: 0.625rem 0.875rem;
      border: 1px solid var(--rws-border);
      border-radius: var(--rws-radius);
      font-size: 0.9375rem;
      font-family: var(--rws-font-mono);
      color: var(--rws-text);
      background: #fff;
      transition: border-color 150ms ease, box-shadow 150ms ease;
      width: 100%;
      box-sizing: border-box;

      &:focus {
        outline: none;
        border-color: var(--rws-accent);
        box-shadow: 0 0 0 3px rgba(19, 141, 158, 0.12);
      }

      &::-webkit-inner-spin-button,
      &::-webkit-outer-spin-button {
        opacity: 1;
      }
    }

    select.field-input {
      cursor: pointer;
      appearance: auto;
    }

    .toggle-wrap {
      display: flex;
      align-items: center;
      gap: 0.625rem;
    }

    .toggle {
      position: relative;
      display: inline-block;
      width: 44px;
      height: 24px;
      cursor: pointer;
    }

    .toggle input {
      opacity: 0;
      width: 0;
      height: 0;
    }

    .toggle-slider {
      position: absolute;
      inset: 0;
      background: #d1d5db;
      border-radius: 999px;
      transition: background 200ms ease;
    }

    .toggle-slider::before {
      content: '';
      position: absolute;
      width: 18px;
      height: 18px;
      left: 3px;
      top: 3px;
      background: #fff;
      border-radius: 50%;
      transition: transform 200ms ease;
      box-shadow: 0 1px 3px rgba(0,0,0,0.15);
    }

    .toggle input:checked + .toggle-slider {
      background: var(--rws-accent);
    }

    .toggle input:checked + .toggle-slider::before {
      transform: translateX(20px);
    }

    .toggle-label {
      font-size: 0.8125rem;
      color: var(--rws-text-muted);
      font-weight: 500;
    }

    .days-row {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .day-chip {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 36px;
      border-radius: var(--rws-radius);
      border: 1px solid var(--rws-border);
      background: #fff;
      cursor: pointer;
      transition: all 150ms ease;
      font-size: 0.8125rem;
      font-weight: 500;
      color: var(--rws-text-muted);

      &:hover {
        border-color: var(--rws-accent);
      }

      &.active {
        background: var(--rws-accent);
        border-color: var(--rws-accent);
        color: #fff;
        font-weight: 600;
      }
    }

    .card-footer {
      display: flex;
      justify-content: flex-end;
      padding: 1rem 1.5rem;
      border-top: 1px solid var(--rws-border);
      background: rgba(0,0,0,0.01);
    }

    .btn-save {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.625rem 1.25rem;
      background: var(--rws-accent);
      color: #fff;
      border: none;
      border-radius: var(--rws-radius);
      font-size: 0.9375rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 150ms ease, transform 100ms ease;

      &:hover { background: var(--rws-accent-strong); }
      &:active { transform: scale(0.97); }
      &:disabled { opacity: 0.6; cursor: not-allowed; }
      &:focus-visible { outline: 3px solid var(--rws-focus-ring); outline-offset: 2px; }
    }

    .spinner {
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255,255,255,0.3);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 600ms linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .icon-sm { width: 16px; height: 16px; }
    .icon-xs { width: 14px; height: 14px; }

    .sk-card {
      background: #fff;
      border-radius: 14px;
      padding: 1.5rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    }

    .sk-grid-settings {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.5rem;
      margin-top: 1.5rem;
    }

    .sk-field {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .sk {
      background: #f0f2f5;
      border-radius: var(--rws-radius);
      animation: shimmer 1.5s ease-in-out infinite;
    }

    .sk-title { border-radius: 6px; }
    .sk-text-sm { border-radius: 4px; }
    .sk-input { border-radius: var(--rws-radius); }

    @keyframes shimmer {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    @media (max-width: 639px) {
      .sk-grid-settings { grid-template-columns: 1fr; }
    }
  `],
})
export class HrSettingsComponent implements OnInit {
  private readonly settingsService = inject(HrSettingsService);

  protected readonly policy = signal<CompanyWorkPolicy | null>(null);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly saveMessage = signal('');
  protected readonly saveError = signal(false);

  protected readonly allDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  ngOnInit(): void {
    this.loadPolicy();
  }

  private loadPolicy(): void {
    this.settingsService.getPolicy().subscribe({
      next: (res) => {
        this.policy.set({ ...res.policy });
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected toggleWorkingDay(day: string): void {
    this.policy.update((p) => {
      if (!p) return p;
      const days = [...p.workingDays];
      const idx = days.indexOf(day);
      if (idx >= 0) {
        days.splice(idx, 1);
      } else {
        days.push(day);
      }
      return { ...p, workingDays: days };
    });
  }

  protected save(): void {
    const p = this.policy();
    if (!p) return;

    this.saving.set(true);
    this.saveMessage.set('');
    this.saveError.set(false);

    this.settingsService.updatePolicy(p).subscribe({
      next: (res) => {
        this.policy.set({ ...res.policy });
        this.saving.set(false);
        this.saveMessage.set('Policy saved successfully');
        setTimeout(() => this.saveMessage.set(''), 3000);
      },
      error: (err) => {
        this.saving.set(false);
        this.saveMessage.set(err?.error?.error?.message || 'Failed to save policy');
        this.saveError.set(true);
        setTimeout(() => this.saveMessage.set(''), 5000);
      },
    });
  }
}
