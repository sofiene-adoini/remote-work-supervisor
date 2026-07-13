import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideUsers, LucideArrowRight } from '@lucide/angular';
import { HrTeamsService } from '../services/hr-teams.service';
import { HrTeam } from '../models/hr.models';

@Component({
  selector: 'app-hr-teams',
  imports: [RouterLink, LucideUsers, LucideArrowRight],
  template: `
    <div class="page-header">
      <h2 class="page-heading">Teams</h2>
    </div>

    @if (loading()) {
      <div class="skeleton-grid">
        @for (i of [1,2,3]; track i) {
          <div class="skeleton skeleton-card"></div>
        }
      </div>
    } @else if (teams().length === 0) {
      <div class="empty-state">
        <svg lucideUsers class="empty-icon"></svg>
        <p class="empty-title">No teams yet</p>
        <p class="empty-sub">Teams will appear here once created in Strapi admin.</p>
      </div>
    } @else {
      <div class="teams-grid">
        @for (team of teams(); track team.id) {
          <div class="team-card">
            <div class="team-icon-wrap">
              <svg lucideUsers class="team-icon"></svg>
            </div>
            <div class="team-body">
              <h3 class="team-name">{{ team.name }}</h3>
              <span class="team-count">{{ team.memberCount }} member{{ team.memberCount === 1 ? '' : 's' }}</span>
            </div>
            <a [routerLink]="['/hr/teams', team.id]" class="team-link">
              View <svg lucideArrowRight class="icon-xs"></svg>
            </a>
          </div>
        }
      </div>
    }
  `,
  styles: [`
    @use 'styles/design-tokens' as t;

    .page-header { margin-bottom: 1.5rem; }
    .page-heading { margin: 0; font-size: 1.375rem; font-weight: 700; color: var(--rws-text); }

    .teams-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1rem;
    }

    .team-card {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1.25rem;
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
      border: 1px solid transparent;
      transition: border-color 150ms ease, box-shadow 150ms ease, transform 150ms ease;

      &:hover {
        border-color: var(--rws-accent);
        transform: translateY(-1px);
      }
    }

    .team-icon-wrap {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      border-radius: 10px;
      background: #e8f1fb;
      flex-shrink: 0;
    }

    .team-icon { width: 20px; height: 20px; color: var(--rws-primary); }

    .team-body { flex: 1; min-width: 0; }
    .team-name { margin: 0; font-size: 1rem; font-weight: 600; color: var(--rws-text); }
    .team-count { font-size: 0.8125rem; color: var(--rws-text-muted); }

    .team-link {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      font-size: 0.8125rem;
      font-weight: 500;
      color: var(--rws-accent);
      text-decoration: none;
      white-space: nowrap;

      &:hover { color: var(--rws-accent-strong); }
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

    .skeleton { background: linear-gradient(90deg, #f0f2f5 25%, #e8eaed 50%, #f0f2f5 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; border-radius: 12px; }
    .skeleton-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem; }
    .skeleton-card { height: 100px; }
    @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
    .icon-xs { width: 14px; height: 14px; }
  `],
})
export class HrTeamsComponent implements OnInit {
  private readonly teamsService = inject(HrTeamsService);
  protected readonly teams = signal<HrTeam[]>([]);
  protected readonly loading = signal(true);

  ngOnInit(): void {
    this.teamsService.getTeams().subscribe({
      next: (res) => {
        this.teams.set(res.teams);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
