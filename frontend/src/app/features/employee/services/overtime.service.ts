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
