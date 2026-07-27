import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_PATH } from '../../../core/constants/app.constants';
import { Alert } from '../models/employee.models';

export interface AlertQueryParams {
  period?: string;
  from?: string;
  to?: string;
  limit?: number;
  page?: number;
  unreadOnly?: boolean;
}

export interface AlertListResponse {
  alerts: Alert[];
  total: number;
  unreadCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

@Injectable({ providedIn: 'root' })
export class AlertsService {
  private readonly http = inject(HttpClient);
  private readonly base = API_BASE_PATH;

  getMyAlerts(params: AlertQueryParams = {}): Observable<AlertListResponse> {
    const p: Record<string, string> = {};
    if (params.period) p['period'] = params.period;
    if (params.from) p['from'] = params.from;
    if (params.to) p['to'] = params.to;
    if (params.limit) p['limit'] = params.limit.toString();
    if (params.page) p['page'] = params.page.toString();
    if (params.unreadOnly) p['unreadOnly'] = 'true';
    return this.http.get<AlertListResponse>(`${this.base}/alerts/my`, { params: p, withCredentials: true });
  }

  markRead(id: number): Observable<{ alert: Alert }> {
    return this.http.put<{ alert: Alert }>(`${this.base}/alerts/${id}/read`, {}, { withCredentials: true });
  }

  markAllRead(): Observable<{ ok: boolean }> {
    return this.http.put<{ ok: boolean }>(`${this.base}/alerts/read-all`, {}, { withCredentials: true });
  }
}
