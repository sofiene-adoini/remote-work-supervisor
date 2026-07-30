import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_PATH } from '../../../core/constants/app.constants';
import {
  Session, SessionResponse, WeeklyHoursResponse, SessionHistoryResponse, TodayDetailResponse,
  RangeSessionsResponse, DailyStats, WeeklyStats, MonthlyStats, EmployeeStatsResponse, CompanyWorkPolicy,
} from '../models/employee.models';

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

  getHistory(weekStart: string): Observable<SessionHistoryResponse> {
    return this.http.get<SessionHistoryResponse>(`${this.base}/history`, {
      params: { weekStart },
      withCredentials: true,
    });
  }

  getTodayDetail(): Observable<TodayDetailResponse> {
    return this.http.get<TodayDetailResponse>(`${this.base}/today-detail`, { withCredentials: true });
  }

  getRangeSessions(start: string, end: string): Observable<RangeSessionsResponse> {
    return this.http.get<RangeSessionsResponse>(`${this.base}/range`, {
      params: { start, end },
      withCredentials: true,
    });
  }

  getDailyStats(date: string): Observable<{ stats: DailyStats }> {
    return this.http.get<{ stats: DailyStats }>(`${this.base}/daily-stats`, {
      params: { date },
      withCredentials: true,
    });
  }

  getWeeklyStats(): Observable<{ stats: WeeklyStats }> {
    return this.http.get<{ stats: WeeklyStats }>(`${this.base}/weekly-stats`, { withCredentials: true });
  }

  getMonthlyStats(year: number, month: number): Observable<{ stats: MonthlyStats }> {
    return this.http.get<{ stats: MonthlyStats }>(`${this.base}/monthly-stats`, {
      params: { year: year.toString(), month: month.toString() },
      withCredentials: true,
    });
  }

  getMyBreaks(start?: string, end?: string): Observable<{ breaks: any[] }> {
    const params: any = {};
    if (start) params.start = start;
    if (end) params.end = end;
    return this.http.get<{ breaks: any[] }>(`${API_BASE_PATH}/breaks/my`, {
      params,
      withCredentials: true,
    });
  }

  getEmployeeStats(): Observable<EmployeeStatsResponse> {
    return this.http.get<EmployeeStatsResponse>(`${API_BASE_PATH}/work-stats/employee`, { withCredentials: true });
  }

  getPolicy(): Observable<{ policy: CompanyWorkPolicy }> {
    return this.http.get<{ policy: CompanyWorkPolicy }>(`${API_BASE_PATH}/work-stats/policy`, { withCredentials: true });
  }
}
