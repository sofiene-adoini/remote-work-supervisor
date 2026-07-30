import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_PATH } from '../../../core/constants/app.constants';
import { WorkspaceData } from '../models/employee.models';

@Injectable({ providedIn: 'root' })
export class WorkspaceService {
  private readonly http = inject(HttpClient);
  private readonly base = API_BASE_PATH;

  getMyWorkspace(): Observable<{ workspace: WorkspaceData }> {
    return this.http.get<{ workspace: WorkspaceData }>(`${this.base}/workspace/my`, {
      withCredentials: true,
    });
  }
}
