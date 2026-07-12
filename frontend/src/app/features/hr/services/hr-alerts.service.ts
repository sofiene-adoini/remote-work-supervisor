import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_PATH } from '../../../core/constants/app.constants';
import { HrAlert } from '../models/hr.models';

@Injectable({ providedIn: 'root' })
export class HrAlertsService {
  private readonly http = inject(HttpClient);

  getAllAlerts(limit = 20): Observable<{ alerts: HrAlert[] }> {
    return this.http.get<{ alerts: HrAlert[] }>(
      `${API_BASE_PATH}/alerts/all?limit=${limit}`,
      { withCredentials: true },
    );
  }
}
