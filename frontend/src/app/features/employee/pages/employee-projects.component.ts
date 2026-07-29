import { Component, inject, OnInit, signal, computed, DestroyRef } from '@angular/core';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import {
  LucideFolderOpen, LucideStopCircle, LucideClock, LucideArrowRight,
  LucideChevronRight, LucideCircle,
} from '@lucide/angular';
import { ProjectsService } from '../services/projects.service';
import { Project, ProjectAllocation } from '../models/employee.models';
import { RealtimeService, AllocationChangedEvent } from '../../../core/services/realtime.service';

@Component({
  selector: 'app-employee-projects',
  imports: [
    DatePipe, RouterLink,
    LucideFolderOpen, LucideStopCircle, LucideClock, LucideArrowRight,
    LucideChevronRight, LucideCircle,
  ],
  template: `
    <div class="page-container">
      <div class="page-header">
        <h1 class="page-title">My Projects</h1>
      </div>

      @if (loading()) {
        <div class="sk-list">
          @for (i of [1,2,3]; track i) {
            <div class="sk sk-row-lg"></div>
          }
        </div>
      } @else {
        <!-- Active Project Hero -->
        @if (activeProject()) {
          <div class="hero-card" [style.border-left-color]="activeProject()?.color || '#0b4a5a'">
            <div class="hero-top">
              <div class="hero-info">
                <span class="hero-label">Current Project</span>
                <h2 class="hero-name">{{ activeProject()?.name }}</h2>
              </div>
              <button class="btn btn-outline btn-sm" type="button" (click)="stopProject()" [disabled]="stopping()">
                <svg lucideStopCircle class="icon-sm" aria-hidden="true"></svg>
                {{ stopping() ? 'Stopping...' : 'Stop' }}
              </button>
            </div>
            <div class="hero-stats">
              <div class="hero-stat">
                <span class="hero-stat-value">{{ activeElapsed() }}</span>
                <span class="hero-stat-label">elapsed today</span>
              </div>
              <div class="hero-stat">
                <span class="hero-stat-value">{{ activeProject()?.hoursThisWeek ?? 0 }}h</span>
                <span class="hero-stat-label">this week</span>
              </div>
            </div>
          </div>
        }

        <!-- Project Grid -->
        @if (projects().length === 0) {
          <div class="empty-state">
            <svg lucideFolderOpen class="empty-icon" aria-hidden="true"></svg>
            <p class="empty-text">No projects assigned</p>
            <p class="empty-sub">Contact your manager to get assigned to a project.</p>
          </div>
        } @else {
          <div class="project-grid">
            @for (project of projects(); track project.id) {
              <div
                class="project-card"
                [class.active]="activeProject()?.id === project.id"
                (click)="switchToProject(project)"
                role="button"
                tabindex="0"
                [style.--card-color]="project.color || '#0b4a5a'"
                (keydown.enter)="switchToProject(project)"
              >
                <div class="card-top">
                  <span class="card-status" [class]="'st-' + (activeProject()?.id === project.id ? 'active' : 'idle')">
                    <span class="status-dot"></span>
                    {{ activeProject()?.id === project.id ? 'Active' : 'Click to switch' }}
                  </span>
                  @if (project.priority) {
                    <span class="card-priority" [class]="'prio-' + project.priority">{{ project.priority }}</span>
                  }
                </div>
                <h3 class="card-name">{{ project.name }}</h3>
                @if (project.description) {
                  <p class="card-desc">{{ project.description }}</p>
                }
                <div class="card-stats">
                  <div class="card-stat">
                    <svg lucideClock class="icon-xs" aria-hidden="true"></svg>
                    <span>{{ project.hoursThisWeek ?? 0 }}h this week</span>
                  </div>
                  <div class="card-stat">
                    <svg lucideCircle class="icon-xs" aria-hidden="true"></svg>
                    <span>{{ project.hoursTotal ?? 0 }}h total</span>
                  </div>
                </div>
                @if (activeProject()?.id !== project.id) {
                  <div class="card-action">
                    <span class="switch-label">Switch to this project</span>
                    <svg lucideArrowRight class="icon-sm" aria-hidden="true"></svg>
                  </div>
                }
              </div>
            }
          </div>
        }
      }

      <!-- Switch toast -->
      @if (switchMessage()) {
        <div class="toast" [class.toast-success]="switchSuccess()" [class.toast-error]="!switchSuccess()">
          {{ switchMessage() }}
        </div>
      }
    </div>
  `,
  styles: [`
    @use 'styles/design-tokens' as t;

    .page-container { width: 100%; }
    .page-header { margin-bottom: 1.5rem; }
    .page-title { margin: 0; font-size: 1.5rem; font-weight: 700; color: var(--rws-text); }

    /* ── Empty State ───────────────────────────────────── */
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

    /* ── Hero Active Project ────────────────────────────── */
    .hero-card {
      background: #fff;
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
      border-left: 4px solid var(--rws-accent);
      box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
    }
    .hero-top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 1rem;
    }
    .hero-info { display: flex; flex-direction: column; gap: 0.125rem; }
    .hero-label { font-size: 0.75rem; color: var(--rws-text-muted); font-weight: 500; text-transform: uppercase; letter-spacing: 0.04em; }
    .hero-name { margin: 0; font-size: 1.25rem; font-weight: 700; color: var(--rws-text); }
    .hero-stats { display: flex; gap: 2rem; }
    .hero-stat { display: flex; flex-direction: column; gap: 0.125rem; }
    .hero-stat-value { font-size: 1.125rem; font-weight: 700; color: var(--rws-text); font-family: var(--rws-font-mono); }
    .hero-stat-label { font-size: 0.75rem; color: var(--rws-text-muted); }

    /* ── Project Grid ──────────────────────────────────── */
    .project-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 1rem;
    }

    .project-card {
      background: #fff;
      border-radius: 12px;
      padding: 1.25rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
      cursor: pointer;
      transition: transform 150ms ease, box-shadow 150ms ease, border-color 150ms ease;
      border: 2px solid transparent;
      position: relative;
      outline: none;

      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04);
        border-color: var(--card-color, var(--rws-accent));
      }
      &:focus-visible { outline: 3px solid var(--rws-focus-ring); outline-offset: 2px; }
      &.active {
        border-color: var(--card-color, var(--rws-accent));
        background: linear-gradient(135deg, #fafcfc, #ffffff);
      }
    }

    .card-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 0.75rem;
    }

    .card-status {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      font-size: 0.75rem;
      font-weight: 600;
      padding: 0.1875rem 0.5rem;
      border-radius: 999px;

      &.st-active { background: #e8f8f6; color: #167d72; }
      &.st-idle { background: var(--rws-bg); color: var(--rws-text-muted); }
    }

    .status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      .st-active & { background: #1fb6a6; }
      .st-idle & { background: #d1d5db; }
    }

    .card-priority {
      font-size: 0.6875rem;
      font-weight: 600;
      padding: 0.125rem 0.5rem;
      border-radius: 999px;
      text-transform: uppercase;
      letter-spacing: 0.03em;

      &.prio-low { background: #f3f4f6; color: #6b7280; }
      &.prio-medium { background: #e8f1fb; color: #2b3a67; }
      &.prio-high { background: #fef3e2; color: #92610a; }
      &.prio-critical { background: #fde8e8; color: #b91c1c; }
    }

    .card-name {
      margin: 0 0 0.375rem;
      font-size: 1rem;
      font-weight: 600;
      color: var(--rws-text);
    }

    .card-desc {
      margin: 0 0 0.75rem;
      font-size: 0.8125rem;
      color: var(--rws-text-muted);
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      line-height: 1.4;
    }

    .card-stats {
      display: flex;
      gap: 1rem;
      margin-bottom: 0.75rem;
    }

    .card-stat {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      font-size: 0.8125rem;
      color: var(--rws-text-muted);
      font-weight: 500;
    }

    .card-action {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-top: 0.75rem;
      border-top: 1px solid var(--rws-border);
    }

    .switch-label {
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--rws-accent-strong);
    }

    .icon-xs { width: 14px; height: 14px; }
    .icon-sm { width: 16px; height: 16px; }

    /* ── Buttons ────────────────────────────────────────── */
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.375rem;
      padding: 0.5rem 1rem;
      border: none;
      border-radius: var(--rws-radius);
      font-size: 0.8125rem;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
      transition: opacity 150ms ease, background 150ms ease, color 150ms ease;
      &:disabled { opacity: 0.5; cursor: not-allowed; }
      &:focus-visible { outline: 3px solid var(--rws-focus-ring); outline-offset: 2px; }
    }
    .btn-outline {
      background: transparent;
      color: var(--rws-text);
      border: 1px solid var(--rws-border);
      &:hover:not(:disabled) { border-color: var(--rws-error); color: var(--rws-error); background: #fef2f2; }
    }
    .btn-sm { padding: 0.375rem 0.75rem; }

    /* ── Toast ──────────────────────────────────────────── */
    .toast {
      position: fixed;
      bottom: 1.5rem;
      left: 50%;
      transform: translateX(-50%);
      padding: 0.75rem 1.25rem;
      border-radius: var(--rws-radius);
      font-size: 0.875rem;
      font-weight: 500;
      z-index: 100;
      box-shadow: 0 8px 24px rgba(0,0,0,0.15);
      animation: toast-in 200ms ease;
    }
    .toast-success { background: #e8f8f6; color: #167d72; border: 1px solid #b3e8e3; }
    .toast-error { background: #fde8e8; color: #b91c1c; border: 1px solid #f5c6c6; }

    @keyframes toast-in {
      from { opacity: 0; transform: translateX(-50%) translateY(8px); }
      to { opacity: 1; transform: translateX(-50%) translateY(0); }
    }

    @media (max-width: 639px) {
      .project-grid { grid-template-columns: 1fr; }
    }

    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
    }
  `],
})
export class EmployeeProjectsComponent implements OnInit {
  private readonly projectsService = inject(ProjectsService);
  private readonly realtime = inject(RealtimeService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly projects = signal<Project[]>([]);
  protected readonly activeAllocation = signal<ProjectAllocation | null>(null);
  protected readonly loading = signal(true);
  protected readonly switchMessage = signal('');
  protected readonly switchSuccess = signal(false);
  protected readonly stopping = signal(false);
  protected readonly tick = signal(0);

  protected readonly activeProject = computed(() => {
    const alloc = this.activeAllocation();
    if (!alloc?.projectId) return null;
    return this.projects().find((p) => p.id === alloc.projectId) ?? null;
  });

  protected readonly activeElapsed = computed(() => {
    this.tick();
    const alloc = this.activeAllocation();
    if (!alloc?.startTime) return '0m';
    const start = new Date(alloc.startTime).getTime();
    const min = Math.round((Date.now() - start) / 60000);
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  });

  private _tickInterval: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.loadData();
    this._tickInterval = setInterval(() => this.tick.update(v => v + 1), 30000);
    this.realtime.allocationChanged$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((event: AllocationChangedEvent) => {
      this.activeAllocation.set(event.allocationId
        ? { id: event.allocationId, startTime: event.startTime, projectId: event.projectId, projectName: event.projectName }
        : null
      );
    });
  }

