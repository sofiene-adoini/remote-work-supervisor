import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LucideUsers, LucidePlus, LucideX, LucideArrowRight } from '@lucide/angular';
import { HrTeamsService } from '../services/hr-teams.service';
import { HrTeam, HrUnassignedEmployee } from '../models/hr.models';

@Component({
  selector: 'app-hr-teams',
  imports: [RouterLink, FormsModule, LucideUsers, LucidePlus, LucideX, LucideArrowRight],
  template: `
    <div class="page-container">
      <div class="page-header">
        <h2 class="page-heading">Teams</h2>
        <button class="btn btn-primary" type="button" (click)="openDialog()">
          <svg lucidePlus class="icon-sm" aria-hidden="true"></svg>
          New Team
        </button>
      </div>

      @if (loading()) {
        <div class="sk-grid">
          @for (i of [1,2,3]; track i) {
            <div class="sk sk-card"></div>
          }
        </div>
      } @else if (teams().length === 0) {
        <div class="empty-state">
          <svg lucideUsers class="empty-icon"></svg>
          <p class="empty-title">No teams yet</p>
          <p class="empty-sub">Click "New Team" to create your first team.</p>
        </div>
      } @else {
        <div class="teams-grid">
          @for (team of teams(); track team.id) {
            <div class="team-card">
              <div class="team-icon-wrap">
                <svg lucideUsers class="team-icon"></svg>
              </div>
              <div class="team-body">
                <h3 class="team-name">{{ team.name }}</h3>
                @if (team.memberCount > 0) {
                  <span class="team-count">{{ team.memberCount }} member{{ team.memberCount === 1 ? '' : 's' }}</span>
                }
              </div>
              <a [routerLink]="['/hr/teams', team.id]" class="team-link">
                View <svg lucideArrowRight class="icon-xs"></svg>
              </a>
            </div>
          }
        </div>
      }

      @if (dialogOpen()) {
        <div class="dialog-overlay" (click)="closeDialog()"></div>
        <div class="dialog" role="dialog" aria-modal="true" aria-label="New Team">
          <div class="dialog-header">
            <h2 class="dialog-title">New Team</h2>
            <button class="dialog-close" type="button" (click)="closeDialog()" aria-label="Close">
              <svg lucideX class="icon-sm" aria-hidden="true"></svg>
            </button>
          </div>
          <div class="dialog-body">
            <div class="form-group">
              <label class="form-label" for="team-name">Team Name</label>
              <input class="form-input" id="team-name" type="text" [(ngModel)]="name" placeholder="e.g. Engineering">
            </div>

            <div class="form-group">
              <label class="form-label">Members</label>
              @if (unassignedEmployees().length === 0) {
                <p class="form-hint">No unassigned employees</p>
              } @else {
                <div class="member-list">
                  @for (emp of unassignedEmployees(); track emp.id) {
                    <label class="member-checkbox">
                      <input type="checkbox" [checked]="isMemberSelected(emp.id)" (change)="toggleMember(emp.id)">
                      <span class="member-info">
                        <span class="avatar-xs">{{ emp.fullName.charAt(0) }}</span>
                        <span class="member-name">{{ emp.fullName }}</span>
                        <span class="member-email">{{ emp.email }}</span>
                      </span>
                    </label>
                  }
                </div>
              }
            </div>

            @if (error()) {
              <p class="form-error">{{ error() }}</p>
            }
          </div>
          <div class="dialog-footer">
            <button class="btn btn-secondary" type="button" (click)="closeDialog()">Cancel</button>
            <button class="btn btn-primary" type="button" (click)="submitTeam()" [disabled]="submitting()">
              {{ submitting() ? 'Creating...' : 'Create Team' }}
            </button>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    @use 'styles/design-tokens' as t;

    .page-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1.5rem;
    }

    .page-heading { margin: 0; font-size: 1.375rem; font-weight: 700; color: var(--rws-text); }

    .teams-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1rem;
    }

    .team-card {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1.25rem;
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
      border: 1px solid transparent;
      transition: border-color 150ms ease, box-shadow 150ms ease, transform 150ms ease;

      &:hover {
        border-color: var(--rws-accent);
        transform: translateY(-1px);
      }
    }

    .team-icon-wrap {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      border-radius: 10px;
      background: #e8f1fb;
      flex-shrink: 0;
    }

    .team-icon { width: 20px; height: 20px; color: var(--rws-primary); }

    .team-body { flex: 1; min-width: 0; }
    .team-name { margin: 0; font-size: 1rem; font-weight: 600; color: var(--rws-text); }
    .team-count { font-size: 0.8125rem; color: var(--rws-text-muted); }

    .team-link {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      font-size: 0.8125rem;
      font-weight: 500;
      color: var(--rws-accent);
      text-decoration: none;
      white-space: nowrap;

      &:hover { color: var(--rws-accent-strong); }
    }

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

    .icon-sm { width: 16px; height: 16px; }
    .icon-xs { width: 14px; height: 14px; }

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

    .form-group { display: flex; flex-direction: column; gap: 0.375rem; }
    .form-label { font-size: 0.8125rem; font-weight: 600; color: var(--rws-text); }
    .form-hint { margin: 0; font-size: 0.8125rem; color: var(--rws-text-muted); font-style: italic; }

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

    .form-error { margin: 0; font-size: 0.8125rem; color: var(--rws-error); }

    .member-list {
      max-height: 200px;
      overflow-y: auto;
      border: 1px solid var(--rws-border);
      border-radius: var(--rws-radius);
    }

    .member-checkbox {
      display: flex;
      align-items: center;
      gap: 0.625rem;
      padding: 0.625rem 0.75rem;
      cursor: pointer;
      transition: background 150ms ease;

      &:hover { background: #fafbfc; }
      & + & { border-top: 1px solid var(--rws-border); }
    }

    .member-info {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex: 1;
      min-width: 0;
    }

    .avatar-xs {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--rws-primary), var(--rws-accent));
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.625rem;
      font-weight: 700;
      color: #fff;
      flex-shrink: 0;
    }

    .member-name { font-size: 0.875rem; font-weight: 500; color: var(--rws-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .member-email { font-size: 0.8125rem; color: var(--rws-text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

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
export class HrTeamsComponent implements OnInit {
  private readonly teamsService = inject(HrTeamsService);
  protected readonly teams = signal<HrTeam[]>([]);
  protected readonly loading = signal(true);

  protected readonly dialogOpen = signal(false);
  protected name = '';
  protected readonly selectedMemberIds = signal<Set<number>>(new Set());
  protected readonly unassignedEmployees = signal<HrUnassignedEmployee[]>([]);
  protected readonly submitting = signal(false);
  protected readonly error = signal('');

  ngOnInit(): void {
    this.loadTeams();
  }

  private loadTeams(): void {
    this.loading.set(true);
    this.teamsService.getTeams().subscribe({
      next: (res) => {
        this.teams.set(res.teams);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  openDialog(): void {
    this.name = '';
    this.selectedMemberIds.set(new Set());
    this.error.set('');
    this.dialogOpen.set(true);

    this.teamsService.getUnassignedEmployees().subscribe({
      next: (res) => this.unassignedEmployees.set(res.employees),
      error: () => this.unassignedEmployees.set([]),
    });
  }

  closeDialog(): void {
    this.dialogOpen.set(false);
  }

  isMemberSelected(id: number): boolean {
    return this.selectedMemberIds().has(id);
  }

  toggleMember(id: number): void {
    this.selectedMemberIds.update((set) => {
      const next = new Set(set);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }

  submitTeam(): void {
    this.error.set('');

    if (!this.name.trim()) {
      this.error.set('Team name is required');
      return;
    }

    const memberIds = Array.from(this.selectedMemberIds());

    this.submitting.set(true);
    this.teamsService.createTeam({
      name: this.name.trim(),
      ...(memberIds.length > 0 ? { memberIds } : {}),
    }).subscribe({
      next: () => {
        this.submitting.set(false);
        this.closeDialog();
        this.loadTeams();
      },
      error: (err) => {
        this.submitting.set(false);
        this.error.set(err.error?.error?.message || 'Failed to create team');
      },
    });
  }
}
