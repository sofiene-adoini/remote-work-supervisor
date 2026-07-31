import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_PATH } from '../../../core/constants/app.constants';
import {
  AnalyticsSummary,
  PaginatedEmployees,
  EmployeeDetailSummary,
  TimelineEntry,
  ChartData,
} from '../models/hr-analytics.models';

export interface EmployeeQuery {
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  attendance?: string;
  teamId?: number;
  sortBy?: string;
  sortDir?: string;
  employment?: string;
  agentStatus?: string;
  roleId?: number;
  projectId?: number;
  joinedFrom?: string;
  joinedTo?: string;
  includeDeleted?: boolean;
}

@Injectable({ providedIn: 'root' })
export class HrAnalyticsService {
  private readonly http = inject(HttpClient);
  private readonly base = API_BASE_PATH;

  private toParams(q: Record<string, any>): HttpParams {
    let params = new HttpParams();
    for (const [k, v] of Object.entries(q)) {
      if (v !== undefined && v !== null && v !== '') {
        params = params.set(k, String(v));
      }
    }
    return params;
  }

  getSummary(startDate?: string, endDate?: string): Observable<AnalyticsSummary> {
    return this.http.get<AnalyticsSummary>(`${this.base}/hr-analytics/summary`, {
      params: this.toParams({ startDate, endDate }),
      withCredentials: true,
    });
  }

  getEmployees(query: EmployeeQuery): Observable<PaginatedEmployees> {
    return this.http.get<PaginatedEmployees>(`${this.base}/hr-analytics/employees`, {
      params: this.toParams(query),
      withCredentials: true,
    });
  }

  getEmployeeDetail(id: number, startDate?: string, endDate?: string): Observable<EmployeeDetailSummary> {
    return this.http.get<EmployeeDetailSummary>(`${this.base}/hr-analytics/employee/${id}`, {
      params: this.toParams({ startDate, endDate }),
      withCredentials: true,
    });
  }

  getTimeline(id: number, startDate?: string, endDate?: string): Observable<{ timeline: TimelineEntry[] }> {
    return this.http.get<{ timeline: TimelineEntry[] }>(`${this.base}/hr-analytics/employee/${id}/timeline`, {
      params: this.toParams({ startDate, endDate }),
      withCredentials: true,
    });
  }

  getCharts(startDate?: string, endDate?: string): Observable<ChartData> {
    return this.http.get<ChartData>(`${this.base}/hr-analytics/charts`, {
      params: this.toParams({ startDate, endDate }),
      withCredentials: true,
    });
  }

  getEmployeeBreaks(userId: number, start?: string, end?: string): Observable<{ breaks: any[] }> {
    let params = new HttpParams();
    if (start) params = params.set('start', start);
    if (end) params = params.set('end', end);
    return this.http.get<{ breaks: any[] }>(`${this.base}/breaks/employee/${userId}`, {
      params,
      withCredentials: true,
    });
  }

  exportCsv(query: EmployeeQuery): void {
    const params = this.toParams(query);
    window.open(`${this.base}/hr-analytics/export?${params.toString()}`, '_blank');
  }
}
