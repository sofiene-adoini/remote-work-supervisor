import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_PATH } from '../../../core/constants/app.constants';
import { Session, SessionResponse, WeeklyHoursResponse } from '../models/employee.models';

@Injectable({ providedIn: 'root' })
export class TimeEntriesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE_PATH}/sessions`;

  getStatus(): Observable<SessionResponse> {
    return this.http.get<SessionResponse>(`${this.base}/status`, { withCredentials: true });
  }

  clockIn(): Observable<{ session: Session }> {
    return this.http.post<{ session: Session }>(`${this.base}/clock-in`, {}, { withCredentials: true });
  }

  clockOut(): Observable<{ session: Session }> {
    return this.http.post<{ session: Session }>(`${this.base}/clock-out`, {}, { withCredentials: true });
  }

  startBreak(): Observable<{ session: Session }> {
    return this.http.post<{ session: Session }>(`${this.base}/break-start`, {}, { withCredentials: true });
  }

  endBreak(): Observable<{ session: Session }> {
    return this.http.post<{ session: Session }>(`${this.base}/break-end`, {}, { withCredentials: true });
  }

  getWeeklyHours(): Observable<WeeklyHoursResponse> {
    return this.http.get<WeeklyHoursResponse>(`${this.base}/weekly-hours`, { withCredentials: true });
  }
}
