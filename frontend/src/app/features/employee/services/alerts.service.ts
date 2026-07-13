import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_PATH } from '../../../core/constants/app.constants';
import { Alert } from '../models/employee.models';

@Injectable({ providedIn: 'root' })
export class AlertsService {
  private readonly http = inject(HttpClient);
  private readonly base = API_BASE_PATH;

  getMyAlerts(limit = 5, unreadOnly = false): Observable<{ alerts: Alert[]; unreadCount: number }> {
    const params: any = { limit: limit.toString() };
    if (unreadOnly) params.unreadOnly = 'true';
    return this.http.get<{ alerts: Alert[]; unreadCount: number }>(`${this.base}/alerts/my`, { params, withCredentials: true });
  }

  markRead(id: number): Observable<{ alert: Alert }> {
    return this.http.put<{ alert: Alert }>(`${this.base}/alerts/${id}/read`, {}, { withCredentials: true });
  }

  markAllRead(): Observable<{ ok: boolean }> {
    return this.http.put<{ ok: boolean }>(`${this.base}/alerts/read-all`, {}, { withCredentials: true });
  }
}
