import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_PATH } from '../../../core/constants/app.constants';
import { AgentDevice, PairingCodeResponse, PairResponse, DeviceListResponse } from '../models/agent-device.models';

@Injectable({ providedIn: 'root' })
export class AgentDevicesService {
  private readonly http = inject(HttpClient);
  private readonly base = API_BASE_PATH;

  generateCode(): Observable<PairingCodeResponse> {
    return this.http.post<PairingCodeResponse>(`${this.base}/agent/pairing-code`, {}, { withCredentials: true });
  }

  listDevices(): Observable<DeviceListResponse> {
    return this.http.get<DeviceListResponse>(`${this.base}/agent/devices`, { withCredentials: true });
  }

  getDevice(id: number): Observable<{ device: AgentDevice }> {
    return this.http.get<{ device: AgentDevice }>(`${this.base}/agent/devices/${id}`, { withCredentials: true });
  }

  unpairDevice(id: number): Observable<{ ok: boolean }> {
    return this.http.put<{ ok: boolean }>(`${this.base}/agent/devices/${id}/unpair`, {}, { withCredentials: true });
  }

  renameDevice(id: number, deviceName: string): Observable<{ device: AgentDevice }> {
    return this.http.put<{ device: AgentDevice }>(`${this.base}/agent/devices/${id}/rename`, { deviceName }, { withCredentials: true });
  }

  revokeByHr(id: number): Observable<{ ok: boolean }> {
    return this.http.put<{ ok: boolean }>(`${this.base}/agent/admin/devices/${id}/revoke`, {}, { withCredentials: true });
  }

  hrListAllDevices(): Observable<DeviceListResponse> {
    return this.http.get<DeviceListResponse>(`${this.base}/agent/admin/devices`, { withCredentials: true });
  }
}
