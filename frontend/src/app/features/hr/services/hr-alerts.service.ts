import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_PATH } from '../../../core/constants/app.constants';
import { HrAlert } from '../models/hr.models';

@Injectable({ providedIn: 'root' })
export class HrAlertsService {
  private readonly http = inject(HttpClient);
  private readonly base = API_BASE_PATH;

  getAllAlerts(limit = 20): Observable<{ alerts: HrAlert[]; unreadCount: number }> {
    return this.http.get<{ alerts: HrAlert[]; unreadCount: number }>(
      `${this.base}/alerts/all?limit=${limit}`,
      { withCredentials: true },
    );
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
