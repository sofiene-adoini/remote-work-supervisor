import { Injectable, inject } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Subject } from 'rxjs';
import { AuthService } from '../../features/auth/services/auth.service';
import { API_BASE_URL } from '../constants/app.constants';

export interface SessionStatusEvent {
  userId: number;
  status: string;
  clockIn: string;
  clockOut: string | null;
  totalBreakMinutes: number;
}

export interface OvertimeStatusEvent {
  declarationId: number;
  userId: number;
  status: string;
}

export interface AlertCreatedEvent {
  id: number;
  type: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  isRead: boolean;
  createdAt: string;
  user?: { id: number; fullName?: string };
  session?: { id: number } | null;
}

@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private readonly auth = inject(AuthService);
  private socket: Socket | null = null;

  readonly sessionChanged$ = new Subject<SessionStatusEvent>();
  readonly overtimeChanged$ = new Subject<OvertimeStatusEvent>();
  readonly alertCreated$ = new Subject<AlertCreatedEvent>();

  connect(): void {
    if (this.socket?.connected) return;
    const token = this.auth.token;
    if (!token) return;

    this.socket = io(API_BASE_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    this.socket.on('session:status-changed', (payload: SessionStatusEvent) =>
      this.sessionChanged$.next(payload),
    );

    this.socket.on('overtime:status-changed', (payload: OvertimeStatusEvent) =>
      this.overtimeChanged$.next(payload),
    );

    this.socket.on('alert:created', (payload: AlertCreatedEvent) =>
      this.alertCreated$.next(payload),
    );

    this.socket.on('connect_error', (err) => {
      console.warn('[Realtime] connection failed:', err.message);
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}
