import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import {
  LucideFolderOpen, LucidePlus, LucideX, LucideRefreshCw,
  LucideArrowRight, LucideCalendar, LucideClock, LucideUsers,
} from '@lucide/angular';
import { HrProjectsService } from '../services/hr-projects.service';
import { HrTeamsService } from '../services/hr-teams.service';
import { HrProject, HrTeam, HrTeamMember } from '../models/hr.models';

type DialogMode = 'create' | 'edit' | 'reassign' | null;

@Component({
  selector: 'app-hr-projects',
  imports: [
    RouterLink, FormsModule, DatePipe,
    LucideFolderOpen, LucidePlus, LucideX, LucideRefreshCw,
    LucideArrowRight, LucideCalendar, LucideClock, LucideUsers,
  ],
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
        <!-- Filters -->
        <div class="filters">
          <select class="filter-select" [(ngModel)]="statusFilter" (ngModelChange)="applyFilter()">
            <option value="">All Statuses</option>
            <option value="planning">Planning</option>
            <option value="active">Active</option>
            <option value="on_hold">On Hold</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="archived">Archived</option>
          </select>
          <select class="filter-select" [(ngModel)]="priorityFilter" (ngModelChange)="applyFilter()">
            <option value="">All Priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
          <input class="filter-input" type="text" [(ngModel)]="searchQuery" (ngModelChange)="applyFilter()" placeholder="Search name or client...">
        </div>

        <!-- Project Stats Bar -->
        @if (statsBar().length > 0) {
          <div class="stats-bar">
            @for (stat of statsBar(); track stat.label) {
              <div class="stat-chip">
                <span class="stat-chip-value">{{ stat.count }}</span>
                <span class="stat-chip-label">{{ stat.label }}</span>
              </div>
            }
          </div>
        }

        <!-- Project Grid -->
        <div class="project-grid">
          @for (project of filteredProjects(); track project.id) {
            <div class="project-card" [style.--card-color]="project.color || '#0b4a5a'">
              <div class="card-header-row">
                <span class="card-status" [class]="'st-' + project.status">
                  {{ statusLabel(project.status) }}
                </span>
                <span class="card-priority" [class]="'prio-' + (project.priority || 'medium')">
                  {{ project.priority || 'medium' }}
                </span>
              </div>

              <h3 class="card-name">{{ project.name }}</h3>

              @if (project.client) {
                <p class="card-client">{{ project.client }}</p>
              }
              @if (project.description) {
                <p class="card-desc">{{ project.description }}</p>
              }

              <div class="card-meta">
                @if (project.expectedStart) {
                  <span class="meta-item">
                    <svg lucideCalendar class="icon-xs" aria-hidden="true"></svg>
                    {{ project.expectedStart | date:'shortDate' }}
                    @if (project.expectedEnd) {
                      <span> – {{ project.expectedEnd | date:'shortDate' }}</span>
                    }
                  </span>
                }
                <span class="meta-item">
                  <svg lucideClock class="icon-xs" aria-hidden="true"></svg>
                  {{ project.totalHours ?? 0 }}h total
                </span>
              </div>

              <div class="card-footer">
                <div class="footer-left">
                  @if (project.team) {
                    <span class="badge badge-team">{{ project.team.name }}</span>
                  } @else {
                    <span class="badge badge-individual">Individual</span>
                  }
                  <span class="user-count">
                    <svg lucideUsers class="icon-xs" aria-hidden="true"></svg>
                    {{ project.users.length }}
                  </span>
                </div>
                <div class="footer-right">
                  <button class="btn-icon" type="button" (click)="openEditDialog(project)" title="Edit project">
                    <svg lucideRefreshCw class="icon-xs" aria-hidden="true"></svg>
                  </button>
                  <a class="btn-icon" [routerLink]="['/hr/projects', project.id]" title="View details">
                    <svg lucideArrowRight class="icon-xs" aria-hidden="true"></svg>
                  </a>
                </div>
              </div>
            </div>
          }
        </div>
      }

      <!-- Dialog (create / edit / reassign) -->
      @if (dialogMode()) {
        <div class="dialog-overlay" (click)="closeDialog()"></div>
        <div class="dialog" role="dialog" aria-modal="true" [attr.aria-label]="dialogTitle()">
          <div class="dialog-header">
            <h2 class="dialog-title">{{ dialogTitle() }}</h2>
            <button class="dialog-close" type="button" (click)="closeDialog()" aria-label="Close">
              <svg lucideX class="icon-sm" aria-hidden="true"></svg>
            </button>
          </div>
          <div class="dialog-body">
            <!-- Name -->
            <div class="form-group">
              <label class="form-label" for="proj-name">Name *</label>
              <input class="form-input" id="proj-name" type="text" [(ngModel)]="projName" placeholder="Project name" [disabled]="dialogMode() === 'reassign'">
            </div>

            <!-- Description -->
            <div class="form-group">
              <label class="form-label" for="proj-desc">Description</label>
              <textarea class="form-input form-textarea" id="proj-desc" [(ngModel)]="projDescription" rows="2" placeholder="Short description" [disabled]="dialogMode() === 'reassign'"></textarea>
            </div>

            @if (dialogMode() !== 'reassign') {
              <!-- Status -->
              <div class="form-group">
                <label class="form-label">Status</label>
                <select class="form-input" [(ngModel)]="projStatus">
                  <option value="planning">Planning</option>
                  <option value="active">Active</option>
                  <option value="on_hold">On Hold</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              <!-- Priority -->
              <div class="form-group">
                <label class="form-label">Priority</label>
                <select class="form-input" [(ngModel)]="projPriority">
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>

              <!-- Client -->
              <div class="form-group">
                <label class="form-label" for="proj-client">Client</label>
                <input class="form-input" id="proj-client" type="text" [(ngModel)]="projClient" placeholder="Client name">
              </div>

              <!-- Expected Dates -->
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label" for="proj-start">Expected Start</label>
                  <input class="form-input" id="proj-start" type="date" [(ngModel)]="projExpectedStart">
                </div>
                <div class="form-group">
                  <label class="form-label" for="proj-end">Expected End</label>
                  <input class="form-input" id="proj-end" type="date" [(ngModel)]="projExpectedEnd">
                </div>
              </div>

              <!-- Estimated Hours -->
              <div class="form-group">
                <label class="form-label" for="proj-hours">Estimated Hours</label>
                <input class="form-input" id="proj-hours" type="number" [(ngModel)]="projEstimatedHours" min="0" step="1">
              </div>

              <!-- Color -->
              <div class="form-group">
                <label class="form-label" for="proj-color">Accent Color</label>
                <div class="color-picker-row">
                  <input class="form-input form-color" id="proj-color" type="color" [(ngModel)]="projColor">
                  <span class="color-value">{{ projColor }}</span>
                </div>
              </div>

            }

            <!-- Assignment (create / reassign) -->
            @if (dialogMode() !== 'edit') {
              <div class="form-group">
                <label class="form-label">Assignment Type</label>
                <div class="segmented-control">
                  <button type="button" class="segment" [class.active]="assignmentType === 'team'" (click)="assignmentType = 'team'">Team</button>
                  <button type="button" class="segment" [class.active]="assignmentType === 'individual'" (click)="assignmentType = 'individual'">Individual</button>
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
            }

            @if (error()) {
              <p class="form-error">{{ error() }}</p>
            }
          </div>
          <div class="dialog-footer">
            <button class="btn btn-secondary" type="button" (click)="closeDialog()">Cancel</button>
            <button class="btn btn-primary" type="button" (click)="submitProject()" [disabled]="submitting()">
              {{ submitting() ? 'Saving...' : dialogSubmitLabel() }}
            </button>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    @use 'styles/design-tokens' as t;

    .page-container { width: 100%; }
    .page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; }
    .page-heading { margin: 0; font-size: 1.375rem; font-weight: 700; color: var(--rws-text); }

    .icon-sm { width: 16px; height: 16px; }
    .icon-xs { width: 14px; height: 14px; }

    .card { background: #fff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); padding: 1.25rem; }

    /* ── Filters ──────────────────────────────────────── */
    .filters {
      display: flex;
      gap: 0.75rem;
      margin-bottom: 1rem;
      flex-wrap: wrap;
    }
    .filter-select, .filter-input {
      padding: 0.5rem 0.75rem;
      border: 1px solid var(--rws-border);
      border-radius: var(--rws-radius);
      font-size: 0.875rem;
      font-family: inherit;
      color: var(--rws-text);
      background: #fff;
    }
    .filter-select { min-width: 140px; }
    .filter-input { flex: 1; min-width: 200px; }

    /* ── Stats Bar ─────────────────────────────────────── */
    .stats-bar {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 1rem;
      flex-wrap: wrap;
    }
    .stat-chip {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.375rem 0.75rem;
      background: var(--rws-bg);
      border-radius: 999px;
      font-size: 0.8125rem;
    }
    .stat-chip-value { font-weight: 700; color: var(--rws-text); font-family: var(--rws-font-mono); }
    .stat-chip-label { color: var(--rws-text-muted); }

    /* ── Project Grid ──────────────────────────────────── */
    .project-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
      gap: 1rem;
    }

    .project-card {
      background: #fff;
      border-radius: 12px;
      padding: 1.25rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
      border-left: 3px solid var(--card-color, var(--rws-accent));
      transition: transform 150ms ease, box-shadow 150ms ease;
      &:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
    }

    .card-header-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 0.75rem;
    }

    .card-status {
      font-size: 0.6875rem;
      font-weight: 600;
      padding: 0.1875rem 0.5rem;
      border-radius: 999px;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      &.st-planning { background: #f3f4f6; color: #6b7280; }
      &.st-active { background: #e8f8f6; color: #167d72; }
      &.st-on_hold { background: #fef3e2; color: #92610a; }
      &.st-completed { background: #e8f1fb; color: #2b3a67; }
      &.st-cancelled { background: #fde8e8; color: #b91c1c; }
      &.st-archived { background: #f3f4f6; color: #6b7280; }
    }

    .card-priority {
      font-size: 0.6875rem;
      font-weight: 600;
      padding: 0.125rem 0.5rem;
      border-radius: 999px;
      text-transform: uppercase;
      &.prio-low { background: #f3f4f6; color: #6b7280; }
      &.prio-medium { background: #e8f1fb; color: #2b3a67; }
      &.prio-high { background: #fef3e2; color: #92610a; }
      &.prio-critical { background: #fde8e8; color: #b91c1c; }
    }

    .card-name { margin: 0 0 0.25rem; font-size: 1.0625rem; font-weight: 600; color: var(--rws-text); }
    .card-client { margin: 0 0 0.25rem; font-size: 0.8125rem; color: var(--rws-accent-strong); font-weight: 500; }
    .card-desc { margin: 0 0 0.75rem; font-size: 0.8125rem; color: var(--rws-text-muted); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

    .card-meta {
      display: flex;
      gap: 1rem;
      margin-bottom: 1rem;
      flex-wrap: wrap;
    }
    .meta-item {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      font-size: 0.8125rem;
      color: var(--rws-text-muted);
    }

    .card-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-top: 0.75rem;
      border-top: 1px solid var(--rws-border);
    }
    .footer-left { display: flex; align-items: center; gap: 0.5rem; }
    .footer-right { display: flex; align-items: center; gap: 0.25rem; }

    .badge {
      padding: 0.25rem 0.5rem;
      border-radius: 999px;
      font-size: 0.6875rem;
      font-weight: 600;
    }
    .badge-team { background: #e8f1fb; color: #1d5d90; }
    .badge-individual { background: #f3f4f6; color: var(--rws-text-muted); }

    .user-count {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      font-size: 0.75rem;
      color: var(--rws-text-muted);
    }

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
      text-decoration: none;
      &:hover { background: var(--rws-bg); color: var(--rws-text); }
    }

    /* ── Empty State ───────────────────────────────────── */
    .empty-state { display: flex; flex-direction: column; align-items: center; padding: 4rem 0; text-align: center; }
    .empty-icon { width: 48px; height: 48px; color: var(--rws-text-muted); opacity: 0.4; margin-bottom: 1rem; }
    .empty-title { margin: 0 0 0.375rem; font-size: 1.125rem; font-weight: 600; color: var(--rws-text); }
    .empty-sub { margin: 0; font-size: 0.875rem; color: var(--rws-text-muted); }

    /* ── Dialog ─────────────────────────────────────────── */
    .dialog-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 90; animation: fade-in 150ms ease; }
    .dialog {
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      width: 520px; max-width: calc(100vw - 2rem); max-height: calc(100vh - 4rem);
      background: #fff; border-radius: 12px; box-shadow: 0 20px 60px rgba(0,0,0,0.2);
      z-index: 91; display: flex; flex-direction: column; animation: dialog-in 200ms ease;
    }
    .dialog-header { display: flex; align-items: center; justify-content: space-between; padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--rws-border); }
    .dialog-title { margin: 0; font-size: 1.0625rem; font-weight: 600; color: var(--rws-text); }
    .dialog-close { display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; border: none; border-radius: var(--rws-radius); background: transparent; color: var(--rws-text-muted); cursor: pointer; &:hover { background: var(--rws-bg); color: var(--rws-text); } }
    .dialog-body { padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; overflow-y: auto; }
    .dialog-footer { display: flex; justify-content: flex-end; gap: 0.75rem; padding: 1rem 1.5rem; border-top: 1px solid var(--rws-border); }

    .form-group { display: flex; flex-direction: column; gap: 0.375rem; }
    .form-label { font-size: 0.8125rem; font-weight: 600; color: var(--rws-text); }
    .form-hint { margin: 0; font-size: 0.8125rem; color: var(--rws-text-muted); font-style: italic; }
    .form-input { padding: 0.5rem 0.75rem; border: 1px solid var(--rws-border); border-radius: var(--rws-radius); font-size: 0.9rem; font-family: inherit; color: var(--rws-text); background: #fff; transition: border-color 150ms ease; &:focus { outline: none; border-color: var(--rws-accent); box-shadow: 0 0 0 2px rgba(31,182,166,0.15); } &:disabled { opacity: 0.6; cursor: not-allowed; background: #f9fafb; } }
    .form-textarea { resize: vertical; min-height: 60px; }
    .form-error { margin: 0; font-size: 0.8125rem; color: var(--rws-error); }
    .form-row { display: flex; gap: 0.75rem; & > .form-group { flex: 1; } }

    .color-picker-row { display: flex; align-items: center; gap: 0.625rem; }
    .form-color { width: 48px; height: 36px; padding: 2px; cursor: pointer; }
    .color-value { font-size: 0.8125rem; color: var(--rws-text-muted); font-family: var(--rws-font-mono); }

    .segmented-control { display: flex; border: 1px solid var(--rws-border); border-radius: var(--rws-radius); overflow: hidden; }
    .segment { flex: 1; padding: 0.5rem 1rem; border: none; background: #fff; font-size: 0.875rem; font-weight: 500; font-family: inherit; color: var(--rws-text-muted); cursor: pointer; transition: background 150ms ease, color 150ms ease; &:hover { background: #f9fafb; } &.active { background: var(--rws-accent); color: var(--rws-primary); font-weight: 600; } & + & { border-left: 1px solid var(--rws-border); } }

    .member-list { max-height: 180px; overflow-y: auto; border: 1px solid var(--rws-border); border-radius: var(--rws-radius); }
    .member-checkbox { display: flex; align-items: center; gap: 0.625rem; padding: 0.5rem 0.75rem; cursor: pointer; transition: background 150ms ease; &:hover { background: #fafbfc; } & + & { border-top: 1px solid var(--rws-border); } }
    .member-info { display: flex; align-items: center; gap: 0.5rem; flex: 1; min-width: 0; }
    .avatar-xs { width: 24px; height: 24px; border-radius: 50%; background: linear-gradient(135deg, var(--rws-primary), var(--rws-accent)); display: flex; align-items: center; justify-content: center; font-size: 0.625rem; font-weight: 700; color: #fff; flex-shrink: 0; }
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
      .project-grid { grid-template-columns: 1fr; }
      .filters { flex-direction: column; }
      .filter-input { min-width: 0; }
    }
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
    }
  `],
})
export class HrProjectsComponent implements OnInit {
  private readonly projectsService = inject(HrProjectsService);
  private readonly teamsService = inject(HrTeamsService);

  protected readonly projects = signal<HrProject[]>([]);
  protected readonly filteredProjects = signal<HrProject[]>([]);
  protected readonly loading = signal(true);

  // Filters
  protected statusFilter = '';
  protected priorityFilter = '';
  protected searchQuery = '';

  // Dialog
  protected readonly dialogMode = signal<DialogMode>(null);
  protected readonly editingProject = signal<HrProject | null>(null);
  protected projName = '';
  protected projDescription = '';
  protected projStatus = 'active';
  protected projPriority = 'medium';
  protected projClient = '';
  protected projExpectedStart = '';
  protected projExpectedEnd = '';
  protected projEstimatedHours: number | null = null;
  protected projColor = '#0b4a5a';

  protected assignmentType: 'team' | 'individual' = 'team';
  protected selectedTeamId: number | null = null;
  protected readonly selectedEmpIds = signal<Set<number>>(new Set());
  protected readonly teams = signal<HrTeam[]>([]);
  protected readonly allMembers = signal<HrTeamMember[]>([]);
  protected readonly submitting = signal(false);
  protected readonly error = signal('');

  protected readonly dialogTitle = () => {
    switch (this.dialogMode()) {
      case 'create': return 'New Project';
      case 'edit': return 'Edit Project';
      case 'reassign': return 'Reassign Project';
      default: return '';
    }
  };

  protected readonly dialogSubmitLabel = () => {
    switch (this.dialogMode()) {
      case 'create': return 'Create';
      case 'edit': return 'Save Changes';
      case 'reassign': return 'Reassign';
      default: return 'Save';
    }
  };

  protected readonly statsBar = () => {
    const p = this.filteredProjects();
    if (p.length === 0) return [];
    const total = p.length;
    const active = p.filter((pr) => pr.status === 'active').length;
    const highPrio = p.filter((pr) => pr.priority === 'high' || pr.priority === 'critical').length;
    return [
      { count: total, label: 'Total' },
      { count: active, label: 'Active' },
      { count: highPrio, label: 'High Priority' },
    ];
  };

  ngOnInit(): void {
    this.loadProjects();
  }

  private loadProjects(): void {
    this.loading.set(true);
    this.projectsService.listAll().subscribe({
      next: (res) => {
        this.projects.set(res.projects);
        this.applyFilter();
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  applyFilter(): void {
    let list = this.projects();
    if (this.statusFilter) {
      list = list.filter((p) => p.status === this.statusFilter);
    }
    if (this.priorityFilter) {
      list = list.filter((p) => p.priority === this.priorityFilter);
    }
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      list = list.filter((p) =>
        p.name.toLowerCase().includes(q) ||
        (p.client && p.client.toLowerCase().includes(q))
      );
    }
    this.filteredProjects.set(list);
  }

  protected statusLabel(status: string): string {
    const labels: Record<string, string> = {
      planning: 'Planning',
      active: 'Active',
      on_hold: 'On Hold',
      completed: 'Completed',
      cancelled: 'Cancelled',
      archived: 'Archived',
    };
    return labels[status] || status;
  }

  openCreateDialog(): void {
    this.resetForm();
    this.dialogMode.set('create');
    this.loadDialogData();
  }

  openEditDialog(project: HrProject): void {
    this.editingProject.set(project);
    this.projName = project.name;
    this.projDescription = project.description || '';
    this.projStatus = project.status;
    this.projPriority = project.priority || 'medium';
    this.projClient = project.client || '';
    this.projExpectedStart = project.expectedStart || '';
    this.projExpectedEnd = project.expectedEnd || '';
    this.projEstimatedHours = project.estimatedHours || null;
    this.projColor = project.color || '#0b4a5a';
    this.error.set('');
    this.dialogMode.set('edit');
    this.loadDialogData();
  }

  openReassignDialog(project: HrProject): void {
    this.editingProject.set(project);
    this.assignmentType = project.team ? 'team' : 'individual';
    this.selectedTeamId = project.team?.id ?? null;
    this.selectedEmpIds.set(new Set(project.users.map((u) => u.id)));
    this.error.set('');
    this.dialogMode.set('reassign');
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

  private resetForm(): void {
    this.editingProject.set(null);
    this.projName = '';
    this.projDescription = '';
    this.projStatus = 'active';
    this.projPriority = 'medium';
    this.projClient = '';
    this.projExpectedStart = '';
    this.projExpectedEnd = '';
    this.projEstimatedHours = null;
    this.projColor = '#0b4a5a';
    this.assignmentType = 'team';
    this.selectedTeamId = null;
    this.selectedEmpIds.set(new Set());
    this.error.set('');
  }

  closeDialog(): void {
    this.dialogMode.set(null);
    this.editingProject.set(null);
  }

  isEmpSelected(id: number): boolean {
    return this.selectedEmpIds().has(id);
  }

  toggleEmp(id: number): void {
    this.selectedEmpIds.update((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  submitProject(): void {
    this.error.set('');

    if (this.dialogMode() === 'create' || this.dialogMode() === 'reassign') {
      if (this.assignmentType === 'team' && !this.selectedTeamId) {
        this.error.set('Please select a team');
        return;
      }
      if (this.assignmentType === 'individual' && this.selectedEmpIds().size === 0) {
        this.error.set('Select at least one employee');
        return;
      }
    }

    if (this.dialogMode() === 'create' && !this.projName.trim()) {
      this.error.set('Project name is required');
      return;
    }

    const empIds = Array.from(this.selectedEmpIds());
    this.submitting.set(true);

    const mode = this.dialogMode();

    if (mode === 'edit' && this.editingProject()) {
      this.projectsService.updateProject(this.editingProject()!.id, {
        name: this.projName.trim(),
        description: this.projDescription.trim() || undefined,
        status: this.projStatus,
        priority: this.projPriority,
        client: this.projClient.trim() || undefined,
        expectedStart: this.projExpectedStart || undefined,
        expectedEnd: this.projExpectedEnd || undefined,
        estimatedHours: this.projEstimatedHours ?? undefined,
        color: this.projColor,
      }).subscribe({
        next: () => {
          this.submitting.set(false);
          this.closeDialog();
          this.loadProjects();
        },
        error: (err) => {
          this.submitting.set(false);
          this.error.set(err.error?.error?.message || 'Failed to update project');
        },
      });
    } else if (mode === 'create') {
      this.projectsService.createProject({
        name: this.projName.trim(),
        description: this.projDescription.trim() || undefined,
        status: this.projStatus,
        priority: this.projPriority,
        client: this.projClient.trim() || undefined,
        expectedStart: this.projExpectedStart || undefined,
        expectedEnd: this.projExpectedEnd || undefined,
        estimatedHours: this.projEstimatedHours ?? undefined,
        color: this.projColor,
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
    } else if (mode === 'reassign' && this.editingProject()) {
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
      this.submitting.set(false);
    }
  }
}
