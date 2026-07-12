import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideFolderOpen, LucidePlus, LucideX } from '@lucide/angular';
import { ProjectsService } from '../services/projects.service';
import { Project } from '../models/employee.models';

@Component({
  selector: 'app-employee-projects',
  imports: [FormsModule, LucideFolderOpen, LucidePlus, LucideX],
  template: `
    <div class="page-container">
      <div class="page-header">
        <h1 class="page-title">My Projects</h1>
      </div>

      @if (loading()) {
        <div class="loading-state">
          @for (i of [1,2,3]; track i) {
            <div class="skeleton-row"></div>
          }
        </div>
      } @else if (projects().length === 0) {
        <div class="empty-state">
          <svg lucideFolderOpen class="empty-icon" aria-hidden="true"></svg>
          <p class="empty-text">No projects assigned</p>
          <p class="empty-sub">Contact your manager to get assigned to a project.</p>
        </div>
      } @else {
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th class="th-project">Project</th>
                <th class="th-hours">This Week</th>
                <th class="th-hours">Total</th>
                <th class="th-actions"></th>
              </tr>
            </thead>
            <tbody>
              @for (project of projects(); track project.id) {
                <tr>
                  <td class="td-project">
                    <span class="project-name">{{ project.name }}</span>
                    @if (project.description) {
                      <span class="project-desc">{{ project.description }}</span>
                    }
                  </td>
                  <td class="td-hours">{{ project.hoursThisWeek }}h</td>
                  <td class="td-hours">{{ project.hoursTotal }}h</td>
                  <td class="td-actions">
                    <button class="btn-log" type="button" (click)="openLogDialog(project)">
                      <svg lucidePlus class="icon-sm" aria-hidden="true"></svg>
                      Log Time
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      @if (logDialogOpen()) {
        <div class="dialog-overlay" (click)="closeLogDialog()"></div>
        <div class="dialog" role="dialog" aria-modal="true" aria-label="Log Time">
          <div class="dialog-header">
            <h2 class="dialog-title">Log Time — {{ selectedProject()?.name }}</h2>
            <button class="dialog-close" type="button" (click)="closeLogDialog()" aria-label="Close">
              <svg lucideX class="icon-sm" aria-hidden="true"></svg>
            </button>
          </div>
          <div class="dialog-body">
            <div class="form-group">
              <label class="form-label" for="log-date">Date</label>
              <input class="form-input" id="log-date" type="date" [(ngModel)]="logDate" [max]="todayStr">
            </div>
            <div class="form-group">
              <label class="form-label" for="log-hours">Hours</label>
              <input class="form-input" id="log-hours" type="number" [(ngModel)]="logHours" min="0.25" max="24" step="0.25">
            </div>
            <div class="form-group">
              <label class="form-label" for="log-desc">Description (optional)</label>
              <textarea class="form-input form-textarea" id="log-desc" [(ngModel)]="logDescription" rows="3" placeholder="What did you work on?"></textarea>
            </div>
            @if (logError()) {
              <p class="form-error">{{ logError() }}</p>
            }
          </div>
          <div class="dialog-footer">
            <button class="btn btn-secondary" type="button" (click)="closeLogDialog()">Cancel</button>
            <button class="btn btn-primary" type="button" (click)="submitLogTime()" [disabled]="logSubmitting()">
              {{ logSubmitting() ? 'Saving...' : 'Save Entry' }}
            </button>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    @use 'styles/design-tokens' as t;

    .page-container { max-width: 960px; }

    .page-header {
      margin-bottom: 1.5rem;
    }

    .page-title {
      margin: 0;
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--rws-text);
    }

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

    .loading-state {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

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

    .data-table {
      width: 100%;
      border-collapse: collapse;
    }

    th, td {
      text-align: left;
      padding: 0.875rem 1.25rem;
    }

    thead tr {
      border-bottom: 1px solid var(--rws-border);
      background: var(--rws-bg);
    }

    th {
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--rws-text-muted);
    }

    .th-hours { text-align: right; width: 100px; }
    .th-actions { width: 120px; }

    tbody tr {
      border-bottom: 1px solid var(--rws-border);
      transition: background 150ms ease;

      &:last-child { border-bottom: none; }
      &:hover { background: #fafbfc; }
    }

    .td-project {
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
    }

    .project-name {
      font-weight: 600;
      color: var(--rws-text);
      font-size: 0.9375rem;
    }

    .project-desc {
      font-size: 0.8125rem;
      color: var(--rws-text-muted);
      max-width: 360px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .td-hours {
      text-align: right;
      font-family: var(--rws-font-mono);
      font-weight: 500;
      color: var(--rws-text);
      font-size: 0.9375rem;
    }

    .td-actions { text-align: right; }

    .btn-log {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.375rem 0.75rem;
      border: 1px solid var(--rws-border);
      border-radius: var(--rws-radius);
      background: #fff;
      color: var(--rws-text);
      font-size: 0.8125rem;
      font-weight: 500;
      cursor: pointer;
      font-family: inherit;
      transition: border-color 150ms ease, color 150ms ease;

      &:hover { border-color: var(--rws-accent); color: var(--rws-accent); }
      &:focus-visible { outline: 3px solid var(--rws-focus-ring); outline-offset: 2px; }
    }

    .icon-sm { width: 14px; height: 14px; }

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

    .dialog-title {
      margin: 0;
      font-size: 1.0625rem;
      font-weight: 600;
      color: var(--rws-text);
    }

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

    .dialog-body {
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
      overflow-y: auto;
    }

    .dialog-footer {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
      padding: 1rem 1.5rem;
      border-top: 1px solid var(--rws-border);
    }

    // ── Form ───────────────────────────────────────────────────
    .form-group { display: flex; flex-direction: column; gap: 0.375rem; }

    .form-label {
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--rws-text);
    }

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

    .form-error {
      margin: 0;
      font-size: 0.8125rem;
      color: var(--rws-error);
    }

    // ── Buttons ────────────────────────────────────────────────
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
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
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        transition-duration: 0.01ms !important;
      }
    }
  `],
})
export class EmployeeProjectsComponent implements OnInit {
  private readonly projectsService = inject(ProjectsService);

