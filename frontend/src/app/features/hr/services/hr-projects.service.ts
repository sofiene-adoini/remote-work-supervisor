import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_PATH } from '../../../core/constants/app.constants';
import { HrProject } from '../models/hr.models';

@Injectable({ providedIn: 'root' })
export class HrProjectsService {
  private readonly http = inject(HttpClient);

  listAll(): Observable<{ projects: HrProject[] }> {
    return this.http.get<{ projects: HrProject[] }>(`${API_BASE_PATH}/projects/list-all`, {
      withCredentials: true,
    });
  }

  createProject(payload: {
    name: string;
    description?: string;
    assignmentType: 'team' | 'individual';
    teamId?: number;
    employeeIds?: number[];
  }): Observable<{ project: HrProject }> {
    return this.http.post<{ project: HrProject }>(`${API_BASE_PATH}/projects`, payload, {
      withCredentials: true,
    });
  }

  reassignProject(id: number, payload: {
    assignmentType: 'team' | 'individual';
    teamId?: number;
    employeeIds?: number[];
  }): Observable<{ project: HrProject }> {
    return this.http.put<{ project: HrProject }>(`${API_BASE_PATH}/projects/${id}/reassign`, payload, {
      withCredentials: true,
    });
  }
}
