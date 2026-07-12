import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_PATH } from '../../../core/constants/app.constants';
import { HrDashboardStats } from '../models/hr.models';

@Injectable({ providedIn: 'root' })
export class HrStatsService {
  private readonly http = inject(HttpClient);

  getDashboardStats(): Observable<HrDashboardStats> {
    return this.http.get<HrDashboardStats>(`${API_BASE_PATH}/team-stats/dashboard`, {
      withCredentials: true,
    });
  }
}
