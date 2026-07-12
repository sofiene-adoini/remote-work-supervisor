import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_PATH } from '../../../core/constants/app.constants';
import { HrTeam, HrTeamMember } from '../models/hr.models';

@Injectable({ providedIn: 'root' })
export class HrTeamsService {
  private readonly http = inject(HttpClient);

  getTeams(): Observable<{ teams: HrTeam[] }> {
    return this.http.get<{ teams: HrTeam[] }>(`${API_BASE_PATH}/teams`, {
      withCredentials: true,
    });
  }

  getTeamMembers(teamId: number): Observable<{ members: HrTeamMember[] }> {
    return this.http.get<{ members: HrTeamMember[] }>(`${API_BASE_PATH}/teams/${teamId}/members`, {
      withCredentials: true,
    });
  }

  getAllMembers(): Observable<{ members: HrTeamMember[] }> {
    return this.http.get<{ members: HrTeamMember[] }>(`${API_BASE_PATH}/teams/all-members`, {
      withCredentials: true,
    });
  }
}
