import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideFolderOpen, LucidePlus, LucideX, LucideRefreshCw } from '@lucide/angular';
import { HrProjectsService } from '../services/hr-projects.service';
import { HrTeamsService } from '../services/hr-teams.service';
import { HrProject, HrTeam, HrTeamMember } from '../models/hr.models';

@Component({
  selector: 'app-hr-projects',
  imports: [FormsModule, LucideFolderOpen, LucidePlus, LucideX, LucideRefreshCw],
  template: `
    <div class="page-container">
      <div class="page-header">
        <h2 class="page-heading">Projects</h2>
        <button class="btn btn-primary" type="button" (click)="openCreateDialog()">
          <svg lucidePlus class="icon-sm" aria-hidden="true"></svg>
          New Project
        </button>
      </div>

      @if (loading()) {
        <div class="card">
          <div class="sk-list-padded">
            @for (i of [1,2,3]; track i) {
              <div class="sk sk-row"></div>
            }
          </div>
        </div>
      } @else if (projects().length === 0) {
        <div class="empty-state">
          <svg lucideFolderOpen class="empty-icon"></svg>
          <p class="empty-title">No projects yet</p>
          <p class="empty-sub">Click "New Project" to create your first project.</p>
        </div>
      } @else {
        <div class="card">
          <div class="table-wrap">
            <table class="projects-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Description</th>
                  <th>Assignment</th>
                  <th>Assigned Users</th>
                  <th class="col-action">Actions</th>
                </tr>
              </thead>
              <tbody>
                @for (project of projects(); track project.id) {
                  <tr>
                    <td class="td-name">{{ project.name }}</td>
                    <td class="td-desc">{{ project.description }}</td>
                    <td>
                      @if (project.team) {
                        <span class="badge badge-team">{{ project.team.name }}</span>
                      } @else {
                        <span class="badge badge-individual">Individual</span>
                      }
                    </td>
                    <td class="td-users">
                      @for (user of project.users; track user.id; let last = $last) {
                        <span class="user-name">{{ user.fullName }}{{ last ? '' : ', ' }}</span>
                      }
                      @if (project.users.length === 0) {
                        <span class="text-muted">None</span>
                      }
                    </td>
                    <td class="col-action">
                      <button class="btn-icon" type="button" (click)="openEditDialog(project)" aria-label="Reassign project">
                        <svg lucideRefreshCw class="icon-xs" aria-hidden="true"></svg>
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }

      @if (dialogOpen()) {
        <div class="dialog-overlay" (click)="closeDialog()"></div>
        <div class="dialog" role="dialog" aria-modal="true" [attr.aria-label]="editingProject() ? 'Reassign Project' : 'New Project'">
          <div class="dialog-header">
            <h2 class="dialog-title">{{ editingProject() ? 'Reassign Project' : 'New Project' }}</h2>
            <button class="dialog-close" type="button" (click)="closeDialog()" aria-label="Close">
              <svg lucideX class="icon-sm" aria-hidden="true"></svg>
            </button>
          </div>
          <div class="dialog-body">
            <div class="form-group">
              <label class="form-label" for="proj-name">Name</label>
              <input class="form-input" id="proj-name" type="text" [(ngModel)]="projName" placeholder="Project name" [disabled]="!!editingProject()">
            </div>
            <div class="form-group">
              <label class="form-label" for="proj-desc">Description</label>
              <textarea class="form-input form-textarea" id="proj-desc" [(ngModel)]="projDescription" rows="3" placeholder="Short description" [disabled]="!!editingProject()"></textarea>
            </div>

            <div class="form-group">
              <label class="form-label">Assignment Type</label>
              <div class="segmented-control">
                <button
                  type="button"
                  class="segment"
                  [class.active]="assignmentType === 'team'"
                  (click)="assignmentType = 'team'"
                >Team</button>
                <button
                  type="button"
                  class="segment"
                  [class.active]="assignmentType === 'individual'"
                  (click)="assignmentType = 'individual'"
                >Individual</button>
              </div>
            </div>

            @if (assignmentType === 'team') {
              <div class="form-group">
                <label class="form-label">Team</label>
                @if (teams().length === 0) {
                  <p class="form-hint">No teams available</p>
                } @else {
                  <select class="form-input" [(ngModel)]="selectedTeamId">
                    <option [ngValue]="null">-- Select a team --</option>
                    @for (t of teams(); track t.id) {
                      <option [ngValue]="t.id">{{ t.name }}</option>
                    }
                  </select>
                }
              </div>
            } @else {
              <div class="form-group">
                <label class="form-label">Employees</label>
                @if (allMembers().length === 0) {
                  <p class="form-hint">No employees available</p>
                } @else {
                  <div class="member-list">
                    @for (emp of allMembers(); track emp.id) {
                      <label class="member-checkbox">
                        <input type="checkbox" [checked]="isEmpSelected(emp.id)" (change)="toggleEmp(emp.id)">
                        <span class="member-info">
                          <span class="avatar-xs">{{ emp.fullName.charAt(0) }}</span>
                          <span class="member-name">{{ emp.fullName }}</span>
                        </span>
                      </label>
                    }
                  </div>
                }
              </div>
            }

            @if (error()) {
              <p class="form-error">{{ error() }}</p>
            }
          </div>
          <div class="dialog-footer">
            <button class="btn btn-secondary" type="button" (click)="closeDialog()">Cancel</button>
            <button class="btn btn-primary" type="button" (click)="submitProject()" [disabled]="submitting()">
              {{ submitting() ? 'Saving...' : (editingProject() ? 'Reassign' : 'Create') }}
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

    .icon-sm { width: 16px; height: 16px; }
    .icon-xs { width: 12px; height: 12px; }

    .card {
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
    }

    .table-wrap { overflow-x: auto; }

    .projects-table {
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

    .td-name { font-weight: 600; white-space: nowrap; }
    .td-desc {
      max-width: 240px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: var(--rws-text-muted);
    }
    .td-users { white-space: nowrap; }
    .text-muted { color: var(--rws-text-muted); }
    .col-action { width: 48px; text-align: center; }

    .badge {
      display: inline-flex;
      align-items: center;
      padding: 0.25rem 0.625rem;
      border-radius: 999px;
      font-size: 0.75rem;
      font-weight: 600;
    }

    .badge-team { background: #e8f1fb; color: #1d5d90; }
    .badge-individual { background: #f3f4f6; color: var(--rws-text-muted); }

    .btn-icon {
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
      &:hover { background: var(--rws-bg); color: var(--rws-text); }
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
      width: 500px;
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
      &:disabled { opacity: 0.6; cursor: not-allowed; background: #f9fafb; }
    }

    .form-textarea { resize: vertical; min-height: 80px; }
    .form-error { margin: 0; font-size: 0.8125rem; color: var(--rws-error); }

    .segmented-control {
      display: flex;
      border: 1px solid var(--rws-border);
      border-radius: var(--rws-radius);
      overflow: hidden;
    }

    .segment {
      flex: 1;
      padding: 0.5rem 1rem;
      border: none;
      background: #fff;
      font-size: 0.875rem;
      font-weight: 500;
      font-family: inherit;
      color: var(--rws-text-muted);
      cursor: pointer;
      transition: background 150ms ease, color 150ms ease;

      &:hover { background: #f9fafb; }
      &.active { background: var(--rws-accent); color: var(--rws-primary); font-weight: 600; }
      & + & { border-left: 1px solid var(--rws-border); }
    }

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
export class HrProjectsComponent implements OnInit {
  private readonly projectsService = inject(HrProjectsService);
  private readonly teamsService = inject(HrTeamsService);

  protected readonly projects = signal<HrProject[]>([]);
  protected readonly loading = signal(true);

  protected readonly dialogOpen = signal(false);
  protected readonly editingProject = signal<HrProject | null>(null);
  protected projName = '';
  protected projDescription = '';
  protected assignmentType: 'team' | 'individual' = 'team';
  protected selectedTeamId: number | null = null;
  protected readonly selectedEmpIds = signal<Set<number>>(new Set());
  protected readonly teams = signal<HrTeam[]>([]);
  protected readonly allMembers = signal<HrTeamMember[]>([]);
  protected readonly submitting = signal(false);
  protected readonly error = signal('');

  ngOnInit(): void {
    this.loadProjects();
  }

  private loadProjects(): void {
    this.loading.set(true);
    this.projectsService.listAll().subscribe({
      next: (res) => {
        this.projects.set(res.projects);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  openCreateDialog(): void {
    this.editingProject.set(null);
    this.projName = '';
    this.projDescription = '';
    this.assignmentType = 'team';
    this.selectedTeamId = null;
    this.selectedEmpIds.set(new Set());
    this.error.set('');
    this.dialogOpen.set(true);
    this.loadDialogData();
  }

  openEditDialog(project: HrProject): void {
    this.editingProject.set(project);
    this.projName = project.name;
    this.projDescription = project.description;
    this.assignmentType = project.team ? 'team' : 'individual';
    this.selectedTeamId = project.team?.id ?? null;
    this.selectedEmpIds.set(new Set(project.users.map((u) => u.id)));
    this.error.set('');
    this.dialogOpen.set(true);
    this.loadDialogData();
  }

  private loadDialogData(): void {
    this.teamsService.getTeams().subscribe({
      next: (res) => this.teams.set(res.teams),
      error: () => this.teams.set([]),
    });

    this.teamsService.getAllMembers().subscribe({
      next: (res) => this.allMembers.set(res.members),
      error: () => this.allMembers.set([]),
    });
  }

  closeDialog(): void {
    this.dialogOpen.set(false);
  }

  isEmpSelected(id: number): boolean {
    return this.selectedEmpIds().has(id);
  }

  toggleEmp(id: number): void {
    this.selectedEmpIds.update((set) => {
      const next = new Set(set);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }

  submitProject(): void {
    this.error.set('');

    if (this.assignmentType === 'team' && !this.selectedTeamId) {
      this.error.set('Please select a team');
      return;
    }

    if (this.assignmentType === 'individual') {
      const ids = Array.from(this.selectedEmpIds());
      if (ids.length === 0) {
        this.error.set('Select at least one employee');
        return;
      }
    }

    this.submitting.set(true);
    const empIds = Array.from(this.selectedEmpIds());

    if (this.editingProject()) {
      this.projectsService.reassignProject(this.editingProject()!.id, {
        assignmentType: this.assignmentType,
        ...(this.assignmentType === 'team' ? { teamId: this.selectedTeamId! } : {}),
        ...(this.assignmentType === 'individual' ? { employeeIds: empIds } : {}),
      }).subscribe({
        next: () => {
          this.submitting.set(false);
          this.closeDialog();
          this.loadProjects();
        },
        error: (err) => {
          this.submitting.set(false);
          this.error.set(err.error?.error?.message || 'Failed to reassign project');
        },
      });
    } else {
      this.projectsService.createProject({
        name: this.projName.trim(),
        description: this.projDescription.trim() || undefined,
        assignmentType: this.assignmentType,
        ...(this.assignmentType === 'team' ? { teamId: this.selectedTeamId! } : {}),
        ...(this.assignmentType === 'individual' ? { employeeIds: empIds } : {}),
      }).subscribe({
        next: () => {
          this.submitting.set(false);
          this.closeDialog();
          this.loadProjects();
        },
        error: (err) => {
          this.submitting.set(false);
          this.error.set(err.error?.error?.message || 'Failed to create project');
        },
      });
    }
  }
}
