import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe, DecimalPipe } from '@angular/common';
import {
  LucideArrowLeft, LucideCalendar, LucideClock, LucideUsers,
  LucideFolderOpen, LucideBarChart3,
} from '@lucide/angular';
import { HrProjectsService } from '../../services/hr-projects.service';
import { HrProject } from '../../models/hr.models';

@Component({
  selector: 'app-hr-project-detail',
  imports: [RouterLink, DatePipe, DecimalPipe, LucideArrowLeft, LucideCalendar, LucideClock, LucideUsers, LucideFolderOpen, LucideBarChart3],
  template: `
    <div class="page-container">
      <a routerLink="/hr/projects" class="back-link">
        <svg lucideArrowLeft class="icon-sm" aria-hidden="true"></svg>
        Back to Projects
      </a>

      @if (loading()) {
        <div class="sk-list-padded">
          @for (i of [1,2,3]; track i) { <div class="sk sk-row-lg"></div> }
        </div>
      } @else if (project(); as p) {
        <!-- Header -->
        <div class="hero" [style.--card-color]="p.color || '#0b4a5a'">
          <div class="hero-top">
            <div class="hero-info">
              <div class="hero-badges">
                <span class="badge-status" [class]="'st-' + p.status">{{ statusLabel(p.status) }}</span>
                <span class="badge-priority" [class]="'prio-' + (p.priority || 'medium')">{{ p.priority || 'medium' }}</span>
              </div>
              <h1 class="hero-title">{{ p.name }}</h1>
              @if (p.client) {
                <p class="hero-client">{{ p.client }}</p>
              }
              @if (p.description) {
                <p class="hero-desc">{{ p.description }}</p>
              }
            </div>
          </div>

          <div class="hero-meta">
            @if (p.expectedStart) {
              <div class="hero-meta-item">
                <svg lucideCalendar class="icon-sm"></svg>
                <span>{{ p.expectedStart | date:'mediumDate' }} – {{ p.expectedEnd ? (p.expectedEnd | date:'mediumDate') : 'No end date' }}</span>
              </div>
            }
            <div class="hero-meta-item">
              <svg lucideClock class="icon-sm"></svg>
              <span>{{ p.estimatedHours ? p.estimatedHours + 'h estimated' : 'No estimate' }}</span>
            </div>
            <div class="hero-meta-item">
              <svg lucideUsers class="icon-sm"></svg>
              <span>{{ p.users.length }} assigned</span>
            </div>
          </div>
        </div>

        <!-- Stats Grid -->
        <div class="stats-grid">
          <div class="stat-card">
            <span class="stat-value">{{ p.totalHours ?? 0 }}</span>
            <span class="stat-label">Total Hours Logged</span>
          </div>
          <div class="stat-card">
            <span class="stat-value">{{ p.activeHoursThisWeek ?? 0 }}</span>
            <span class="stat-label">Hours This Week</span>
          </div>
          <div class="stat-card">
            <span class="stat-value">{{ p.estimatedHours ? ((p.totalHours! / p.estimatedHours) * 100 | number:'1.0-0') + '%' : '—' }}</span>
            <span class="stat-label">Progress</span>
          </div>
          <div class="stat-card">
            <span class="stat-value">{{ p.employees?.length ?? 0 }}</span>
            <span class="stat-label">Contributors</span>
          </div>
        </div>

        <!-- Employee Contributions -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Employee Contributions</h3>
          </div>
          @if (!p.employees || p.employees.length === 0) {
            <div class="empty">
              <svg lucideUsers class="empty-icon"></svg>
              <p class="empty-text">No time logged yet</p>
            </div>
          } @else {
            <div class="contrib-list">
              @for (emp of p.employees; track emp.userId) {
                <div class="contrib-row">
                  <div class="contrib-avatar">{{ emp.fullName.charAt(0) }}</div>
                  <span class="contrib-name">{{ emp.fullName }}</span>
                  <div class="contrib-bar-track">
                    <div class="contrib-bar-fill" [style.width.%]="barPercent(emp.totalHours)"></div>
                  </div>
                  <span class="contrib-hours">{{ emp.totalHours }}h</span>
                </div>
              }
            </div>
          }
        </div>

        <!-- Team & Users -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Assigned Members</h3>
          </div>
          @if (p.team) {
            <div class="assign-team-badge">
              <svg lucideFolderOpen class="icon-sm"></svg>
              <span>{{ p.team.name }}</span>
            </div>
          }
          @if (p.users?.length) {
            <div class="user-list">
              @for (u of p.users; track u.id) {
                <div class="user-row">
                  <div class="user-avatar">{{ u.fullName.charAt(0) }}</div>
                  <span class="user-name">{{ u.fullName }}</span>
                </div>
              }
            </div>
          } @else if (p.employees?.length) {
            <div class="user-list">
              @for (emp of p.employees; track emp.userId) {
                <div class="user-row">
                  <div class="user-avatar">{{ emp.fullName.charAt(0) }}</div>
                  <span class="user-name">{{ emp.fullName }}</span>
                </div>
              }
            </div>
          } @else {
            <div class="empty">
              <svg lucideUsers class="empty-icon"></svg>
              <p class="empty-text">No employees assigned</p>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    @use 'styles/design-tokens' as t;

    .page-container { width: 100%; }

    .back-link {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--rws-text-muted);
      text-decoration: none;
      margin-bottom: 1.5rem;
      transition: color 150ms ease;
      &:hover { color: var(--rws-accent-strong); }
    }

    .icon-sm { width: 16px; height: 16px; }

    /* ── Hero ────────────────────────────────────────────── */
    .hero {
      background: #fff;
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
      border-left: 4px solid var(--card-color, var(--rws-accent));
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    }
    .hero-top { margin-bottom: 1rem; }
    .hero-info { display: flex; flex-direction: column; gap: 0.375rem; }
    .hero-badges { display: flex; gap: 0.5rem; }
    .hero-title { margin: 0; font-size: 1.5rem; font-weight: 700; color: var(--rws-text); }
    .hero-client { margin: 0; font-size: 0.9375rem; color: var(--rws-accent-strong); font-weight: 500; }
    .hero-desc { margin: 0; font-size: 0.875rem; color: var(--rws-text-muted); line-height: 1.5; }

    .badge-status {
      font-size: 0.6875rem; font-weight: 600; padding: 0.1875rem 0.5rem; border-radius: 999px; text-transform: uppercase;
      &.st-planning { background: #f3f4f6; color: #6b7280; }
      &.st-active { background: #e8f8f6; color: #167d72; }
      &.st-on_hold { background: #fef3e2; color: #92610a; }
      &.st-completed { background: #e8f1fb; color: #2b3a67; }
      &.st-cancelled { background: #fde8e8; color: #b91c1c; }
      &.st-archived { background: #f3f4f6; color: #6b7280; }
    }
    .badge-priority {
      font-size: 0.6875rem; font-weight: 600; padding: 0.125rem 0.5rem; border-radius: 999px; text-transform: uppercase;
      &.prio-low { background: #f3f4f6; color: #6b7280; }
      &.prio-medium { background: #e8f1fb; color: #2b3a67; }
      &.prio-high { background: #fef3e2; color: #92610a; }
      &.prio-critical { background: #fde8e8; color: #b91c1c; }
    }

    .hero-meta { display: flex; gap: 1.5rem; flex-wrap: wrap; }
    .hero-meta-item { display: flex; align-items: center; gap: 0.375rem; font-size: 0.8125rem; color: var(--rws-text-muted); }

    /* ── Stats Grid ──────────────────────────────────────── */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    .stat-card {
      background: #fff;
      border-radius: 12px;
      padding: 1.25rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    .stat-value { font-size: 1.5rem; font-weight: 700; color: var(--rws-text); font-family: var(--rws-font-mono); }
    .stat-label { font-size: 0.75rem; color: var(--rws-text-muted); }

    /* ── Card ────────────────────────────────────────────── */
    .card {
      background: #fff;
      border-radius: 12px;
      padding: 1.25rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
      margin-bottom: 1.5rem;
    }
    .card-header { margin-bottom: 1rem; }
    .card-title { margin: 0; font-size: 1rem; font-weight: 600; color: var(--rws-text); }

    /* ── Contribution List ───────────────────────────────── */
    .contrib-list { display: flex; flex-direction: column; gap: 0.625rem; }
    .contrib-row {
      display: grid;
      grid-template-columns: 32px 1fr 1fr 48px;
      align-items: center;
      gap: 0.75rem;
    }
    .contrib-avatar {
      width: 28px; height: 28px; border-radius: 50%;
      background: linear-gradient(135deg, var(--rws-primary), var(--rws-accent));
      display: flex; align-items: center; justify-content: center;
      font-size: 0.6875rem; font-weight: 700; color: #fff;
    }
    .contrib-name { font-size: 0.875rem; font-weight: 500; color: var(--rws-text); }
    .contrib-bar-track { height: 6px; border-radius: 3px; background: var(--rws-bg); overflow: hidden; }
    .contrib-bar-fill { height: 100%; border-radius: 3px; background: var(--rws-accent); transition: width 300ms ease; }
    .contrib-hours { font-size: 0.8125rem; font-weight: 600; color: var(--rws-text); font-family: var(--rws-font-mono); text-align: right; }

    /* ── Assigned Members ────────────────────────────────── */
    .assign-team-badge {
      display: inline-flex; align-items: center; gap: 0.375rem;
      padding: 0.375rem 0.75rem; border-radius: 999px;
      background: var(--rws-bg); font-size: 0.8125rem; font-weight: 600;
      color: var(--rws-accent-strong); margin-bottom: 1rem;
    }
    .user-list { display: flex; flex-direction: column; gap: 0.5rem; }
    .user-row { display: flex; align-items: center; gap: 0.75rem; }
    .user-avatar {
      width: 28px; height: 28px; border-radius: 50%;
      background: linear-gradient(135deg, var(--rws-primary), var(--rws-accent));
      display: flex; align-items: center; justify-content: center;
      font-size: 0.6875rem; font-weight: 700; color: #fff; flex-shrink: 0;
    }
    .user-name { font-size: 0.875rem; font-weight: 500; color: var(--rws-text); }

    .empty { display: flex; flex-direction: column; align-items: center; padding: 2rem 0; text-align: center; }
    .empty-icon { width: 32px; height: 32px; color: var(--rws-text-muted); opacity: 0.4; margin-bottom: 0.5rem; }
    .empty-text { margin: 0; font-size: 0.875rem; color: var(--rws-text-muted); }

    @media (max-width: 639px) {
      .stats-grid { grid-template-columns: 1fr 1fr; }
    }
  `],
})
export class HrProjectDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly projectsService = inject(HrProjectsService);

  protected readonly project = signal<HrProject & { employees?: { userId: number; fullName: string; totalHours: number }[] } | null>(null);
  protected readonly loading = signal(true);

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('projectId'));
    if (!id) return;
    this.projectsService.getById(id).subscribe({
      next: (res) => {
        this.project.set(res.project as any);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected statusLabel(status: string): string {
    const labels: Record<string, string> = {
      planning: 'Planning', active: 'Active', on_hold: 'On Hold',
      completed: 'Completed', cancelled: 'Cancelled', archived: 'Archived',
    };
    return labels[status] || status;
  }

  protected barPercent(hours: number): number {
    const p = this.project();
    if (!p?.estimatedHours) return 0;
    return Math.min(100, (hours / p.estimatedHours) * 100);
  }
}
