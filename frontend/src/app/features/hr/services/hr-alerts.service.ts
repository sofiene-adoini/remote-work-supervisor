import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_PATH } from '../../../core/constants/app.constants';
import { HrAlert } from '../models/hr.models';

export interface HrAlertQueryParams {
  period?: string;
  from?: string;
  to?: string;
  limit?: number;
  page?: number;
  employeeId?: number;
  teamId?: number;
  severity?: string;
  type?: string;
  search?: string;
}

export interface HrAlertListResponse {
  alerts: HrAlert[];
  total: number;
  unreadCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

@Injectable({ providedIn: 'root' })
export class HrAlertsService {
  private readonly http = inject(HttpClient);
  private readonly base = API_BASE_PATH;

  getAllAlerts(params: HrAlertQueryParams = {}): Observable<HrAlertListResponse> {
    const p: Record<string, string> = {};
    if (params.period) p['period'] = params.period;
    if (params.from) p['from'] = params.from;
    if (params.to) p['to'] = params.to;
    if (params.limit) p['limit'] = params.limit.toString();
    if (params.page) p['page'] = params.page.toString();
    if (params.employeeId) p['employeeId'] = params.employeeId.toString();
    if (params.teamId) p['teamId'] = params.teamId.toString();
    if (params.severity) p['severity'] = params.severity;
    if (params.type) p['type'] = params.type;
    if (params.search) p['search'] = params.search;
    return this.http.get<HrAlertListResponse>(`${this.base}/alerts/all`, { params: p, withCredentials: true });
  }

  getUnreadCount(): Observable<{ unreadCount: number }> {
    return this.http.get<{ unreadCount: number }>(
      `${this.base}/alerts/all?limit=1`,
      { withCredentials: true },
    );
  }

  markRead(id: number): Observable<{ alert: HrAlert }> {
    return this.http.put<{ alert: HrAlert }>(`${this.base}/alerts/${id}/read`, {}, { withCredentials: true });
  }

  markAllRead(): Observable<{ ok: boolean }> {
    return this.http.put<{ ok: boolean }>(`${this.base}/alerts/read-all`, {}, { withCredentials: true });
  }
}
