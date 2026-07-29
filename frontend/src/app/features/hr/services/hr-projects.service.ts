import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_PATH } from '../../../core/constants/app.constants';
import { HrProject } from '../models/hr.models';

@Injectable({ providedIn: 'root' })
export class HrProjectsService {
  private readonly http = inject(HttpClient);

  listAll(): Observable<{ projects: HrProject[] }> {
    return this.http.get<{ projects: HrProject[] }>(`${API_BASE_PATH}/projects/list-all`, { withCredentials: true });
  }

  getById(id: number): Observable<{ project: HrProject }> {
    return this.http.get<{ project: HrProject }>(`${API_BASE_PATH}/projects/${id}`, { withCredentials: true });
  }

  createProject(payload: {
    name: string;
    description?: string;
    status?: string;
    priority?: string;
    client?: string;
    expectedStart?: string;
    expectedEnd?: string;
    estimatedHours?: number;
    color?: string;
    assignmentType: 'team' | 'individual';
    teamId?: number;
    employeeIds?: number[];
    managerId?: number;
  }): Observable<{ project: HrProject }> {
    return this.http.post<{ project: HrProject }>(`${API_BASE_PATH}/projects`, payload, { withCredentials: true });
  }

  updateProject(id: number, payload: Partial<{
    name: string;
    description: string;
    status: string;
    priority: string;
    client: string;
    expectedStart: string;
    expectedEnd: string;
    estimatedHours: number;
    color: string;
    managerId: number;
  }>): Observable<{ project: HrProject }> {
    return this.http.put<{ project: HrProject }>(`${API_BASE_PATH}/projects/${id}`, payload, { withCredentials: true });
  }

  reassignProject(id: number, payload: {
    assignmentType: 'team' | 'individual';
    teamId?: number;
    employeeIds?: number[];
  }): Observable<{ project: HrProject }> {
    return this.http.put<{ project: HrProject }>(`${API_BASE_PATH}/projects/${id}/reassign`, payload, { withCredentials: true });
  }
}
