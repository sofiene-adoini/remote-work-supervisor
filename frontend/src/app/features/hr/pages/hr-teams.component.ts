import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import {
  LucideUsers, LucidePlus, LucideX, LucideArrowRight,
  LucideSearch, LucideTrash2, LucideChevronLeft, LucideChevronRight,
  LucideChevronDown, LucideCrown, LucideBriefcase, LucideRefreshCw,
} from '@lucide/angular';
import { HrTeamsService } from '../services/hr-teams.service';
import { HrTeam, HrUnassignedEmployee } from '../models/hr.models';

type FilterPreset = 'all' | 'active' | 'hasLeader' | 'noLeader' | 'empty';
type SortKey = 'nameAsc' | 'nameDesc' | 'membersDesc' | 'membersAsc' | 'newest' | 'oldest';

@Component({
  selector: 'app-hr-teams',
  imports: [
    RouterLink, FormsModule, DatePipe,
    LucideUsers, LucidePlus, LucideX, LucideArrowRight,
    LucideSearch, LucideTrash2, LucideChevronLeft, LucideChevronRight,
    LucideChevronDown, LucideCrown, LucideBriefcase, LucideRefreshCw,
  ],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div class="header-left">
          <h1 class="page-title">Teams</h1>
          <span class="result-count">{{ totalCount() }} teams</span>
        </div>
        <div class="header-actions">
          <button class="btn btn-ghost btn-sm" type="button" (click)="loadTeams()" title="Refresh">
            <svg lucideRefreshCw class="icon-sm" aria-hidden="true"></svg>
          </button>
          <button class="btn btn-primary" type="button" (click)="openCreateDialog()">
            <svg lucidePlus class="icon-sm" aria-hidden="true"></svg>
            New Team
          </button>
        </div>
      </div>

      @if (loading()) {
        <div class="sk-grid">
          @for (i of [1,2,3,4,5,6]; track i) {
            <div class="sk-card-lg"></div>
          }
        </div>
      } @else {
        <div class="toolbar">
          <div class="search-wrap">
            <svg lucideSearch class="search-icon" aria-hidden="true"></svg>
            <input
              type="text"
              class="search-input"
              placeholder="Search teams..."
              [value]="searchQuery()"
              (input)="onSearchInput($event)" />
          </div>

          <div class="filter-chips">
            @for (preset of filterPresets; track preset.key) {
              <button
                class="chip"
                [class.active]="activeFilter() === preset.key"
                type="button"
                (click)="activeFilter.set(preset.key)">
                {{ preset.label }}
              </button>
            }
          </div>

          <div class="sort-wrap">
            <svg lucideChevronDown class="icon-xs" aria-hidden="true"></svg>
            <select class="sort-select" [value]="activeSort()" (change)="onSortChange($event)">
              <option value="nameAsc">A–Z</option>
              <option value="nameDesc">Z–A</option>
              <option value="membersDesc">Most members</option>
              <option value="membersAsc">Fewest members</option>
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
            </select>
          </div>
        </div>

        @if (teams().length === 0) {
          <div class="empty-state">
            <svg lucideUsers class="empty-icon"></svg>
            <p class="empty-title">No teams yet</p>
            <p class="empty-sub">Click "New Team" to create your first team.</p>
          </div>
        } @else if (filtered().length === 0) {
          <div class="empty-state">
            <svg lucideSearch class="empty-icon"></svg>
            <p class="empty-title">No teams match your search</p>
            <p class="empty-sub">Try a different search term or filter.</p>
          </div>
        } @else {
          <div class="teams-grid">
            @for (team of paginated(); track team.id) {
              <div class="team-card">
                <div class="card-top">
                  <div class="card-icon-wrap">
                    <svg lucideUsers class="card-icon-main" aria-hidden="true"></svg>
                  </div>
                  <div class="card-actions">
                    <button
                      class="btn-icon btn-icon-danger"
                      type="button"
                      (click)="confirmDelete(team)"
                      title="Delete team">
                      <svg lucideTrash2 class="icon-xs" aria-hidden="true"></svg>
                    </button>
                  </div>
                </div>

                <div class="card-body">
                  <h3 class="card-name">{{ team.name }}</h3>
                  @if (team.description) {
                    <p class="card-desc">{{ team.description }}</p>
                  }

                  <div class="card-meta">
                    @if (team.leader) {
                      <span class="meta-badge leader-badge">
                        <svg lucideCrown class="icon-xs" aria-hidden="true"></svg>
                        {{ team.leader.fullName }}
                      </span>
                    } @else {
                      <span class="meta-badge no-leader">No leader</span>
                    }

                    <span class="meta-item">
                      <svg lucideUsers class="icon-xs" aria-hidden="true"></svg>
                      {{ team.memberCount }} member{{ team.memberCount === 1 ? '' : 's' }}
                    </span>

                    @if (team.projectCount > 0) {
                      <span class="meta-item">
                        <svg lucideBriefcase class="icon-xs" aria-hidden="true"></svg>
                        {{ team.projectCount }} project{{ team.projectCount === 1 ? '' : 's' }}
                      </span>
                    }
                  </div>
                </div>

                <div class="card-footer">
                  <span class="card-date">
                    @if (team.createdAt) {
                      Created {{ team.createdAt | date:'mediumDate' }}
                    }
                  </span>
                  <a [routerLink]="['/hr/teams', team.id]" class="card-link">
                    View
                    <svg lucideArrowRight class="icon-xs" aria-hidden="true"></svg>
                  </a>
                </div>
              </div>
            }
          </div>

          @if (totalPages() > 1) {
            <div class="pagination">
              <button
                class="btn btn-ghost btn-sm"
                [disabled]="currentPage() === 1"
                (click)="goToPage(currentPage() - 1)">
                <svg lucideChevronLeft class="icon-sm" aria-hidden="true"></svg>
                Previous
              </button>

              <div class="page-numbers">
                @for (p of pageNumbers(); track $index) {
                  @if (p === 0) {
                    <span class="page-ellipsis">...</span>
                  } @else {
                    <button
                      class="page-btn"
                      [class.active]="p === currentPage()"
                      (click)="goToPage(p)">
                      {{ p }}
                    </button>
                  }
                }
              </div>

              <button
                class="btn btn-ghost btn-sm"
                [disabled]="currentPage() === totalPages()"
                (click)="goToPage(currentPage() + 1)">
                Next
                <svg lucideChevronRight class="icon-sm" aria-hidden="true"></svg>
              </button>

              <span class="page-info">{{ rangeStart() }}–{{ rangeEnd() }} of {{ totalCount() }}</span>
            </div>
          }
        }
      }
    </div>

    @if (deleteTarget()) {
      <div class="dialog-overlay" (click)="deleteTarget.set(null)"></div>
      <div class="dialog dialog-sm" role="dialog" aria-modal="true" aria-label="Delete team">
        <div class="dialog-header">
          <h2 class="dialog-title">Delete Team</h2>
          <button class="dialog-close" type="button" (click)="deleteTarget.set(null)" aria-label="Close">
            <svg lucideX class="icon-sm" aria-hidden="true"></svg>
          </button>
        </div>
        <div class="dialog-body">
          <p class="confirm-text">
            Are you sure you want to delete <strong>{{ deleteTarget()?.name }}</strong>?
            Members will be unassigned from this team. This action cannot be undone.
          </p>
        </div>
        <div class="dialog-footer">
          <button class="btn btn-secondary" type="button" (click)="deleteTarget.set(null)">Cancel</button>
          <button class="btn btn-danger" type="button" (click)="submitDelete()" [disabled]="deleting()">
            {{ deleting() ? 'Deleting...' : 'Delete Team' }}
          </button>
        </div>
      </div>
    }

    @if (createDialogOpen()) {
      <div class="dialog-overlay" (click)="closeCreateDialog()"></div>
      <div class="dialog" role="dialog" aria-modal="true" aria-label="New Team">
        <div class="dialog-header">
          <h2 class="dialog-title">New Team</h2>
          <button class="dialog-close" type="button" (click)="closeCreateDialog()" aria-label="Close">
            <svg lucideX class="icon-sm" aria-hidden="true"></svg>
          </button>
        </div>
        <div class="dialog-body">
          <div class="form-group">
            <label class="form-label" for="team-name">Team Name *</label>
            <input class="form-input" id="team-name" type="text" [(ngModel)]="createName" placeholder="e.g. Engineering">
          </div>

          <div class="form-group">
            <label class="form-label" for="team-desc">Description</label>
            <textarea class="form-input form-textarea" id="team-desc" [(ngModel)]="createDescription" rows="2" placeholder="What does this team work on?"></textarea>
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

          @if (createError()) {
            <p class="form-error">{{ createError() }}</p>
          }
        </div>
        <div class="dialog-footer">
          <button class="btn btn-secondary" type="button" (click)="closeCreateDialog()">Cancel</button>
          <button class="btn btn-primary" type="button" (click)="submitCreate()" [disabled]="creating()">
            {{ creating() ? 'Creating...' : 'Create Team' }}
          </button>
        </div>
      </div>
    }
  `,
  styles: [`
    @use 'styles/design-tokens' as t;

    .page-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1.5rem;
      flex-wrap: wrap;
      gap: 0.75rem;
    }

    .header-left {
      display: flex;
      align-items: baseline;
      gap: 0.75rem;
    }

    .page-title { margin: 0; font-size: 1.375rem; font-weight: 700; color: var(--rws-text); }

    .result-count {
      font-size: 0.8125rem;
      color: var(--rws-text-muted);
    }

    .header-actions {
      display: flex;
      gap: 0.5rem;
    }

    .icon-sm { width: 16px; height: 16px; }
    .icon-xs { width: 14px; height: 14px; }

    .toolbar {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 1.25rem;
      flex-wrap: wrap;
    }

    .search-wrap {
      position: relative;
      flex: 1;
      min-width: 200px;
      max-width: 360px;
    }

    .search-icon {
      position: absolute;
      left: 10px;
      top: 50%;
      transform: translateY(-50%);
      width: 15px;
      height: 15px;
      color: var(--rws-text-muted);
      pointer-events: none;
    }

    .search-input {
      width: 100%;
      padding: 0.5rem 0.75rem 0.5rem 2rem;
      border: 1px solid var(--rws-border);
      border-radius: var(--rws-radius);
      font-size: 0.875rem;
      font-family: inherit;
      color: var(--rws-text);
      background: #fff;
      transition: border-color 150ms ease;
      &:focus { outline: none; border-color: var(--rws-accent); box-shadow: 0 0 0 2px rgba(31, 182, 166, 0.15); }
      &::placeholder { color: var(--rws-text-muted); }
    }

    .filter-chips {
      display: flex;
      gap: 0.375rem;
      flex-wrap: wrap;
    }

    .chip {
      padding: 0.3rem 0.75rem;
      border: 1px solid var(--rws-border);
      border-radius: 999px;
      font-size: 0.75rem;
      font-weight: 500;
      color: var(--rws-text-muted);
      background: #fff;
      cursor: pointer;
      font-family: inherit;
      white-space: nowrap;
      transition: all 150ms ease;
      &:hover { border-color: var(--rws-accent); color: var(--rws-accent); }
      &.active { background: var(--rws-accent); color: #fff; border-color: var(--rws-accent); }
    }

    .sort-wrap {
      position: relative;
      display: flex;
      align-items: center;
      svg { position: absolute; left: 10px; pointer-events: none; color: var(--rws-text-muted); }
    }

    .sort-select {
      padding: 0.45rem 0.75rem 0.45rem 2rem;
      border: 1px solid var(--rws-border);
      border-radius: var(--rws-radius);
      font-size: 0.8125rem;
      font-family: inherit;
      color: var(--rws-text);
      background: #fff;
      cursor: pointer;
      appearance: none;
      &:focus { outline: none; border-color: var(--rws-accent); }
    }

    .teams-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 1rem;
    }

    .team-card {
      background: #fff;
      border-radius: 12px;
      border: 1px solid transparent;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
      display: flex;
      flex-direction: column;
      transition: border-color 150ms ease, box-shadow 150ms ease;
      &:hover { border-color: var(--rws-accent); box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08); }
    }

    .card-top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      padding: 1rem 1rem 0;
    }

    .card-icon-wrap {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      border-radius: 10px;
      background: #e8f1fb;
      flex-shrink: 0;
    }

    .card-icon-main { width: 18px; height: 18px; color: var(--rws-primary); }

    .card-actions {
      display: flex;
      gap: 0.25rem;
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
      transition: all 150ms ease;
      text-decoration: none;
      &:hover { background: var(--rws-bg); color: var(--rws-text); }
    }

    .btn-icon-danger:hover { background: #fde8e8; color: #b91c1c; }

    .card-body { padding: 0.75rem 1rem 0.5rem; flex: 1; }

    .card-name { margin: 0 0 0.25rem; font-size: 1rem; font-weight: 600; color: var(--rws-text); }

    .card-desc {
      margin: 0 0 0.75rem;
      font-size: 0.8125rem;
      color: var(--rws-text-muted);
      line-height: 1.5;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .card-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      align-items: center;
    }

    .meta-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.2rem 0.5rem;
      border-radius: 6px;
      font-size: 0.6875rem;
      font-weight: 600;
    }

    .leader-badge { background: #fef8e7; color: #92610a; }
    .no-leader { background: var(--rws-bg); color: var(--rws-text-muted); }

    .meta-item {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      font-size: 0.75rem;
      color: var(--rws-text-muted);
      svg { width: 12px; height: 12px; }
    }

    .card-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.625rem 1rem;
      border-top: 1px solid #f0f2f5;
    }

    .card-date { font-size: 0.6875rem; color: var(--rws-text-muted); }

    .card-link {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--rws-accent);
      text-decoration: none;
      &:hover { color: var(--rws-accent-strong); }
    }

    .pagination {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      margin-top: 1.5rem;
      flex-wrap: wrap;
    }

    .page-numbers {
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }

    .page-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 32px;
      height: 32px;
      border: 1px solid var(--rws-border);
      border-radius: var(--rws-radius);
      background: #fff;
      font-size: 0.8125rem;
      font-weight: 500;
      color: var(--rws-text);
      cursor: pointer;
      font-family: inherit;
      transition: all 150ms ease;
      &:hover { border-color: var(--rws-accent); color: var(--rws-accent); }
      &.active { background: var(--rws-accent); color: #fff; border-color: var(--rws-accent); }
    }

    .page-ellipsis { padding: 0 0.25rem; color: var(--rws-text-muted); font-size: 0.8125rem; }
    .page-info { font-size: 0.75rem; color: var(--rws-text-muted); margin-left: 0.5rem; }

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
    .btn-danger { background: #dc2626; color: #fff; }

    .btn-ghost {
      background: transparent;
      color: var(--rws-text-muted);
      border: 1px solid var(--rws-border);
      &:hover:not(:disabled) { background: var(--rws-bg); color: var(--rws-text); }
    }

    .btn-sm { padding: 0.375rem 0.75rem; font-size: 0.8125rem; }

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

    .sk-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1rem; }

    .sk-card-lg {
      height: 180px;
      background: #f0f2f5;
      border-radius: 12px;
      animation: sk-pulse 1.5s infinite;
    }

    @keyframes sk-pulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 0.3; } }

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

    .dialog-sm { width: 400px; }

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

    .confirm-text { margin: 0; font-size: 0.9rem; color: var(--rws-text); line-height: 1.6; }

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

    .form-textarea { resize: vertical; min-height: 60px; }

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
  protected readonly searchQuery = signal('');
  protected readonly activeFilter = signal<FilterPreset>('all');
  protected readonly activeSort = signal<SortKey>('nameAsc');
  protected readonly currentPage = signal(1);
  protected readonly pageSize = 12;

  protected readonly totalCount = computed(() => this.filtered().length);
  protected readonly totalPages = computed(() => Math.max(1, Math.ceil(this.totalCount() / this.pageSize)));

  protected readonly rangeStart = computed(() => (this.currentPage() - 1) * this.pageSize + 1);
  protected readonly rangeEnd = computed(() => Math.min(this.currentPage() * this.pageSize, this.totalCount()));

  protected readonly filterPresets: { key: FilterPreset; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Active teams' },
    { key: 'hasLeader', label: 'Has leader' },
    { key: 'noLeader', label: 'No leader' },
    { key: 'empty', label: 'Empty teams' },
  ];

  protected readonly filtered = computed(() => {
    let result = this.teams();
    const query = this.searchQuery().toLowerCase().trim();

    const filter = this.activeFilter();
    if (filter === 'active') {
      result = result.filter((t) => t.memberCount > 0);
    } else if (filter === 'hasLeader') {
      result = result.filter((t) => t.leader !== null);
    } else if (filter === 'noLeader') {
      result = result.filter((t) => t.leader === null);
    } else if (filter === 'empty') {
      result = result.filter((t) => t.memberCount === 0);
    }

    if (query) {
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(query) ||
          (t.description ?? '').toLowerCase().includes(query) ||
          (t.leader?.fullName ?? '').toLowerCase().includes(query),
      );
    }

    const sort = this.activeSort();
    result = [...result].sort((a, b) => {
      switch (sort) {
        case 'nameAsc': return a.name.localeCompare(b.name);
        case 'nameDesc': return b.name.localeCompare(a.name);
        case 'membersDesc': return b.memberCount - a.memberCount;
        case 'membersAsc': return a.memberCount - b.memberCount;
        case 'newest': return (b.createdAt ?? '').localeCompare(a.createdAt ?? '');
        case 'oldest': return (a.createdAt ?? '').localeCompare(b.createdAt ?? '');
        default: return 0;
      }
    });

    return result;
  });

  protected readonly paginated = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize;
    return this.filtered().slice(start, start + this.pageSize);
  });

  protected readonly pageNumbers = computed(() => {
    const total = this.totalPages();
    const current = this.currentPage();
    const pages: number[] = [];
    if (total <= 7) {
      for (let i = 1; i <= total; i++) pages.push(i);
    } else {
      pages.push(1);
      if (current > 3) pages.push(0);
      for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i);
      if (current < total - 2) pages.push(0);
      pages.push(total);
    }
    return pages;
  });

  protected readonly deleteTarget = signal<HrTeam | null>(null);
  protected readonly deleting = signal(false);

  protected readonly createDialogOpen = signal(false);
  protected createName = '';
  protected createDescription = '';
  protected readonly selectedMemberIds = signal<Set<number>>(new Set());
  protected readonly unassignedEmployees = signal<HrUnassignedEmployee[]>([]);
  protected readonly creating = signal(false);
  protected readonly createError = signal('');

  private searchTimeout: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.loadTeams();
  }

  protected loadTeams(): void {
    this.loading.set(true);
    this.teamsService.getTeams().subscribe({
      next: (res) => {
        this.teams.set(res.teams);
        this.loading.set(false);
        this.currentPage.set(1);
      },
      error: () => this.loading.set(false),
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

  protected confirmDelete(team: HrTeam): void {
    this.deleteTarget.set(team);
  }

  protected submitDelete(): void {
    const team = this.deleteTarget();
    if (!team) return;
    this.deleting.set(true);
    this.teamsService.deleteTeam(team.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.deleteTarget.set(null);
        this.loadTeams();
      },
      error: () => {
        this.deleting.set(false);
      },
    });
  }

  protected openCreateDialog(): void {
    this.createName = '';
    this.createDescription = '';
    this.selectedMemberIds.set(new Set());
    this.createError.set('');
    this.createDialogOpen.set(true);
    this.teamsService.getUnassignedEmployees().subscribe({
      next: (res) => this.unassignedEmployees.set(res.employees),
      error: () => this.unassignedEmployees.set([]),
    });
  }

  protected closeCreateDialog(): void {
    this.createDialogOpen.set(false);
  }

  protected isMemberSelected(id: number): boolean {
    return this.selectedMemberIds().has(id);
  }

  protected toggleMember(id: number): void {
    this.selectedMemberIds.update((set) => {
      const next = new Set(set);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }

  protected submitCreate(): void {
    this.createError.set('');
    if (!this.createName.trim()) {
      this.createError.set('Team name is required');
      return;
    }
    const memberIds = Array.from(this.selectedMemberIds());
    this.creating.set(true);
    this.teamsService.createTeam({
      name: this.createName.trim(),
      description: this.createDescription.trim() || undefined,
      ...(memberIds.length > 0 ? { memberIds } : {}),
    }).subscribe({
      next: () => {
        this.creating.set(false);
        this.closeCreateDialog();
        this.loadTeams();
      },
      error: (err) => {
        this.creating.set(false);
        this.createError.set(err.error?.error?.message || 'Failed to create team');
      },
    });
  }
}
