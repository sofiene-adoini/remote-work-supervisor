import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_PATH } from '../../../core/constants/app.constants';
import { OvertimeDeclaration } from '../models/employee.models';

@Injectable({ providedIn: 'root' })
export class OvertimeService {
  private readonly http = inject(HttpClient);
  private readonly base = API_BASE_PATH;

  getMyDeclarations(): Observable<{ declarations: OvertimeDeclaration[] }> {
    return this.http.get<{ declarations: OvertimeDeclaration[] }>(`${this.base}/overtime-declarations/my`, { withCredentials: true });
  }

  declare(data: { date: string; hours: number; reason: string }): Observable<{ declaration: OvertimeDeclaration }> {
    return this.http.post<{ declaration: OvertimeDeclaration }>(`${this.base}/overtime-declarations`, data, { withCredentials: true });
  }
}
