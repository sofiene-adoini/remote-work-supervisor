import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_PATH } from '../../../core/constants/app.constants';
import { HrOvertimeDeclaration } from '../models/hr.models';

export interface HrOvertimeResponse {
  declarations: HrOvertimeDeclaration[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

@Injectable({ providedIn: 'root' })
export class HrOvertimeService {
  private readonly http = inject(HttpClient);

  getPendingDeclarations(): Observable<{ declarations: HrOvertimeDeclaration[] }> {
    return this.http.get<{ declarations: HrOvertimeDeclaration[] }>(
      `${API_BASE_PATH}/overtime-declarations/pending`,
      { withCredentials: true },
    );
  }

  getAllDeclarations(params?: {
    status?: string;
    employeeId?: number;
    limit?: number;
    page?: number;
  }): Observable<HrOvertimeResponse> {
    const p: Record<string, string> = {};
    if (params?.status) p['status'] = params.status;
    if (params?.employeeId) p['employeeId'] = params.employeeId.toString();
    if (params?.limit) p['limit'] = params.limit.toString();
    if (params?.page) p['page'] = params.page.toString();
    return this.http.get<HrOvertimeResponse>(
      `${API_BASE_PATH}/overtime-declarations/all`,
      { params: p, withCredentials: true },
    );
  }

  approve(id: number): Observable<{ declaration: HrOvertimeDeclaration }> {
    return this.http.put<{ declaration: HrOvertimeDeclaration }>(
      `${API_BASE_PATH}/overtime-declarations/${id}/approve`,
      {},
      { withCredentials: true },
    );
  }

  reject(id: number): Observable<{ declaration: HrOvertimeDeclaration }> {
    return this.http.put<{ declaration: HrOvertimeDeclaration }>(
      `${API_BASE_PATH}/overtime-declarations/${id}/reject`,
      {},
      { withCredentials: true },
    );
  }
}
