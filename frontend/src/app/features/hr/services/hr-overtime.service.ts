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

export interface HrOvertimeStats {
  pendingCount: number;
  approvedToday: number;
  rejectedToday: number;
  pendingHours: number;
  approvedHoursThisWeek: number;
  rejectedHoursThisWeek: number;
}

export interface HrOvertimeQueryParams {
  status?: string;
  employeeId?: number;
  teamId?: number;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  minDuration?: number;
  maxDuration?: number;
  sortBy?: string;
  sortOrder?: string;
  limit?: number;
  page?: number;
}

@Injectable({ providedIn: 'root' })
export class HrOvertimeService {
  private readonly http = inject(HttpClient);

  getHrStats(): Observable<HrOvertimeStats> {
    return this.http.get<HrOvertimeStats>(
      `${API_BASE_PATH}/overtime-declarations/hr/stats`,
      { withCredentials: true },
    );
  }

  getPendingDeclarations(params?: {
    search?: string;
    dateFrom?: string;
    dateTo?: string;
    employeeId?: number;
    teamId?: number;
    page?: number;
    pageSize?: number;
  }): Observable<HrOvertimeResponse> {
    const p: Record<string, string> = {};
    if (params?.search) p['search'] = params.search;
    if (params?.dateFrom) p['dateFrom'] = params.dateFrom;
    if (params?.dateTo) p['dateTo'] = params.dateTo;
    if (params?.employeeId) p['employeeId'] = params.employeeId.toString();
    if (params?.teamId) p['teamId'] = params.teamId.toString();
    if (params?.page) p['page'] = params.page.toString();
    if (params?.pageSize) p['pageSize'] = params.pageSize.toString();
    return this.http.get<HrOvertimeResponse>(
      `${API_BASE_PATH}/overtime-declarations/pending`,
      { params: p, withCredentials: true },
    );
  }

  getAllDeclarations(params?: HrOvertimeQueryParams): Observable<HrOvertimeResponse> {
    const p: Record<string, string> = {};
    if (params?.status) p['status'] = params.status;
    if (params?.employeeId) p['employeeId'] = params.employeeId.toString();
    if (params?.teamId) p['teamId'] = params.teamId.toString();
    if (params?.search) p['search'] = params.search;
    if (params?.dateFrom) p['dateFrom'] = params.dateFrom;
    if (params?.dateTo) p['dateTo'] = params.dateTo;
    if (params?.minDuration !== undefined) p['minDuration'] = params.minDuration.toString();
    if (params?.maxDuration !== undefined) p['maxDuration'] = params.maxDuration.toString();
    if (params?.sortBy) p['sortBy'] = params.sortBy;
    if (params?.sortOrder) p['sortOrder'] = params.sortOrder;
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