  protected readonly projects = signal<Project[]>([]);
  protected readonly loading = signal(true);

  protected readonly logDialogOpen = signal(false);
  protected readonly selectedProject = signal<Project | null>(null);
  protected logDate = '';
  protected logHours = 1;
  protected logDescription = '';
  protected readonly logSubmitting = signal(false);
  protected readonly logError = signal('');
  protected readonly todayStr = this._todayStr();

  ngOnInit(): void {
    this.loadProjects();
  }

  private loadProjects(): void {
    this.loading.set(true);
    this.projectsService.getMyProjects().subscribe({
      next: (res) => {
        this.projects.set(res.projects);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  openLogDialog(project: Project): void {
    this.selectedProject.set(project);
    this.logDate = this._todayStr();
    this.logHours = 1;
    this.logDescription = '';
    this.logError.set('');
    this.logDialogOpen.set(true);
  }

  closeLogDialog(): void {
    this.logDialogOpen.set(false);
    this.selectedProject.set(null);
  }

  submitLogTime(): void {
    const project = this.selectedProject();
    if (!project) return;

    this.logError.set('');
    const hours = Number(this.logHours);
    if (!hours || hours < 0.25 || hours > 24) {
      this.logError.set('Hours must be between 0.25 and 24');
      return;
    }

    this.logSubmitting.set(true);
    this.projectsService.logTime({
      projectId: project.id,
      date: this.logDate,
      hours,
      description: this.logDescription || undefined,
    }).subscribe({
      next: () => {
        this.logSubmitting.set(false);
        this.closeLogDialog();
        this.loadProjects();
      },
      error: (err) => {
        this.logSubmitting.set(false);
        this.logError.set(err.error?.error?.message || 'Failed to log time');
      },
    });
  }

  private _todayStr(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
