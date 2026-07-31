import { Component, inject, OnInit, signal, computed, DestroyRef } from '@angular/core';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import {
  LucideUsers, LucideStopCircle, LucideClock, LucideArrowRight,
  LucideCrown, LucideBriefcase, LucideSearch, LucideX,
  LucideChevronDown, LucideCoffee, LucideTrendingUp,
  LucideCalendar, LucideBarChart3, LucideAlertTriangle,
  LucideUser,
} from '@lucide/angular';
import { WorkspaceService } from '../services/workspace.service';
import { ProjectsService } from '../services/projects.service';
import {
  WorkspaceData, WorkspaceTeamMember, WorkspaceProject,
  ProjectAllocation, Project,
} from '../models/employee.models';
import { RealtimeService, AllocationChangedEvent, SessionStatusEvent } from '../../../core/services/realtime.service';

type FilterKey = 'all' | 'active' | 'completed' | 'highPriority' | 'dueThisWeek' | 'dueThisMonth';
type SortKey = 'name' | 'deadline' | 'progress' | 'priority' | 'estimated' | 'worked' | 'updated';

@Component({
  selector: 'app-employee-projects',
  imports: [
    DatePipe, FormsModule,
    LucideUsers, LucideStopCircle, LucideClock, LucideArrowRight,
    LucideCrown, LucideBriefcase, LucideSearch, LucideX,
    LucideChevronDown, LucideCoffee, LucideTrendingUp,
    LucideCalendar, LucideBarChart3, LucideAlertTriangle, LucideUser,
  ],
  template: `
    <div class="page-container">
      <div class="page-header">
        <h1 class="page-title">Team Workspace</h1>
      </div>

      @if (loading()) {
        <div class="skeleton-grid">
          <div class="sk-card-lg"></div>
          <div class="sk-row-group">
            @for (i of [1,2,3,4]; track i) { <div class="sk-card-sm"></div> }
          </div>
          <div class="sk-card-lg"></div>
        </div>
      } @else {
        @if (!workspace()?.team) {
          <div class="empty-state">
            <svg lucideUsers class="empty-icon" aria-hidden="true"></svg>
            <p class="empty-title">You haven't been assigned to a team yet</p>
            <p class="empty-sub">Contact your manager or HR to get assigned to a team.</p>
          </div>
        } @else {
          @let w = workspace()!;
          @let team = w.team!;

          <!-- ============================================ -->
          <!-- SECTION 1: MY TEAM                           -->
          <!-- ============================================ -->
          <div class="section">
            <div class="my-team-card">
              <div class="team-hero">
                <div class="team-icon-wrap">
                  <svg lucideUsers class="team-icon" aria-hidden="true"></svg>
                </div>
                <div class="team-info">
                  <h2 class="team-name">{{ team.name }}</h2>
                  @if (team.description) {
                    <p class="team-desc">{{ team.description }}</p>
                  }
                </div>
                <span class="role-badge" [class.is-leader]="isLeader()">
                  <svg lucideCrown class="icon-xs" aria-hidden="true"></svg>
                  {{ isLeader() ? 'Team Leader' : 'Team Member' }}
                </span>
              </div>
              <div class="team-meta-row">
                @if (team.leader) {
                  <div class="team-leader-info">
                    <span class="meta-label">Team Lead</span>
                    <div class="leader-detail">
                      <div class="avatar-xs">{{ team.leader.fullName.charAt(0) }}</div>
                      <div>
                        <div class="leader-name">{{ team.leader.fullName }}</div>
                        <div class="leader-email">{{ team.leader.email }}</div>
                      </div>
                    </div>
                  </div>
                }
                <div class="meta-stats">
                  <div class="meta-stat">
                    <span class="meta-stat-value">{{ team.memberCount }}</span>
                    <span class="meta-stat-label">Members</span>
                  </div>
                  <div class="meta-stat">
                    <span class="meta-stat-value">{{ activeNow() }}</span>
                    <span class="meta-stat-label">Active</span>
                  </div>
                  <div class="meta-stat">
                    <span class="meta-stat-value">{{ team.projectCount }}</span>
                    <span class="meta-stat-label">Projects</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- ============================================ -->
          <!-- SECTION 2: TEAM MEMBERS                      -->
          <!-- ============================================ -->
          <div class="section">
            <h2 class="section-title">Team Members</h2>
            <div class="members-grid">
              @for (member of team.members; track member.id) {
                <div class="member-card" [class.self-card]="member.isSelf">
                  <div class="member-avatar-wrap">
                    <div class="member-avatar" [class.leader-ring]="member.isLeader">
                      {{ member.fullName.charAt(0) }}{{ member.fullName.split(' ')[1]?.charAt(0) ?? '' }}
                    </div>
                    <span class="status-dot-lg" [class.dot-active]="member.status === 'active'" [class.dot-break]="member.status === 'break'" [class.dot-idle]="member.status === 'idle'" [class.dot-offline]="member.status === 'clocked_out'"></span>
                  </div>
                  <div class="member-body">
                    <div class="member-name-row">
                      <span class="member-name">{{ member.isSelf ? 'You' : member.fullName }}</span>
                      @if (member.isLeader) {
                        <span class="leader-chip">
                          <svg lucideCrown class="icon-xs" aria-hidden="true"></svg>
                          Lead
                        </span>
                      }
                    </div>
                    <span class="member-status" [class.txt-active]="member.status === 'active'" [class.txt-break]="member.status === 'break'" [class.txt-offline]="member.status === 'clocked_out'">
                      {{ statusLabel(member.status) }}
                    </span>
                  </div>
                </div>
              }
            </div>
          </div>

          <!-- ============================================ -->
          <!-- SECTION 5: TEAM WORKLOAD                     -->
          <!-- ============================================ -->
          @if (w.workload) {
            <div class="section">
              <h2 class="section-title">Team Workload</h2>
              <div class="workload-grid">
                <div class="workload-card">
                  <div class="wl-icon wl-active"><svg lucideTrendingUp class="icon-sm" aria-hidden="true"></svg></div>
                  <span class="wl-value">{{ w.workload.activeNow }}</span>
                  <span class="wl-label">Working</span>
                </div>
                <div class="workload-card">
                  <div class="wl-icon wl-break"><svg lucideCoffee class="icon-sm" aria-hidden="true"></svg></div>
                  <span class="wl-value">{{ w.workload.onBreak }}</span>
                  <span class="wl-label">On Break</span>
                </div>
                <div class="workload-card">
                  <div class="wl-icon wl-offline"><svg lucideClock class="icon-sm" aria-hidden="true"></svg></div>
                  <span class="wl-value">{{ w.workload.offline }}</span>
                  <span class="wl-label">Offline</span>
                </div>
                <div class="workload-card">
                  <div class="wl-icon wl-project"><svg lucideBriefcase class="icon-sm" aria-hidden="true"></svg></div>
                  <span class="wl-value">{{ w.workload.activeProjects }}</span>
                  <span class="wl-label">Active Projects</span>
                </div>
                <div class="workload-card">
                  <div class="wl-icon wl-complete"><svg lucideBarChart3 class="icon-sm" aria-hidden="true"></svg></div>
                  <span class="wl-value">{{ w.workload.completedProjects }}</span>
                  <span class="wl-label">Completed</span>
                </div>
                <div class="workload-card">
                  <div class="wl-icon wl-hours"><svg lucideClock class="icon-sm" aria-hidden="true"></svg></div>
                  <span class="wl-value">{{ w.workload.hoursWorkedThisWeek }}h</span>
                  <span class="wl-label">Hours Today</span>
                </div>
              </div>
            </div>
          }

          <!-- ============================================ -->
          <!-- ACTIVE PROJECT BAR (preserved)               -->
          <!-- ============================================ -->
          @if (activeProject()) {
            <div class="active-bar" [style.--bar-color]="activeProject()?.color || '#0b4a5a'">
              <div class="bar-left">
                <span class="bar-label">Active Project</span>
                <span class="bar-name">{{ activeProject()?.name }}</span>
                <span class="bar-elapsed">{{ activeElapsed() }}</span>
              </div>
              <button class="btn btn-outline btn-sm" type="button" (click)="stopProject()" [disabled]="stopping()">
                <svg lucideStopCircle class="icon-sm" aria-hidden="true"></svg>
                {{ stopping() ? 'Stopping...' : 'Stop' }}
              </button>
            </div>
          }

          <!-- ============================================ -->
          <!-- SEARCH + FILTERS + SORT                      -->
          <!-- ============================================ -->
          <div class="toolbar">
            <div class="search-wrap">
              <svg lucideSearch class="search-icon" aria-hidden="true"></svg>
              <input
                type="text"
                class="search-input"
                placeholder="Search projects..."
                [value]="searchQuery()"
                (input)="onSearchInput($event)" />
            </div>

            <div class="filter-chips">
              @for (f of filterPresets; track f.key) {
                <button class="chip" [class.active]="activeFilter() === f.key" type="button" (click)="activeFilter.set(f.key); currentPage.set(1)">
                  {{ f.label }}
                </button>
              }
            </div>

            <div class="sort-wrap">
              <svg lucideChevronDown class="icon-xs" aria-hidden="true"></svg>
              <select class="sort-select" [value]="activeSort()" (change)="onSortChange($event)">
                <option value="name">Name</option>
                <option value="deadline">Deadline</option>
                <option value="progress">Progress</option>
                <option value="priority">Priority</option>
                <option value="estimated">Est. Hours</option>
                <option value="worked">Worked Hours</option>
              </select>
            </div>
          </div>

          <!-- ============================================ -->
          <!-- SECTION 3: MY PROJECTS                       -->
          <!-- ============================================ -->
          <div class="section">
            <h2 class="section-title">My Projects <span class="count-badge">{{ filteredProjects().length }}</span></h2>

            @if (team.projects.length === 0) {
              <div class="empty-state-sm">
                <svg lucideBriefcase class="empty-icon-sm" aria-hidden="true"></svg>
                <p class="empty-title-sm">You have no assigned projects yet</p>
                <p class="empty-sub-sm">Projects assigned to you or your team will appear here.</p>
              </div>
            } @else {
              @if (filteredProjects().length === 0) {
                <div class="empty-state-sm">
                  <svg lucideSearch class="empty-icon-sm" aria-hidden="true"></svg>
                  <p class="empty-title-sm">No matching projects</p>
                  <p class="empty-sub-sm">Try a different search or filter.</p>
                </div>
              } @else {
                <div class="project-grid">
                  @for (project of paginatedProjects(); track project.id) {
                    <div class="project-card" [style.--card-color]="project.color || '#0b4a5a'" (click)="openDrawer(project)" role="button" tabindex="0" (keydown.enter)="openDrawer(project)">
                      <div class="card-top-row">
                        <span class="card-status-badge" [class]="'st-' + project.status">{{ statusLabel(project.status) }}</span>
                        <span class="assign-badge" [class.is-individual]="project.assignmentType === 'individual'">
                          @if (project.assignmentType === 'individual') {
                            <svg lucideUser class="icon-xs" aria-hidden="true"></svg>
                            Individual
                          } @else {
                            <svg lucideUsers class="icon-xs" aria-hidden="true"></svg>
                            Team
                          }
                        </span>
                        @if (project.priority) {
                          <span class="card-prio-badge" [class]="'prio-' + project.priority">{{ project.priority }}</span>
                        }
                      </div>
                      <h3 class="card-title">{{ project.name }}</h3>
                      @if (project.description) {
                        <p class="card-desc">{{ project.description }}</p>
                      }
                      @if (project.progress !== null && project.progress !== undefined) {
                        <div class="progress-bar-track">
                          <div class="progress-bar-fill" [style.width.%]="project.progress"></div>
                        </div>
                        <span class="progress-label">{{ project.progress }}% complete</span>
                      }
                      <div class="card-meta-row">
                        <span class="card-meta-item" title="Estimated hours">
                          <svg lucideClock class="icon-xs" aria-hidden="true"></svg>
                          {{ project.estimatedHours ?? '—' }}h est.
                        </span>
                        <span class="card-meta-item" title="Worked hours">
                          <svg lucideTrendingUp class="icon-xs" aria-hidden="true"></svg>
                          {{ project.totalHours }}h worked
                        </span>
                        @if (project.expectedEnd) {
                          <span class="card-meta-item" title="Deadline">
                            <svg lucideCalendar class="icon-xs" aria-hidden="true"></svg>
                            {{ project.expectedEnd | date:'shortDate' }}
                          </span>
                        }
                      </div>
                      <div class="card-footer-row">
                        <div class="my-contrib-badge">
                          <span class="contrib-label">My contribution</span>
                          <span class="contrib-value">{{ project.myContribution.hoursTotal }}h ({{ project.myContribution.percentage }}%)</span>
                        </div>
                        <span class="card-view-link">
                          Details <svg lucideArrowRight class="icon-xs" aria-hidden="true"></svg>
                        </span>
                      </div>
                    </div>
                  }
                </div>

                @if (totalPages() > 1) {
                  <div class="pagination">
                    <button class="btn btn-ghost btn-sm" [disabled]="currentPage() === 1" (click)="goToPage(currentPage() - 1)">Previous</button>
                    <span class="page-info">Page {{ currentPage() }} of {{ totalPages() }}</span>
                    <button class="btn btn-ghost btn-sm" [disabled]="currentPage() === totalPages()" (click)="goToPage(currentPage() + 1)">Next</button>
                  </div>
                }
              }
            }
          </div>

          <!-- ============================================ -->
          <!-- SECTION 4: MY CONTRIBUTION                   -->
          <!-- ============================================ -->
          @if (team.projects.length > 0) {
            <div class="section">
              <h2 class="section-title">My Contribution</h2>
              <div class="contribution-table-wrap">
                <table class="contribution-table">
                  <thead>
                    <tr>
                      <th>Project</th>
                      <th>My Hours</th>
                      <th>Share</th>
                      <th>Today</th>
                      <th>This Week</th>
                      <th>Last Week</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (project of team.projects; track project.id) {
                      <tr>
                        <td>
                          <div class="contr-project">
                            <span class="contr-dot" [style.background]="project.color || '#0b4a5a'"></span>
                            <span>{{ project.name }}</span>
                            <span class="assign-badge assign-badge-sm" [class.is-individual]="project.assignmentType === 'individual'">
                              {{ project.assignmentType === 'individual' ? 'Individual' : 'Team' }}
                            </span>
                          </div>
                        </td>
                        <td class="contr-value">{{ project.myContribution.hoursTotal }}h</td>
                        <td>
                          <div class="share-cell">
                            <div class="share-bar-track">
                              <div class="share-bar-fill" [style.width.%]="project.myContribution.percentage"></div>
                            </div>
                            <span>{{ project.myContribution.percentage }}%</span>
                          </div>
                        </td>
                        <td class="contr-value">{{ project.myContribution.hoursToday }}h</td>
                        <td class="contr-value">{{ project.myContribution.hoursThisWeek }}h</td>
                        <td class="contr-value">{{ project.myContribution.hoursLastWeek }}h</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          }
        }
      }

      <!-- ============================================ -->
      <!-- PROJECT DETAIL DRAWER                        -->
      <!-- ============================================ -->
      @if (drawerProject()) {
        <div class="drawer-overlay" (click)="closeDrawer()"></div>
        <div class="drawer" role="dialog" aria-modal="true" aria-label="Project details">
          <div class="drawer-header">
            <h2 class="drawer-title" [style.--card-color]="drawerProject()?.color || '#0b4a5a'">{{ drawerProject()?.name }}</h2>
            <button class="drawer-close" type="button" (click)="closeDrawer()" aria-label="Close">
              <svg lucideX class="icon-sm" aria-hidden="true"></svg>
            </button>
          </div>
          <div class="drawer-body">
            @if (drawerProject(); as p) {
              <div class="drawer-section">
                <div class="drawer-badges">
                  <span class="card-status-badge" [class]="'st-' + p.status">{{ statusLabel(p.status) }}</span>
                  <span class="assign-badge" [class.is-individual]="p.assignmentType === 'individual'">
                    @if (p.assignmentType === 'individual') {
                      <svg lucideUser class="icon-xs" aria-hidden="true"></svg>
                      Individual
                    } @else {
                      <svg lucideUsers class="icon-xs" aria-hidden="true"></svg>
                      Team
                    }
                  </span>
                  @if (p.priority) {
                    <span class="card-prio-badge" [class]="'prio-' + p.priority">{{ p.priority }}</span>
                  }
                </div>
                @if (p.manager) {
                  <div class="drawer-field">
                    <span class="drawer-field-label">Manager</span>
                    <span class="drawer-field-value">{{ p.manager.fullName }}</span>
                  </div>
                }
              </div>

              @if (p.description) {
                <div class="drawer-section">
                  <h3 class="drawer-section-title">Description</h3>
                  <p class="drawer-desc">{{ p.description }}</p>
                </div>
              }

              <div class="drawer-section">
                <h3 class="drawer-section-title">Progress</h3>
                @if (p.progress !== null) {
                  <div class="drawer-progress">
                    <div class="progress-bar-track lg">
                      <div class="progress-bar-fill" [style.width.%]="p.progress"></div>
                    </div>
                    <span class="drawer-progress-label">{{ p.progress }}% complete</span>
                  </div>
                }
                <div class="drawer-stats-grid">
                  <div class="drawer-stat">
                    <span class="ds-value">{{ p.estimatedHours ?? '—' }}h</span>
                    <span class="ds-label">Estimated</span>
                  </div>
                  <div class="drawer-stat">
                    <span class="ds-value">{{ p.totalHours }}h</span>
                    <span class="ds-label">Worked</span>
                  </div>
                  <div class="drawer-stat">
                    <span class="ds-value">{{ remainingHours(p) }}h</span>
                    <span class="ds-label">Remaining</span>
                  </div>
                  @if (p.expectedEnd) {
                    <div class="drawer-stat">
                      <span class="ds-value">{{ p.expectedEnd | date:'shortDate' }}</span>
                      <span class="ds-label">Deadline</span>
                    </div>
                  }
                </div>
              </div>

              <div class="drawer-section">
                <h3 class="drawer-section-title">My Contribution</h3>
                <div class="drawer-contrib-grid">
                  <div class="dc-stat">
                    <span class="dc-value">{{ p.myContribution.hoursTotal }}h</span>
                    <span class="dc-label">Total</span>
                  </div>
                  <div class="dc-stat">
                    <span class="dc-value">{{ p.myContribution.percentage }}%</span>
                    <span class="dc-label">Share</span>
                  </div>
                  <div class="dc-stat">
                    <span class="dc-value">{{ p.myContribution.hoursToday }}h</span>
                    <span class="dc-label">Today</span>
                  </div>
                  <div class="dc-stat">
                    <span class="dc-value">{{ p.myContribution.hoursThisWeek }}h</span>
                    <span class="dc-label">This Week</span>
                  </div>
                  <div class="dc-stat">
                    <span class="dc-value">{{ p.myContribution.hoursLastWeek }}h</span>
                    <span class="dc-label">Last Week</span>
                  </div>
                </div>
              </div>

              @if (isLeader()) {
                <div class="drawer-section">
                  <div class="drawer-action-card" (click)="switchToProject(p)">
                    <svg lucideBriefcase class="icon-sm" aria-hidden="true"></svg>
                    <span>{{ activeProject()?.id === p.id ? 'Currently active' : 'Switch to this project' }}</span>
                  </div>
                </div>
              }
            }
          </div>
        </div>
      }

      <!-- Switch toast (preserved) -->
      @if (switchMessage()) {
        <div class="toast" [class.toast-success]="switchSuccess()" [class.toast-error]="!switchSuccess()">
          {{ switchMessage() }}
        </div>
      }
    </div>
  `,
  styles: [`
    @use 'styles/design-tokens' as t;

    .page-header { margin-bottom: 1.5rem; }
    .page-title { margin: 0; font-size: 1.5rem; font-weight: 700; color: var(--rws-text); }

    .section { margin-bottom: 1.5rem; }
    .section-title {
      margin: 0 0 0.75rem;
      font-size: 1rem;
      font-weight: 700;
      color: var(--rws-text);
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .icon-xs { width: 14px; height: 14px; }
    .icon-sm { width: 16px; height: 16px; }

    .count-badge {
      font-size: 0.6875rem; font-weight: 600; color: var(--rws-text-muted);
      background: var(--rws-bg); padding: 0.125rem 0.5rem; border-radius: 999px;
    }

    /* ── Skeleton ──────────────────────────────────── */
    .skeleton-grid { display: flex; flex-direction: column; gap: 1.5rem; }
    .sk-card-lg { height: 140px; background: #f0f2f5; border-radius: 12px; animation: sk-pulse 1.5s infinite; }
    .sk-card-sm { height: 80px; background: #f0f2f5; border-radius: 10px; animation: sk-pulse 1.5s infinite; }
    .sk-row-group { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 0.75rem; }

    @keyframes sk-pulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 0.3; } }

    /* ── Empty State ────────────────────────────────── */
    .empty-state {
      display: flex; flex-direction: column; align-items: center;
      padding: 4rem 2rem; text-align: center;
      background: #fff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    }
    .empty-icon { width: 48px; height: 48px; color: var(--rws-text-muted); opacity: 0.4; margin-bottom: 1rem; }
    .empty-title { margin: 0 0 0.375rem; font-size: 1.0625rem; font-weight: 600; color: var(--rws-text); }
    .empty-sub { margin: 0; font-size: 0.875rem; color: var(--rws-text-muted); }

    .empty-state-sm {
      display: flex; flex-direction: column; align-items: center;
      padding: 2.5rem; text-align: center;
      background: #fff; border-radius: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    }
    .empty-icon-sm { width: 32px; height: 32px; color: var(--rws-text-muted); opacity: 0.4; margin-bottom: 0.5rem; }
    .empty-title-sm { margin: 0 0 0.125rem; font-size: 0.9375rem; font-weight: 600; color: var(--rws-text); }
    .empty-sub-sm { margin: 0; font-size: 0.8125rem; color: var(--rws-text-muted); }

    /* ================================================ */
    /* SECTION 1: MY TEAM                               */
    /* ================================================ */
    .my-team-card {
      background: #fff; border-radius: 12px; padding: 1.5rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    }
    .team-hero { display: flex; align-items: flex-start; gap: 1rem; margin-bottom: 1.25rem; flex-wrap: wrap; }
    .team-icon-wrap {
      display: flex; align-items: center; justify-content: center;
      width: 48px; height: 48px; border-radius: 12px;
      background: linear-gradient(135deg, var(--rws-primary), var(--rws-accent));
      flex-shrink: 0;
    }
    .team-icon { width: 22px; height: 22px; color: #fff; }
    .team-info { flex: 1; min-width: 0; }
    .team-name { margin: 0 0 0.125rem; font-size: 1.25rem; font-weight: 700; color: var(--rws-text); }
    .team-desc { margin: 0; font-size: 0.8125rem; color: var(--rws-text-muted); line-height: 1.5; }

    .role-badge {
      display: inline-flex; align-items: center; gap: 0.375rem;
      padding: 0.375rem 0.875rem; border-radius: 999px;
      font-size: 0.75rem; font-weight: 600;
      background: var(--rws-bg); color: var(--rws-text-muted);
      svg { width: 12px; height: 12px; }
      &.is-leader { background: #fef8e7; color: #92610a; }
    }

    .team-meta-row { display: flex; align-items: flex-start; gap: 2rem; flex-wrap: wrap; }
    .team-leader-info { display: flex; flex-direction: column; gap: 0.375rem; }
    .meta-label { font-size: 0.6875rem; font-weight: 600; color: var(--rws-text-muted); text-transform: uppercase; letter-spacing: 0.04em; }
    .leader-detail { display: flex; align-items: center; gap: 0.5rem; }
    .avatar-xs {
      width: 28px; height: 28px; border-radius: 50%;
      background: linear-gradient(135deg, var(--rws-primary), var(--rws-accent));
      display: flex; align-items: center; justify-content: center;
      font-size: 0.625rem; font-weight: 700; color: #fff; flex-shrink: 0;
    }
    .leader-name { font-size: 0.8125rem; font-weight: 600; color: var(--rws-text); }
    .leader-email { font-size: 0.75rem; color: var(--rws-text-muted); }

    .meta-stats { display: flex; gap: 1.5rem; }
    .meta-stat { display: flex; flex-direction: column; gap: 0.125rem; }
    .meta-stat-value { font-size: 1rem; font-weight: 700; color: var(--rws-text); }
    .meta-stat-label { font-size: 0.6875rem; color: var(--rws-text-muted); text-transform: uppercase; letter-spacing: 0.03em; font-weight: 600; }

    /* ================================================ */
    /* SECTION 2: TEAM MEMBERS                          */
    /* ================================================ */
    .members-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 0.75rem;
    }
    .member-card {
      background: #fff; border-radius: 10px; padding: 1rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
      display: flex; align-items: center; gap: 0.75rem;
      transition: box-shadow 150ms ease;
      &:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
      &.self-card { background: #fafcfe; border: 1px solid #e2e8f0; }
    }
    .member-avatar-wrap { position: relative; flex-shrink: 0; }
    .member-avatar {
      width: 40px; height: 40px; border-radius: 50%;
      background: linear-gradient(135deg, var(--rws-primary), var(--rws-accent));
      display: flex; align-items: center; justify-content: center;
      font-size: 0.75rem; font-weight: 700; color: #fff;
      &.leader-ring { box-shadow: 0 0 0 2px #f5b342; }
    }
    .status-dot-lg {
      position: absolute; bottom: 0; right: 0;
      width: 12px; height: 12px; border-radius: 50%;
      border: 2px solid #fff;
      &.dot-active { background: #1fb6a6; }
      &.dot-break { background: #d9973b; }
      &.dot-idle { background: #9ca3af; }
      &.dot-offline { background: #d1d5db; }
    }
    .member-body { flex: 1; min-width: 0; }
    .member-name-row { display: flex; align-items: center; gap: 0.375rem; }
    .member-name { font-size: 0.875rem; font-weight: 600; color: var(--rws-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .leader-chip {
      display: inline-flex; align-items: center; gap: 0.125rem;
      font-size: 0.5625rem; font-weight: 700; color: #92610a;
      background: #fef8e7; padding: 0.0625rem 0.3125rem; border-radius: 3px;
      svg { width: 9px; height: 9px; }
    }
    .member-status { font-size: 0.6875rem; font-weight: 500; }
    .txt-active { color: #167d72; }
    .txt-break { color: #92610a; }
    .txt-offline { color: var(--rws-text-muted); }

    /* ================================================ */
    /* SECTION 5: TEAM WORKLOAD                         */
    /* ================================================ */
    .workload-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 0.75rem;
    }
    .workload-card {
      background: #fff; border-radius: 10px; padding: 1rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
      display: flex; flex-direction: column; gap: 0.375rem;
    }
    .wl-icon {
      display: flex; align-items: center; justify-content: center;
      width: 32px; height: 32px; border-radius: 8px;
      svg { width: 16px; height: 16px; }
    }
    .wl-active { background: #e8f8f6; color: #167d72; }
    .wl-break { background: #fef3e2; color: #92610a; }
    .wl-offline { background: var(--rws-bg); color: var(--rws-text-muted); }
    .wl-project { background: #e8f1fb; color: #2b3a67; }
    .wl-complete { background: #e8f8f6; color: #167d72; }
    .wl-hours { background: #f3f0ff; color: #5b3e9e; }
    .wl-value { font-size: 1.125rem; font-weight: 700; color: var(--rws-text); }
    .wl-label { font-size: 0.6875rem; color: var(--rws-text-muted); text-transform: uppercase; letter-spacing: 0.03em; font-weight: 600; }

    /* ================================================ */
    /* ACTIVE PROJECT BAR                               */
    /* ================================================ */
    .active-bar {
      display: flex; align-items: center; justify-content: space-between;
      background: #fff; border-radius: 10px; padding: 0.875rem 1.25rem;
      margin-bottom: 1.25rem; border-left: 4px solid var(--bar-color, var(--rws-accent));
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    }
    .bar-left { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; }
    .bar-label { font-size: 0.6875rem; color: var(--rws-text-muted); text-transform: uppercase; letter-spacing: 0.04em; font-weight: 600; }
    .bar-name { font-size: 0.9375rem; font-weight: 700; color: var(--rws-text); }
    .bar-elapsed { font-size: 0.8125rem; color: var(--rws-text-muted); font-family: var(--rws-font-mono); }

    /* ================================================ */
    /* TOOLBAR (SEARCH + FILTERS + SORT)                */
    /* ================================================ */
    .toolbar {
      display: flex; align-items: center; gap: 0.75rem;
      margin-bottom: 1rem; flex-wrap: wrap;
    }
    .search-wrap { position: relative; flex: 1; min-width: 200px; max-width: 320px; }
    .search-icon {
      position: absolute; left: 10px; top: 50%; transform: translateY(-50%);
      width: 15px; height: 15px; color: var(--rws-text-muted); pointer-events: none;
    }
    .search-input {
      width: 100%; padding: 0.5rem 0.75rem 0.5rem 2rem;
      border: 1px solid var(--rws-border); border-radius: var(--rws-radius);
      font-size: 0.875rem; font-family: inherit; color: var(--rws-text);
      background: #fff; transition: border-color 150ms ease;
      &:focus { outline: none; border-color: var(--rws-accent); box-shadow: 0 0 0 2px rgba(31, 182, 166, 0.15); }
      &::placeholder { color: var(--rws-text-muted); }
    }
    .filter-chips { display: flex; gap: 0.375rem; flex-wrap: wrap; }
    .chip {
      padding: 0.3rem 0.75rem; border: 1px solid var(--rws-border);
      border-radius: 999px; font-size: 0.75rem; font-weight: 500;
      color: var(--rws-text-muted); background: #fff; cursor: pointer;
      font-family: inherit; white-space: nowrap; transition: all 150ms ease;
      &:hover { border-color: var(--rws-accent); color: var(--rws-accent); }
      &.active { background: var(--rws-accent); color: #fff; border-color: var(--rws-accent); }
    }
    .sort-wrap { position: relative; display: flex; align-items: center; svg { position: absolute; left: 10px; pointer-events: none; color: var(--rws-text-muted); } }
    .sort-select {
      padding: 0.45rem 0.75rem 0.45rem 2rem;
      border: 1px solid var(--rws-border); border-radius: var(--rws-radius);
      font-size: 0.8125rem; font-family: inherit; color: var(--rws-text);
      background: #fff; cursor: pointer; appearance: none;
      &:focus { outline: none; border-color: var(--rws-accent); }
    }

    /* ================================================ */
    /* SECTION 3: PROJECT CARDS                         */
    /* ================================================ */
    .project-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 1rem;
    }
    .project-card {
      background: #fff; border-radius: 12px; padding: 1.25rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
      cursor: pointer; transition: all 150ms ease;
      border: 1px solid transparent; outline: none;
      &:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.08); border-color: var(--card-color, var(--rws-accent)); }
      &:focus-visible { outline: 3px solid var(--rws-focus-ring); outline-offset: 2px; }
    }
    .card-top-row { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.625rem; }
    .card-status-badge {
      font-size: 0.6875rem; font-weight: 600; padding: 0.1875rem 0.5rem;
      border-radius: 999px; text-transform: capitalize;
      &.st-planning { background: #f3f4f6; color: #6b7280; }
      &.st-active { background: #e8f8f6; color: #167d72; }
      &.st-on_hold { background: #fef3e2; color: #92610a; }
      &.st-completed { background: #e8f8f6; color: #167d72; }
      &.st-cancelled { background: #fde8e8; color: #b91c1c; }
      &.st-archived { background: var(--rws-bg); color: var(--rws-text-muted); }
    }
    .card-prio-badge {
      font-size: 0.625rem; font-weight: 600; padding: 0.125rem 0.5rem;
      border-radius: 999px; text-transform: uppercase; letter-spacing: 0.03em;
      &.prio-low { background: #f3f4f6; color: #6b7280; }
      &.prio-medium { background: #e8f1fb; color: #2b3a67; }
      &.prio-high { background: #fef3e2; color: #92610a; }
      &.prio-critical { background: #fde8e8; color: #b91c1c; }
    }
    .assign-badge {
      display: inline-flex; align-items: center; gap: 0.25rem;
      font-size: 0.625rem; font-weight: 600; padding: 0.1875rem 0.5rem;
      border-radius: 999px; text-transform: capitalize; white-space: nowrap;
      background: #e8f1fb; color: #2b3a67;
      &.is-individual { background: #f3e8fd; color: #6b21a8; }
    }
    .assign-badge-sm { padding: 0.125rem 0.5rem; }
    .card-title { margin: 0 0 0.375rem; font-size: 1rem; font-weight: 600; color: var(--rws-text); }
    .card-desc {
      margin: 0 0 0.75rem; font-size: 0.8125rem; color: var(--rws-text-muted);
      line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
    }
    .progress-bar-track {
      height: 6px; background: #f0f2f5; border-radius: 999px; overflow: hidden; margin-bottom: 0.25rem;
    }
    .progress-bar-fill { height: 100%; background: var(--rws-accent); border-radius: 999px; transition: width 300ms ease; }
    .progress-label { font-size: 0.6875rem; color: var(--rws-text-muted); display: block; margin-bottom: 0.625rem; }
    .card-meta-row { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-bottom: 0.75rem; }
    .card-meta-item { display: inline-flex; align-items: center; gap: 0.25rem; font-size: 0.75rem; color: var(--rws-text-muted); }
    .card-footer-row {
      display: flex; align-items: center; justify-content: space-between;
      padding-top: 0.75rem; border-top: 1px solid #f0f2f5;
    }
    .my-contrib-badge { display: flex; flex-direction: column; gap: 0.0625rem; }
    .contrib-label { font-size: 0.625rem; color: var(--rws-text-muted); text-transform: uppercase; letter-spacing: 0.03em; font-weight: 600; }
    .contrib-value { font-size: 0.8125rem; font-weight: 600; color: var(--rws-text); }
    .card-view-link {
      display: inline-flex; align-items: center; gap: 0.25rem;
      font-size: 0.75rem; font-weight: 600; color: var(--rws-accent);
    }

    /* ── Pagination ─────────────────────────────────── */
    .pagination { display: flex; align-items: center; justify-content: center; gap: 0.75rem; margin-top: 1rem; }
    .page-info { font-size: 0.8125rem; color: var(--rws-text-muted); }

    /* ================================================ */
    /* SECTION 4: MY CONTRIBUTION TABLE                 */
    /* ================================================ */
    .contribution-table-wrap { overflow-x: auto; }
    .contribution-table {
      width: 100%; border-collapse: collapse;
      background: #fff; border-radius: 12px; overflow: hidden;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
      th, td { padding: 0.75rem 1rem; text-align: left; border-bottom: 1px solid #f0f2f5; font-size: 0.875rem; }
      th { font-weight: 600; color: var(--rws-text-muted); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em; background: #fafbfc; }
      td { color: var(--rws-text); }
      tbody tr { transition: background 150ms ease; &:hover { background: #fafbfc; } }
    }
    .contr-project { display: flex; align-items: center; gap: 0.5rem; }
    .contr-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .contr-value { font-weight: 600; font-family: var(--rws-font-mono); }
    .share-cell { display: flex; align-items: center; gap: 0.5rem; }
    .share-bar-track { width: 60px; height: 6px; background: #f0f2f5; border-radius: 999px; overflow: hidden; }
    .share-bar-fill { height: 100%; background: var(--rws-accent); border-radius: 999px; }

    /* ================================================ */
    /* DRAWER                                           */
    /* ================================================ */
    .drawer-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 90; animation: fade-in 150ms ease;
    }
    .drawer {
      position: fixed; top: 0; right: 0; bottom: 0;
      width: 440px; max-width: calc(100vw - 2rem);
      background: #fff; z-index: 91;
      display: flex; flex-direction: column;
      box-shadow: -8px 0 24px rgba(0,0,0,0.12);
      animation: slide-in 200ms ease;
    }
    .drawer-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--rws-border);
    }
    .drawer-title { margin: 0; font-size: 1.125rem; font-weight: 700; color: var(--rws-text); border-left: 3px solid var(--card-color, var(--rws-accent)); padding-left: 0.75rem; }
    .drawer-close {
      display: flex; align-items: center; justify-content: center;
      width: 28px; height: 28px; border: none; border-radius: var(--rws-radius);
      background: transparent; color: var(--rws-text-muted); cursor: pointer;
      &:hover { background: var(--rws-bg); color: var(--rws-text); }
    }
    .drawer-body { flex: 1; overflow-y: auto; padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: 1.25rem; }
    .drawer-section { display: flex; flex-direction: column; gap: 0.75rem; }
    .drawer-section-title { margin: 0; font-size: 0.8125rem; font-weight: 700; color: var(--rws-text); text-transform: uppercase; letter-spacing: 0.04em; }
    .drawer-badges { display: flex; gap: 0.5rem; }
    .drawer-field { display: flex; flex-direction: column; gap: 0.125rem; }
    .drawer-field-label { font-size: 0.6875rem; color: var(--rws-text-muted); text-transform: uppercase; letter-spacing: 0.03em; font-weight: 600; }
    .drawer-field-value { font-size: 0.875rem; font-weight: 500; color: var(--rws-text); }
    .drawer-desc { margin: 0; font-size: 0.875rem; color: var(--rws-text-muted); line-height: 1.6; }
    .drawer-progress { display: flex; flex-direction: column; gap: 0.375rem; margin-bottom: 0.75rem; }
    .progress-bar-track.lg { height: 10px; }
    .drawer-progress-label { font-size: 0.75rem; color: var(--rws-text-muted); font-weight: 500; }
    .drawer-stats-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.75rem; }
    .drawer-stat {
      background: var(--rws-bg); border-radius: 8px; padding: 0.75rem;
      display: flex; flex-direction: column; gap: 0.125rem;
    }
    .ds-value { font-size: 1rem; font-weight: 700; color: var(--rws-text); }
    .ds-label { font-size: 0.6875rem; color: var(--rws-text-muted); text-transform: uppercase; letter-spacing: 0.03em; font-weight: 600; }
    .drawer-contrib-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; }
    .dc-stat { background: var(--rws-bg); border-radius: 8px; padding: 0.625rem; display: flex; flex-direction: column; gap: 0.125rem; }
    .dc-value { font-size: 0.875rem; font-weight: 700; color: var(--rws-text); }
    .dc-label { font-size: 0.625rem; color: var(--rws-text-muted); text-transform: uppercase; letter-spacing: 0.03em; font-weight: 600; }

    .drawer-action-card {
      display: flex; align-items: center; gap: 0.625rem;
      padding: 0.75rem 1rem; border-radius: 8px;
      background: var(--rws-bg); cursor: pointer;
      font-size: 0.875rem; font-weight: 500; color: var(--rws-accent-strong);
      transition: background 150ms ease;
      &:hover { background: #e8f8f6; }
    }

    /* ── Buttons ────────────────────────────────────── */
    .btn {
      display: inline-flex; align-items: center; justify-content: center;
      gap: 0.375rem; padding: 0.5rem 1rem;
      border: none; border-radius: var(--rws-radius);
      font-size: 0.8125rem; font-weight: 600; cursor: pointer;
      font-family: inherit; transition: opacity 150ms ease;
      &:disabled { opacity: 0.5; cursor: not-allowed; }
      &:focus-visible { outline: 3px solid var(--rws-focus-ring); outline-offset: 2px; }
    }
    .btn-outline {
      background: transparent; color: var(--rws-text);
      border: 1px solid var(--rws-border);
      &:hover:not(:disabled) { border-color: var(--rws-error); color: var(--rws-error); background: #fef2f2; }
    }
    .btn-ghost {
      background: transparent; color: var(--rws-text-muted);
      border: 1px solid var(--rws-border);
      &:hover:not(:disabled) { background: var(--rws-bg); color: var(--rws-text); }
    }
    .btn-sm { padding: 0.375rem 0.75rem; }

    /* ── Toast ──────────────────────────────────────── */
    .toast {
      position: fixed; bottom: 1.5rem; left: 50%; transform: translateX(-50%);
      padding: 0.75rem 1.25rem; border-radius: var(--rws-radius);
      font-size: 0.875rem; font-weight: 500; z-index: 100;
      box-shadow: 0 8px 24px rgba(0,0,0,0.15); animation: toast-in 200ms ease;
    }
    .toast-success { background: #e8f8f6; color: #167d72; border: 1px solid #b3e8e3; }
    .toast-error { background: #fde8e8; color: #b91c1c; border: 1px solid #f5c6c6; }

    @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
    @keyframes slide-in { from { transform: translateX(100%); } to { transform: translateX(0); } }
    @keyframes toast-in { from { opacity: 0; transform: translateX(-50%) translateY(8px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }

    @media (max-width: 767px) {
      .members-grid { grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); }
      .project-grid { grid-template-columns: 1fr; }
      .workload-grid { grid-template-columns: repeat(2, 1fr); }
      .drawer { width: 100%; max-width: 100%; }
      .team-hero { flex-direction: column; }
      .meta-stats { flex-wrap: wrap; }
    }

    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
    }
  `],
})
export class EmployeeProjectsComponent implements OnInit {
  private readonly workspaceService = inject(WorkspaceService);
  private readonly projectsService = inject(ProjectsService);
  private readonly realtime = inject(RealtimeService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly workspace = signal<WorkspaceData | null>(null);
  protected readonly loading = signal(true);

  protected readonly activeAllocation = signal<ProjectAllocation | null>(null);
  protected readonly switchMessage = signal('');
  protected readonly switchSuccess = signal(false);
  protected readonly stopping = signal(false);
  protected readonly tick = signal(0);

  protected readonly searchQuery = signal('');
  protected readonly activeFilter = signal<FilterKey>('all');
  protected readonly activeSort = signal<SortKey>('name');
  protected readonly currentPage = signal(1);
  protected readonly pageSize = 9;

  protected readonly drawerProject = signal<WorkspaceProject | null>(null);

  protected readonly isLeader = computed(() => {
    const team = this.workspace()?.team;
    const user = this.workspace()?.user;
    return team?.leader?.id === user?.id;
  });

  protected readonly activeNow = computed(() => {
    const members = this.workspace()?.team?.members ?? [];
    return members.filter((m) => m.status === 'active').length;
  });

  protected readonly activeProject = computed(() => {
    const alloc = this.activeAllocation();
    if (!alloc?.projectId) return null;
    const projects = this.workspace()?.team?.projects ?? [];
    return projects.find((p) => p.id === alloc.projectId) ?? null;
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

  protected readonly filterPresets: { key: FilterKey; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Active' },
    { key: 'completed', label: 'Completed' },
    { key: 'highPriority', label: 'High Priority' },
    { key: 'dueThisWeek', label: 'Due This Week' },
    { key: 'dueThisMonth', label: 'Due This Month' },
  ];

  protected readonly filteredProjects = computed(() => {
    const projects = this.workspace()?.team?.projects ?? [];
    const query = this.searchQuery().toLowerCase().trim();
    const filter = this.activeFilter();
    const sort = this.activeSort();
    const now = new Date();
    const endOfWeek = new Date(now);
    endOfWeek.setDate(now.getDate() + (7 - now.getDay()));
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    let result = [...projects];

    if (query) {
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          (p.description ?? '').toLowerCase().includes(query) ||
          p.status.toLowerCase().includes(query) ||
          (p.priority ?? '').toLowerCase().includes(query),
      );
    }

    if (filter === 'active') {
      result = result.filter((p) => p.status === 'active');
    } else if (filter === 'completed') {
      result = result.filter((p) => p.status === 'completed');
    } else if (filter === 'highPriority') {
      result = result.filter((p) => p.priority === 'high' || p.priority === 'critical');
    } else if (filter === 'dueThisWeek') {
      result = result.filter((p) => p.expectedEnd && new Date(p.expectedEnd) <= endOfWeek);
    } else if (filter === 'dueThisMonth') {
      result = result.filter((p) => p.expectedEnd && new Date(p.expectedEnd) <= endOfMonth);
    }

    result.sort((a, b) => {
      switch (sort) {
        case 'name': return a.name.localeCompare(b.name);
        case 'deadline': return (a.expectedEnd ?? '').localeCompare(b.expectedEnd ?? '');
        case 'progress': return (b.progress ?? 0) - (a.progress ?? 0);
        case 'priority': {
          const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
          return (order[a.priority ?? 'medium'] ?? 2) - (order[b.priority ?? 'medium'] ?? 2);
        }
        case 'estimated': return (b.estimatedHours ?? 0) - (a.estimatedHours ?? 0);
        case 'worked': return b.totalHours - a.totalHours;
        default: return 0;
      }
    });

    return result;
  });

  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredProjects().length / this.pageSize)),
  );

  protected readonly paginatedProjects = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize;
    return this.filteredProjects().slice(start, start + this.pageSize);
  });

  private _tickInterval: ReturnType<typeof setInterval> | null = null;
  private searchTimeout: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.loadWorkspace();
    this._tickInterval = setInterval(() => this.tick.update((v) => v + 1), 30000);

    this.realtime.allocationChanged$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((event: AllocationChangedEvent) => {
      this.activeAllocation.set(
        event.allocationId
          ? { id: event.allocationId, startTime: event.startTime, projectId: event.projectId, projectName: event.projectName }
          : null,
      );
    });

    this.realtime.sessionChanged$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((event: SessionStatusEvent) => {
      this.workspace.update((w) => {
        if (!w?.team) return w;
        const members = w.team.members.map((m) => {
          if (m.id !== event.userId) return m;
          const status = event.status === 'completed' ? 'clocked_out' : (event.status as any);
          const start = event.clockIn ? new Date(event.clockIn).getTime() : 0;
          const end = event.clockOut ? new Date(event.clockOut).getTime() : Date.now();
          const breakMin = event.totalBreakMinutes || 0;
          const hoursToday = Math.max(0, ((end - start) / 60000 - breakMin) / 60);
          return { ...m, status, hoursToday: Math.round(hoursToday * 10) / 10 };
        });
        const workload = w.workload
          ? {
              ...w.workload,
              activeNow: members.filter((m) => m.status === 'active').length,
              onBreak: members.filter((m) => m.status === 'break').length,
              offline: members.filter((m) => m.status === 'clocked_out').length,
              hoursWorkedThisWeek: Math.round(members.reduce((s, m) => s + m.hoursToday, 0) * 10) / 10,
            }
          : null;
        return { ...w, team: { ...w.team, members }, workload };
      });
    });
  }

  private loadWorkspace(): void {
    this.loading.set(true);
    this.workspaceService.getMyWorkspace().subscribe({
      next: (res) => {
        this.workspace.set(res.workspace);
        this.loading.set(false);
        this.loadActiveAllocation();
      },
      error: () => this.loading.set(false),
    });
  }

  private loadActiveAllocation(): void {
    this.projectsService.getActiveAllocation().subscribe({
      next: (res) => this.activeAllocation.set(res.allocation),
    });
  }

  protected onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (this.searchTimeout) clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.searchQuery.set(value);
      this.currentPage.set(1);
    }, 250);
  }

  protected onSortChange(event: Event): void {
    this.activeSort.set((event.target as HTMLSelectElement).value as SortKey);
    this.currentPage.set(1);
  }

  protected goToPage(page: number): void {
    if (page < 1 || page > this.totalPages()) return;
    this.currentPage.set(page);
  }

  protected openDrawer(project: WorkspaceProject): void {
    this.drawerProject.set(project);
  }

  protected closeDrawer(): void {
    this.drawerProject.set(null);
  }

  protected switchToProject(project: WorkspaceProject | Project): void {
    if (this.activeAllocation()?.projectId === project.id) return;
    this.projectsService.switchProject(project.id).subscribe({
      next: (res) => {
        this.activeAllocation.set(res.allocation);
        this.showToast(`Switched to "${project.name}"`, true);
      },
      error: () => this.showToast('Failed to switch project', false),
    });
  }

  protected stopProject(): void {
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

  protected statusLabel(value: string): string {
    const map: Record<string, string> = {
      active: 'Active',
      break: 'On Break',
      completed: 'Completed',
      planning: 'Planning',
      on_hold: 'On Hold',
      cancelled: 'Cancelled',
      archived: 'Archived',
      clocked_out: 'Offline',
      idle: 'Idle',
    };
    return map[value] ?? value;
  }

  protected remainingHours(project: WorkspaceProject): number {
    if (!project.estimatedHours) return 0;
    return Math.max(0, Math.round((project.estimatedHours - project.totalHours) * 10) / 10);
  }

  private showToast(message: string, success: boolean): void {
    this.switchMessage.set(message);
    this.switchSuccess.set(success);
    setTimeout(() => this.switchMessage.set(''), 3000);
  }
}
