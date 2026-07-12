import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_PATH } from '../../../core/constants/app.constants';
import { Project, TimeEntry } from '../models/employee.models';

@Injectable({ providedIn: 'root' })
export class ProjectsService {
  private readonly http = inject(HttpClient);
  private readonly base = API_BASE_PATH;

  getMyProjects(): Observable<{ projects: Project[] }> {
    return this.http.get<{ projects: Project[] }>(`${this.base}/projects/my`, { withCredentials: true });
  }

  logTime(data: { projectId: number; date: string; hours: number; description?: string }): Observable<{ entry: TimeEntry }> {
    return this.http.post<{ entry: TimeEntry }>(`${this.base}/time-entries`, data, { withCredentials: true });
  }
}
