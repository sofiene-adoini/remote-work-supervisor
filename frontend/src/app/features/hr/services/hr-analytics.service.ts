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

  exportCsv(query: EmployeeQuery): void {
    const params = this.toParams(query);
    window.open(`${this.base}/hr-analytics/export?${params.toString()}`, '_blank');
  }
}
