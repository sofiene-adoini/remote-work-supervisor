import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_PATH } from '../../../core/constants/app.constants';
import { Project, ProjectAllocation } from '../models/employee.models';

@Injectable({ providedIn: 'root' })
export class ProjectsService {
  private readonly http = inject(HttpClient);
  private readonly base = API_BASE_PATH;

  getMyProjects(): Observable<{ projects: Project[] }> {
    return this.http.get<{ projects: Project[] }>(`${this.base}/projects/my`, { withCredentials: true });
  }

  getActiveAllocation(): Observable<{ allocation: ProjectAllocation | null }> {
    return this.http.get<{ allocation: ProjectAllocation | null }>(`${this.base}/project-allocations/active`, { withCredentials: true });
  }

  switchProject(projectId: number): Observable<{ allocation: ProjectAllocation }> {
    return this.http.post<{ allocation: ProjectAllocation }>(`${this.base}/project-allocations/switch`, { projectId }, { withCredentials: true });
  }

  stopProject(): Observable<{ allocation: null }> {
    return this.http.post<{ allocation: null }>(`${this.base}/project-allocations/stop`, {}, { withCredentials: true });
  }
}
