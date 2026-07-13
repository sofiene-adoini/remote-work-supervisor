import { Component, inject, OnInit, signal } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { LucideUsers } from '@lucide/angular';
import { HrTeamsService } from '../services/hr-teams.service';
import { HrTeamMember } from '../models/hr.models';

@Component({
  selector: 'app-hr-team-members',
  imports: [TitleCasePipe, LucideUsers],
  template: `
    <div class="page-header">
      <h2 class="page-heading">Team Members</h2>
    </div>

    @if (loading()) {
      <div class="card">
        <div class="skeleton-list">
          @for (i of [1,2,3,4,5]; track i) {
            <div class="skeleton skeleton-row"></div>
          }
        </div>
      </div>
    } @else if (members().length === 0) {
      <div class="empty-state">
        <svg lucideUsers class="empty-icon"></svg>
        <p class="empty-title">No team members</p>
        <p class="empty-sub">Employees will appear here once they have accounts.</p>
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
                <th class="num-col">Hours Today</th>
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
                  <td class="num-col">{{ member.hoursToday }}h</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    }
  `,
  styles: [`
    @use 'styles/design-tokens' as t;

    .page-header { margin-bottom: 1.5rem; }
    .page-heading { margin: 0; font-size: 1.375rem; font-weight: 700; color: var(--rws-text); }

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
      .num-col { text-align: right; }
      th.num-col { text-align: right; }
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

    .skeleton { background: linear-gradient(90deg, #f0f2f5 25%, #e8eaed 50%, #f0f2f5 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; border-radius: 6px; }
    .skeleton-list { display: flex; flex-direction: column; gap: 0.75rem; padding: 1rem; }
    .skeleton-row { height: 48px; }
    @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

    @media (max-width: 767px) {
      .members-table { font-size: 0.8125rem; }
      .members-table th, .members-table td { padding: 0.625rem 0.75rem; }
    }
  `],
})
export class HrTeamMembersComponent implements OnInit {
  private readonly teamsService = inject(HrTeamsService);
  protected readonly members = signal<HrTeamMember[]>([]);
  protected readonly loading = signal(true);

  ngOnInit(): void {
    this.teamsService.getAllMembers().subscribe({
      next: (res) => {
        this.members.set(res.members);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
