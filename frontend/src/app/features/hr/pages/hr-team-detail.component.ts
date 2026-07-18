import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TitleCasePipe } from '@angular/common';
import { LucideUsers, LucidePlus, LucideX, LucideArrowLeft } from '@lucide/angular';
import { HrTeamsService } from '../services/hr-teams.service';
import { HrTeamMember, HrUnassignedEmployee } from '../models/hr.models';

@Component({
  selector: 'app-hr-team-detail',
  imports: [FormsModule, RouterLink, TitleCasePipe, LucideUsers, LucidePlus, LucideX, LucideArrowLeft],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div class="header-left">
          <a routerLink="/hr/teams" class="back-link">
            <svg lucideArrowLeft class="icon-sm" aria-hidden="true"></svg>
          </a>
          <h2 class="page-heading">{{ team()?.name ?? 'Team' }}</h2>
        </div>
        <div class="header-actions">
          <button class="btn btn-primary" type="button" (click)="openAddMembersDialog()">
            <svg lucidePlus class="icon-sm" aria-hidden="true"></svg>
            Add Members
          </button>
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
      } @else if (members().length === 0) {
        <div class="empty-state">
          <svg lucideUsers class="empty-icon"></svg>
          <p class="empty-title">No members</p>
          <p class="empty-sub">Click "Add Members" to add employees to this team.</p>
        </div>
      } @else {
        <div class="card">
          <div class="table-wrap">
            <table class="members-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th class="col-action"></th>
                </tr>
              </thead>
              <tbody>
                @for (member of members(); track member.id) {
                  <tr>
                    <td>
                      <div class="name-cell">
                        <div class="avatar-sm">{{ member.fullName.charAt(0) }}</div>
                        <span>{{ member.fullName }}</span>
                      </div>
                    </td>
                    <td class="email-cell">{{ member.email }}</td>
                    <td>
                      <span class="status-badge" [class]="'status-' + member.status">
                        <span class="status-dot-sm"></span>
                        {{ member.status === 'clocked_out' ? 'Offline' : (member.status | titlecase) }}
                      </span>
                    </td>
                    <td class="col-action">
                      <button class="btn-remove" type="button" (click)="removeMember(member.id)" aria-label="Remove member">
                        <svg lucideX class="icon-xs" aria-hidden="true"></svg>
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }

      @if (addMembersDialogOpen()) {
        <div class="dialog-overlay" (click)="closeAddMembersDialog()"></div>
        <div class="dialog" role="dialog" aria-modal="true" aria-label="Add Members">
          <div class="dialog-header">
            <h2 class="dialog-title">Add Members</h2>
            <button class="dialog-close" type="button" (click)="closeAddMembersDialog()" aria-label="Close">
              <svg lucideX class="icon-sm" aria-hidden="true"></svg>
            </button>
          </div>
          <div class="dialog-body">
            @if (unassignedEmployees().length === 0) {
              <p class="form-hint">No unassigned employees available</p>
            } @else {
              <div class="member-list">
                @for (emp of unassignedEmployees(); track emp.id) {
                  <label class="member-checkbox">
                    <input type="checkbox" [checked]="isAddSelected(emp.id)" (change)="toggleAddMember(emp.id)">
                    <span class="member-info">
                      <span class="avatar-xs">{{ emp.fullName.charAt(0) }}</span>
                      <span class="member-name">{{ emp.fullName }}</span>
                    </span>
                  </label>
                }
              </div>
            }
            @if (addError()) {
              <p class="form-error">{{ addError() }}</p>
            }
          </div>
          <div class="dialog-footer">
            <button class="btn btn-secondary" type="button" (click)="closeAddMembersDialog()">Cancel</button>
            <button class="btn btn-primary" type="button" (click)="submitAddMembers()" [disabled]="addSubmitting()">
              {{ addSubmitting() ? 'Adding...' : 'Add Selected' }}
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
      flex-wrap: wrap;
      gap: 1rem;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .back-link {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: var(--rws-radius);
      color: var(--rws-text-muted);
      text-decoration: none;
      transition: background 150ms ease, color 150ms ease;
      &:hover { background: var(--rws-bg); color: var(--rws-text); }
    }

    .page-heading { margin: 0; font-size: 1.375rem; font-weight: 700; color: var(--rws-text); }

    .header-actions {
      display: flex;
      gap: 0.5rem;
    }

    .icon-sm { width: 16px; height: 16px; }
    .icon-xs { width: 12px; height: 12px; }

    .card {
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
    }

    .table-wrap { overflow-x: auto; }

    .members-table {
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
    }

    .name-cell {
      display: flex;
      align-items: center;
      gap: 0.625rem;
    }

    .avatar-sm {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--rws-primary), var(--rws-accent));
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.75rem;
      font-weight: 700;
      color: #fff;
      flex-shrink: 0;
    }

    .email-cell { color: var(--rws-text-muted); }

    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.25rem 0.625rem;
      border-radius: 999px;
      font-size: 0.75rem;
      font-weight: 600;
      white-space: nowrap;
    }

    .status-active { background: #e8f8f6; color: #167d72; }
    .status-break { background: #fef3e2; color: #92610a; }
    .status-clocked_out { background: var(--rws-bg); color: var(--rws-text-muted); }

    .status-dot-sm {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      .status-active & { background: #1fb6a6; }
      .status-break & { background: #d9973b; }
      .status-clocked_out & { background: #9ca3af; }
    }

    .col-action { width: 48px; text-align: center; }

    .btn-remove {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border: none;
      border-radius: var(--rws-radius);
      background: transparent;
      color: var(--rws-text-muted);
      cursor: pointer;
      transition: background 150ms ease, color 150ms ease;
      &:hover { background: #fde8e8; color: #b91c1c; }
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

    .form-hint { margin: 0; font-size: 0.8125rem; color: var(--rws-text-muted); font-style: italic; }
    .form-error { margin: 0; font-size: 0.8125rem; color: var(--rws-error); }

    .member-list {
      max-height: 240px;
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

    @media (max-width: 767px) {
      .page-header { flex-direction: column; align-items: flex-start; }
      .header-actions { width: 100%; }
    }

    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
    }
  `],
})
export class HrTeamDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly teamsService = inject(HrTeamsService);

  protected readonly team = signal<{ id: number; name: string } | null>(null);
  protected readonly members = signal<HrTeamMember[]>([]);
  protected readonly loading = signal(true);

  protected readonly addMembersDialogOpen = signal(false);
  protected readonly unassignedEmployees = signal<HrUnassignedEmployee[]>([]);
  protected readonly addSelectedMemberIds = signal<Set<number>>(new Set());
  protected readonly addSubmitting = signal(false);
  protected readonly addError = signal('');

  private teamId = 0;

  ngOnInit(): void {
    this.teamId = Number(this.route.snapshot.paramMap.get('teamId'));
    this.loadTeamData();
  }

  private loadTeamData(): void {
    this.loading.set(true);
    this.teamsService.getTeams().subscribe({
      next: (res) => {
        const found = res.teams.find((t) => t.id === this.teamId);
        if (found) {
          this.team.set({ id: found.id, name: found.name });
        }
      },
    });

    this.teamsService.getTeamMembers(this.teamId).subscribe({
      next: (res) => {
        this.members.set(res.members);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  openAddMembersDialog(): void {
    this.addSelectedMemberIds.set(new Set());
    this.addError.set('');
    this.addMembersDialogOpen.set(true);

    this.teamsService.getUnassignedEmployees().subscribe({
      next: (res) => this.unassignedEmployees.set(res.employees),
      error: () => this.unassignedEmployees.set([]),
    });
  }

  closeAddMembersDialog(): void {
    this.addMembersDialogOpen.set(false);
  }

  isAddSelected(id: number): boolean {
    return this.addSelectedMemberIds().has(id);
  }

  toggleAddMember(id: number): void {
    this.addSelectedMemberIds.update((set) => {
      const next = new Set(set);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }

  submitAddMembers(): void {
    this.addError.set('');
    const ids = Array.from(this.addSelectedMemberIds());
    if (ids.length === 0) {
      this.addError.set('Select at least one employee');
      return;
    }

    this.addSubmitting.set(true);
    this.teamsService.updateTeamMembers(this.teamId, { addMemberIds: ids }).subscribe({
      next: () => {
        this.addSubmitting.set(false);
        this.closeAddMembersDialog();
        this.loadTeamData();
      },
      error: (err) => {
        this.addSubmitting.set(false);
        this.addError.set(err.error?.error?.message || 'Failed to add members');
      },
    });
  }

  removeMember(memberId: number): void {
    this.teamsService.updateTeamMembers(this.teamId, { removeMemberIds: [memberId] }).subscribe({
      next: () => this.loadTeamData(),
    });
  }
}