  private loadData(): void {
    this.loading.set(true);
    Promise.all([
      this.projectsService.getMyProjects().toPromise(),
      this.projectsService.getActiveAllocation().toPromise(),
    ]).then(([projectsRes, allocRes]) => {
      if (projectsRes) this.projects.set(projectsRes.projects);
      if (allocRes) this.activeAllocation.set(allocRes.allocation);
      this.loading.set(false);
    }).catch(() => this.loading.set(false));
  }

  switchToProject(project: Project): void {
    if (this.activeAllocation()?.projectId === project.id) return;
    this.projectsService.switchProject(project.id).subscribe({
      next: (res) => {
        this.activeAllocation.set(res.allocation);
        this.showToast(`Switched to "${project.name}"`, true);
      },
      error: () => this.showToast('Failed to switch project', false),
    });
  }

  stopProject(): void {
    this.stopping.set(true);
    this.projectsService.stopProject().subscribe({
      next: () => {
        this.activeAllocation.set(null);
        this.stopping.set(false);
        this.showToast('Project tracking stopped', true);
      },
      error: () => {
        this.stopping.set(false);
        this.showToast('Failed to stop project', false);
      },
    });
  }

  private showToast(message: string, success: boolean): void {
    this.switchMessage.set(message);
    this.switchSuccess.set(success);
    setTimeout(() => this.switchMessage.set(''), 3000);
  }
}
