import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_PATH } from '../../../core/constants/app.constants';
import { CompanyWorkPolicy } from '../../employee/models/employee.models';

@Injectable({ providedIn: 'root' })
export class HrSettingsService {
  private readonly http = inject(HttpClient);
  private readonly base = API_BASE_PATH;

  getPolicy(): Observable<{ policy: CompanyWorkPolicy }> {
    return this.http.get<{ policy: CompanyWorkPolicy }>(
      `${this.base}/company-work-policy`,
      { withCredentials: true },
    );
  }

  updatePolicy(data: Partial<CompanyWorkPolicy>): Observable<{ policy: CompanyWorkPolicy }> {
    return this.http.put<{ policy: CompanyWorkPolicy }>(
      `${this.base}/company-work-policy`,
      data,
      { withCredentials: true },
    );
  }

  getEmployeeStats(userId?: number): Observable<{ dailyStats: any; weeklyStats: any; monthlyStats: any; attendanceEvaluation: string; currentSession: any }> {
    const params: any = {};
    if (userId) params.userId = userId.toString();
    return this.http.get<any>(
      `${this.base}/work-stats/employee`,
      { params, withCredentials: true },
    );
  }

  getAllEmployeeStats(): Observable<{ employees: any[] }> {
    return this.http.get<{ employees: any[] }>(
      `${this.base}/work-stats/all-employees`,
      { withCredentials: true },
    );
  }
}
