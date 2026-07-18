import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_PATH } from '../../../core/constants/app.constants';
import { HrTeam, HrTeamMember, HrUnassignedEmployee, HrTeamDetail } from '../models/hr.models';

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

  getUnassignedEmployees(): Observable<{ employees: HrUnassignedEmployee[] }> {
    return this.http.get<{ employees: HrUnassignedEmployee[] }>(`${API_BASE_PATH}/teams/unassigned-employees`, {
      withCredentials: true,
    });
  }

  createTeam(payload: { name: string; memberIds?: number[] }): Observable<{ team: HrTeamDetail }> {
    return this.http.post<{ team: HrTeamDetail }>(`${API_BASE_PATH}/teams`, payload, {
      withCredentials: true,
    });
  }

  updateTeamMembers(teamId: number, payload: { addMemberIds?: number[]; removeMemberIds?: number[] }): Observable<{ team: HrTeamDetail }> {
    return this.http.put<{ team: HrTeamDetail }>(`${API_BASE_PATH}/teams/${teamId}/members`, payload, {
      withCredentials: true,
    });
  }
}
