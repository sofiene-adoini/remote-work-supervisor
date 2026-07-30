import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TitleCasePipe } from '@angular/common';
import {
  LucideUsers, LucidePlus, LucideX, LucideArrowLeft,
  LucideCrown, LucideBriefcase,
} from '@lucide/angular';
import { HrTeamsService } from '../services/hr-teams.service';
import { HrTeamMember, HrUnassignedEmployee, HrTeamDetail } from '../models/hr.models';

@Component({
  selector: 'app-hr-team-detail',
  imports: [
    FormsModule, RouterLink, TitleCasePipe,
    LucideUsers, LucidePlus, LucideX, LucideArrowLeft,
    LucideCrown, LucideBriefcase,
  ],
  template: `
    <div class="page-container">
      @if (loading()) {
        <div class="sk-hero"></div>
        <div class="sk-grid-inline">
          @for (i of [1,2,3,4]; track i) { <div class="sk-stat"></div> }
        </div>
        <div class="card"><div class="sk-list-padded">@for (i of [1,2,3]; track i) { <div class="sk sk-row"></div> }</div></div>
      } @else if (detail()) {
        @let d = detail()!;
        <!-- Hero -->
        <div class="hero">
          <div class="hero-top">
            <div class="header-left">
              <a routerLink="/hr/teams" class="back-link">
                <svg lucideArrowLeft class="icon-sm" aria-hidden="true"></svg>
              </a>
              <div>
                <h1 class="hero-title">{{ d.name }}</h1>
                @if (d.description) {
                  <p class="hero-desc">{{ d.description }}</p>
                }
              </div>
            </div>
            <div class="header-actions">
              <button class="btn btn-primary" type="button" (click)="openAddMembersDialog()">
                <svg lucidePlus class="icon-sm" aria-hidden="true"></svg>
                Add Members
              </button>
            </div>
          </div>
        </div>

        <!-- Stats Grid -->
        <div class="stats-grid">
          <div class="stat-card">
            <span class="stat-value">{{ d.memberCount }}</span>
            <span class="stat-label">Total members</span>
          </div>
          <div class="stat-card">
            <span class="stat-value">{{ activeNow() }}</span>
            <span class="stat-label">Active now</span>
          </div>
          <div class="stat-card">
            <span class="stat-value">{{ onBreak() }}</span>
            <span class="stat-label">On break</span>
          </div>
          <div class="stat-card">
            <span class="stat-value">{{ offline() }}</span>
            <span class="stat-label">Offline</span>
          </div>
          <div class="stat-card">
            <span class="stat-value">{{ totalHoursToday() }}h</span>
            <span class="stat-label">Hours today</span>
          </div>
          <div class="stat-card">
            <span class="stat-value">{{ d.projectCount }}</span>
            <span class="stat-label">Projects</span>
          </div>
        </div>

        <!-- Leader Section -->
        <div class="section">
          <h2 class="section-title">Team Lead</h2>
          <div class="leader-card">
            @if (d.leader) {
              <div class="leader-info">
                <div class="avatar-md">{{ d.leader.fullName.charAt(0) }}</div>
                <div>
                  <div class="leader-name">{{ d.leader.fullName }}</div>
                  <div class="leader-email">{{ d.leader.email }}</div>
                </div>
                <span class="leader-badge">
                  <svg lucideCrown class="icon-xs" aria-hidden="true"></svg>
                  Leader
                </span>
              </div>
            } @else {
              <div class="leader-empty">
                <svg lucideCrown class="leader-empty-icon" aria-hidden="true"></svg>
                <span>No leader assigned</span>
              </div>
            }
            <button class="btn btn-ghost btn-sm" type="button" (click)="leaderAssignOpen.set(!leaderAssignOpen())">
              {{ d.leader ? 'Change' : 'Assign Leader' }}
            </button>
          </div>
          @if (leaderAssignOpen()) {
            <div class="leader-assign">
              <p class="assign-hint">Select a member to be the team leader:</p>
              <select class="form-input" [value]="selectedLeaderId()" (change)="onLeaderSelect($event)">
                <option value="">— None —</option>
                @for (m of d.members; track m.id) {
                  <option [value]="m.id">{{ m.fullName }}</option>
                }
              </select>
              <div class="assign-actions">
                <button class="btn btn-secondary btn-sm" type="button" (click)="leaderAssignOpen.set(false)">Cancel</button>
                <button class="btn btn-primary btn-sm" type="button" (click)="submitAssignLeader()" [disabled]="leaderSubmitting()">
                  {{ leaderSubmitting() ? 'Saving...' : 'Save' }}
                </button>
              </div>
            </div>
          }
        </div>

        <!-- Members Section -->
        <div class="section">
          <div class="section-header">
            <h2 class="section-title">Members <span class="count-badge">{{ d.members.length }}</span></h2>
          </div>
          @if (d.members.length === 0) {
            <div class="empty-state-sm">
              <svg lucideUsers class="empty-icon-sm"></svg>
              <p class="empty-title-sm">No members yet</p>
              <p class="empty-sub-sm">Click "Add Members" to add employees to this team.</p>
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
                      <th>Hours Today</th>
                      <th class="col-action"></th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (member of d.members; track member.id) {
                      <tr>
                        <td>
                          <div class="name-cell">
                            <div class="avatar-sm" [class.leader-avatar]="member.isLeader">{{ member.fullName.charAt(0) }}</div>
                            <span>{{ member.fullName }}</span>
                            @if (member.isLeader) {
                              <span class="leader-chip">
                                <svg lucideCrown class="icon-xs" aria-hidden="true"></svg>
                                Lead
                              </span>
                            }
                          </div>
                        </td>
                        <td class="email-cell">{{ member.email }}</td>
                        <td>
                          <span class="status-badge" [class]="'status-' + member.status">
                            <span class="status-dot-sm"></span>
                            {{ member.status === 'clocked_out' ? 'Offline' : (member.status | titlecase) }}
                          </span>
                        </td>
                        <td class="hours-cell">{{ member.hoursToday }}h</td>
                        <td class="col-action">
                          @if (!member.isLeader) {
                            <button class="btn-remove" type="button" (click)="removeMember(member.id)" aria-label="Remove member">
                              <svg lucideX class="icon-xs" aria-hidden="true"></svg>
                            </button>
                          }
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          }
        </div>

        <!-- Projects Section -->
        <div class="section">
          <h2 class="section-title">Projects <span class="count-badge">{{ d.projectCount }}</span></h2>
          @if (d.projects.length === 0) {
            <div class="empty-state-sm">
              <svg lucideBriefcase class="empty-icon-sm" aria-hidden="true"></svg>
              <p class="empty-title-sm">No projects assigned</p>
              <p class="empty-sub-sm">Projects can be assigned to this team from the Projects page.</p>
            </div>
          } @else {
            <div class="card">
              <div class="projects-list">
                @for (proj of d.projects; track proj.id) {
                  <div class="project-row">
                    <div class="project-icon-wrap">
                      <svg lucideBriefcase class="icon-sm" aria-hidden="true"></svg>
                    </div>
                    <span class="project-name">{{ proj.name }}</span>
                  </div>
                }
              </div>
            </div>
          }
        </div>
      }

      <!-- Add Members Dialog -->
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
                      <span class="member-email">{{ emp.email }}</span>
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

    .icon-sm { width: 16px; height: 16px; }
    .icon-xs { width: 13px; height: 13px; }

    .header-left {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
    }

    .header-actions {
      display: flex;
      gap: 0.5rem;
      flex-shrink: 0;
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
      flex-shrink: 0;
      margin-top: 2px;
      transition: background 150ms ease, color 150ms ease;
      &:hover { background: var(--rws-bg); color: var(--rws-text); }
    }

    .hero {
      margin-bottom: 1.5rem;
    }

    .hero-top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .hero-title { margin: 0 0 0.25rem; font-size: 1.375rem; font-weight: 700; color: var(--rws-text); }
    .hero-desc { margin: 0; font-size: 0.875rem; color: var(--rws-text-muted); line-height: 1.5; }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 0.75rem;
      margin-bottom: 1.5rem;
    }

    .stat-card {
      background: #fff;
      border-radius: 10px;
      padding: 1rem;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .stat-value { font-size: 1.375rem; font-weight: 700; color: var(--rws-text); }
    .stat-label { font-size: 0.75rem; color: var(--rws-text-muted); text-transform: uppercase; letter-spacing: 0.03em; font-weight: 600; }

    .section { margin-bottom: 1.5rem; }

    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 0.75rem;
    }

    .section-title {
      margin: 0 0 0.75rem;
      font-size: 1rem;
      font-weight: 700;
      color: var(--rws-text);
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .section-header .section-title { margin-bottom: 0; }

    .count-badge {
      font-size: 0.6875rem;
      font-weight: 600;
      color: var(--rws-text-muted);
      background: var(--rws-bg);
      padding: 0.125rem 0.5rem;
      border-radius: 999px;
    }

    .leader-card {
      background: #fff;
      border-radius: 10px;
      padding: 1rem 1.25rem;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }

    .leader-info {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex: 1;
    }

    .avatar-md {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--rws-primary), var(--rws-accent));
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.875rem;
      font-weight: 700;
      color: #fff;
      flex-shrink: 0;
    }

    .leader-name { font-size: 0.9375rem; font-weight: 600; color: var(--rws-text); }
    .leader-email { font-size: 0.8125rem; color: var(--rws-text-muted); }

    .leader-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.25rem 0.625rem;
      border-radius: 6px;
      background: #fef8e7;
      color: #92610a;
      font-size: 0.6875rem;
      font-weight: 600;
    }

    .leader-empty {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: var(--rws-text-muted);
      font-size: 0.875rem;
    }

    .leader-empty-icon { width: 20px; height: 20px; opacity: 0.5; }

    .leader-assign {
      margin-top: 0.75rem;
      background: #fff;
      border-radius: 10px;
      padding: 1rem;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
    }

    .assign-hint { margin: 0 0 0.5rem; font-size: 0.8125rem; color: var(--rws-text-muted); }

    .assign-actions {
      display: flex;
      gap: 0.5rem;
      margin-top: 0.75rem;
      justify-content: flex-end;
    }

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
      tbody tr { transition: background 150ms ease; &:hover { background: #fafbfc; } }
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

    .leader-avatar { box-shadow: 0 0 0 2px #f5b342; }

    .leader-chip {
      display: inline-flex;
      align-items: center;
      gap: 0.125rem;
      font-size: 0.625rem;
      font-weight: 700;
      color: #92610a;
      background: #fef8e7;
      padding: 0.125rem 0.375rem;
      border-radius: 4px;
      svg { width: 10px; height: 10px; }
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

    .hours-cell { font-weight: 600; color: var(--rws-text); }
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

    .projects-list { padding: 0.5rem 0; }

    .project-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.625rem 1rem;
      transition: background 150ms ease;
      &:hover { background: #fafbfc; }
    }

    .project-icon-wrap {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: 8px;
      background: #e8f1fb;
      color: var(--rws-primary);
      flex-shrink: 0;
    }

    .project-name { font-size: 0.875rem; font-weight: 500; color: var(--rws-text); }

    .empty-state-sm {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 2rem;
      text-align: center;
    }

    .empty-icon-sm { width: 32px; height: 32px; color: var(--rws-text-muted); opacity: 0.4; margin-bottom: 0.5rem; }
    .empty-title-sm { margin: 0 0 0.125rem; font-size: 0.9375rem; font-weight: 600; color: var(--rws-text); }
    .empty-sub-sm { margin: 0; font-size: 0.8125rem; color: var(--rws-text-muted); }

    .sk-hero { height: 40px; background: #f0f2f5; border-radius: 8px; margin-bottom: 1.5rem; animation: sk-pulse 1.5s infinite; }
    .sk-grid-inline { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 0.75rem; margin-bottom: 1.5rem; }
    .sk-stat { height: 80px; background: #f0f2f5; border-radius: 10px; animation: sk-pulse 1.5s infinite; }
    .sk-list-padded { padding: 0.75rem 1rem; display: flex; flex-direction: column; gap: 0.75rem; }
    .sk-row { height: 24px; background: #f0f2f5; border-radius: 6px; animation: sk-pulse 1.5s infinite; }

    @keyframes sk-pulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 0.3; } }

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
    .btn-ghost {
      background: transparent;
      color: var(--rws-text-muted);
      border: 1px solid var(--rws-border);
      &:hover:not(:disabled) { background: var(--rws-bg); color: var(--rws-text); }
    }
    .btn-sm { padding: 0.375rem 0.75rem; font-size: 0.8125rem; }

    .form-input {
      padding: 0.5rem 0.75rem;
      border: 1px solid var(--rws-border);
      border-radius: var(--rws-radius);
      font-size: 0.9rem;
      font-family: inherit;
      color: var(--rws-text);
      background: #fff;
      width: 100%;
      transition: border-color 150ms ease;
      &:focus { outline: none; border-color: var(--rws-accent); box-shadow: 0 0 0 2px rgba(31, 182, 166, 0.15); }
    }

    .form-hint { margin: 0; font-size: 0.8125rem; color: var(--rws-text-muted); font-style: italic; }
    .form-error { margin: 0; font-size: 0.8125rem; color: var(--rws-error); }

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
    .member-email { font-size: 0.8125rem; color: var(--rws-text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
    @keyframes dialog-in { from { opacity: 0; transform: translate(-50%, -48%); } to { opacity: 1; transform: translate(-50%, -50%); } }

    @media (max-width: 767px) {
      .hero-top { flex-direction: column; }
      .stats-grid { grid-template-columns: repeat(2, 1fr); }
    }

    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
    }
  `],
})
export class HrTeamDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly teamsService = inject(HrTeamsService);

  protected readonly detail = signal<HrTeamDetail | null>(null);
  protected readonly loading = signal(true);

  protected readonly leaderAssignOpen = signal(false);
  protected readonly selectedLeaderId = signal<number | null>(null);
  protected readonly leaderSubmitting = signal(false);

  protected readonly addMembersDialogOpen = signal(false);
  protected readonly unassignedEmployees = signal<HrUnassignedEmployee[]>([]);
  protected readonly addSelectedMemberIds = signal<Set<number>>(new Set());
  protected readonly addSubmitting = signal(false);
  protected readonly addError = signal('');

  protected readonly activeNow = computed(() =>
    this.detail()?.members.filter((m) => m.status === 'active').length ?? 0,
  );
  protected readonly onBreak = computed(() =>
    this.detail()?.members.filter((m) => m.status === 'break').length ?? 0,
  );
  protected readonly offline = computed(() =>
    this.detail()?.members.filter((m) => m.status === 'clocked_out').length ?? 0,
  );
  protected readonly totalHoursToday = computed(() => {
    const members = this.detail()?.members ?? [];
    const total = members.reduce((sum, m) => sum + m.hoursToday, 0);
    return Math.round(total * 10) / 10;
  });

  private teamId = 0;

  ngOnInit(): void {
    this.teamId = Number(this.route.snapshot.paramMap.get('teamId'));
    this.loadTeamData();
  }

  private loadTeamData(): void {
    this.loading.set(true);
    this.teamsService.getTeam(this.teamId).subscribe({
      next: (res) => {
        this.detail.set(res.team);
        this.loading.set(false);
        if (res.team.leader) {
          this.selectedLeaderId.set(res.team.leader.id);
        }
      },
      error: () => this.loading.set(false),
    });
  }

  protected onLeaderSelect(event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    this.selectedLeaderId.set(val ? Number(val) : null);
  }

  protected submitAssignLeader(): void {
    this.leaderSubmitting.set(true);
    const userId = this.selectedLeaderId();
    this.teamsService.assignLeader(this.teamId, userId ?? null).subscribe({
      next: () => {
        this.leaderSubmitting.set(false);
        this.leaderAssignOpen.set(false);
        this.loadTeamData();
      },
      error: () => {
        this.leaderSubmitting.set(false);
      },
    });
  }

  protected openAddMembersDialog(): void {
    this.addSelectedMemberIds.set(new Set());
    this.addError.set('');
    this.addMembersDialogOpen.set(true);
    this.teamsService.getUnassignedEmployees().subscribe({
      next: (res) => this.unassignedEmployees.set(res.employees),
      error: () => this.unassignedEmployees.set([]),
    });
  }

  protected closeAddMembersDialog(): void {
    this.addMembersDialogOpen.set(false);
  }

  protected isAddSelected(id: number): boolean {
    return this.addSelectedMemberIds().has(id);
  }

  protected toggleAddMember(id: number): void {
    this.addSelectedMemberIds.update((set) => {
      const next = new Set(set);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }

  protected submitAddMembers(): void {
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

  protected removeMember(memberId: number): void {
    this.teamsService.updateTeamMembers(this.teamId, { removeMemberIds: [memberId] }).subscribe({
      next: () => this.loadTeamData(),
    });
  }
}
