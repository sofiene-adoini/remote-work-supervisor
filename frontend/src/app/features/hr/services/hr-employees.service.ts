import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_PATH } from '../../../core/constants/app.constants';
import {
  HrRole,
  EmployeeProfile,
  EmployeeSessionRow,
  EmployeeBreakRow,
  UpdateEmployeePayload,
} from '../models/hr-employees.models';

@Injectable({ providedIn: 'root' })
export class HrEmployeesService {
  private readonly http = inject(HttpClient);
  private readonly base = API_BASE_PATH;

  getRoles(): Observable<{ roles: HrRole[] }> {
    return this.http.get<{ roles: HrRole[] }>(`${this.base}/hr-analytics/roles`, {
      withCredentials: true,
    });
  }

  updateEmployee(id: number, payload: UpdateEmployeePayload): Observable<{ user: EmployeeProfile }> {
    return this.http.put<{ user: EmployeeProfile }>(
      `${this.base}/hr-analytics/employee/${id}`,
      payload,
      { withCredentials: true },
    );
  }

  suspendEmployee(id: number): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(
      `${this.base}/hr-analytics/employee/${id}/suspend`,
      {},
      { withCredentials: true },
    );
  }

  reactivateEmployee(id: number): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(
      `${this.base}/hr-analytics/employee/${id}/reactivate`,
      {},
      { withCredentials: true },
    );
  }

  restoreEmployee(id: number): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(
      `${this.base}/hr-analytics/employee/${id}/restore`,
      {},
      { withCredentials: true },
    );
  }

  softDeleteEmployee(id: number): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.base}/hr-analytics/employee/${id}`, {
      withCredentials: true,
    });
  }

  resetPassword(id: number): Observable<{ ok: boolean; inviteToken?: string }> {
    return this.http.post<{ ok: boolean; inviteToken?: string }>(
      `${this.base}/hr-analytics/employee/${id}/reset-password`,
      {},
      { withCredentials: true },
    );
  }

  getEmployeeSessions(id: number, start: string, end: string): Observable<{ sessions: EmployeeSessionRow[] }> {
    const params = new HttpParams().set('start', start).set('end', end);
    return this.http.get<{ sessions: EmployeeSessionRow[] }>(
      `${this.base}/hr-analytics/employee/${id}/sessions`,
      { params, withCredentials: true },
    );
  }

  getEmployeeBreaks(userId: number, start?: string, end?: string): Observable<{ breaks: EmployeeBreakRow[] }> {
    let params = new HttpParams();
    if (start) params = params.set('start', start);
    if (end) params = params.set('end', end);
    return this.http.get<{ breaks: EmployeeBreakRow[] }>(
      `${this.base}/breaks/employee/${userId}`,
      { params, withCredentials: true },
    );
  }
}
