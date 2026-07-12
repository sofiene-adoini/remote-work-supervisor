import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_PATH } from '../../../core/constants/app.constants';
import { HrOvertimeDeclaration } from '../models/hr.models';

@Injectable({ providedIn: 'root' })
export class HrOvertimeService {
  private readonly http = inject(HttpClient);

  getPendingDeclarations(): Observable<{ declarations: HrOvertimeDeclaration[] }> {
    return this.http.get<{ declarations: HrOvertimeDeclaration[] }>(
      `${API_BASE_PATH}/overtime-declarations/pending`,
      { withCredentials: true },
    );
  }

  getAllDeclarations(): Observable<{ declarations: HrOvertimeDeclaration[] }> {
    return this.http.get<{ declarations: HrOvertimeDeclaration[] }>(
      `${API_BASE_PATH}/overtime-declarations/all`,
      { withCredentials: true },
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
