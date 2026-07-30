import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_PATH } from '../../../core/constants/app.constants';
import { OvertimeDeclaration } from '../models/employee.models';

export interface OvertimeResponse {
  declarations: OvertimeDeclaration[];
  total?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
}

export interface OvertimeHistoryParams {
  status?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  minDuration?: number;
  maxDuration?: number;
  sortBy?: string;
  sortOrder?: string;
  page?: number;
  pageSize?: number;
}

@Injectable({ providedIn: 'root' })
export class OvertimeService {
  private readonly http = inject(HttpClient);
  private readonly base = API_BASE_PATH;

  getMyDeclarations(status?: string): Observable<OvertimeResponse> {
    const params: Record<string, string> = {};
    if (status) params['status'] = status;
    return this.http.get<OvertimeResponse>(`${this.base}/overtime-declarations/my`, {
      params,
      withCredentials: true,
    });
  }

  getPending(): Observable<OvertimeResponse> {
    return this.getMyDeclarations('submitted');
  }

  getRecentDecisions(): Observable<OvertimeResponse> {
    return this.http.get<OvertimeResponse>(
      `${this.base}/overtime-declarations/my/recent`,
      { withCredentials: true },
    );
  }

  getHistory(params: OvertimeHistoryParams): Observable<OvertimeResponse> {
    const p: Record<string, string> = {};
    if (params.status) p['status'] = params.status;
    if (params.search) p['search'] = params.search;
    if (params.dateFrom) p['dateFrom'] = params.dateFrom;
    if (params.dateTo) p['dateTo'] = params.dateTo;
    if (params.minDuration !== undefined) p['minDuration'] = params.minDuration.toString();
    if (params.maxDuration !== undefined) p['maxDuration'] = params.maxDuration.toString();
    if (params.sortBy) p['sortBy'] = params.sortBy;
    if (params.sortOrder) p['sortOrder'] = params.sortOrder;
    if (params.page) p['page'] = params.page.toString();
    if (params.pageSize) p['pageSize'] = params.pageSize.toString();
    return this.http.get<OvertimeResponse>(`${this.base}/overtime-declarations/my`, {
      params: p,
      withCredentials: true,
    });
  }

  submitJustification(id: number, data: { reason: string; notes?: string }): Observable<{ declaration: OvertimeDeclaration }> {
    return this.http.put<{ declaration: OvertimeDeclaration }>(
      `${this.base}/overtime-declarations/${id}/submit`,
      data,
      { withCredentials: true },
    );
  }

  cancel(id: number): Observable<{ declaration: OvertimeDeclaration }> {
    return this.http.put<{ declaration: OvertimeDeclaration }>(
      `${this.base}/overtime-declarations/${id}/cancel`,
      {},
      { withCredentials: true },
    );
  }
}
