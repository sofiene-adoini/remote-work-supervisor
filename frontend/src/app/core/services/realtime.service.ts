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

export interface DailyStatsEvent {
  workedMinutes: number;
  productiveMinutes: number;
  idleMinutes: number;
  breakMinutes: number;
  overtimeMinutes: number;
  expectedMinutes: number;
  missingMinutes: number;
  extraMinutes: number;
  attendanceStatus: 'completed' | 'underworked' | 'overtime' | 'absent' | 'day_off';
}

export interface WeeklyStatsEvent {
  expectedHours: number;
  workedHours: number;
  overtimeHours: number;
  missingHours: number;
  productiveHours: number;
  idleHours: number;
  breakHours: number;
  attendanceRate: number;
  completionRate: number;
}

export interface SessionUpdatedEvent {
  userId: number;
  status: 'clocked_out' | 'active' | 'break';
  sessionId: number | null;
  clockIn: string | null;
  clockOut: string | null;
  breakStartedAt: string | null;
  totalBreakMinutes: number;
  workedTodayMinutes: number;
  weeklyMinutes: number;
  currentProject: { id: number; name: string } | null;
  agentOnline: boolean;
  dailyStats?: DailyStatsEvent;
  weeklyStats?: WeeklyStatsEvent;
}

export interface OvertimeStatusEvent {
  overtimeId: number;
  userId: number;
  status: string;
  overtimeMinutes?: number;
  workedMinutes?: number;
  expectedMinutes?: number;
}

export interface OvertimeDetectedEvent extends OvertimeStatusEvent {}

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

export interface AllocationChangedEvent {
  userId: number;
  allocationId: number | null;
  projectId: number | null;
  projectName: string | null;
  startTime: string | null;
}

@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private readonly auth = inject(AuthService);
  private socket: Socket | null = null;

  readonly sessionChanged$ = new Subject<SessionStatusEvent>();
  readonly sessionUpdated$ = new Subject<SessionUpdatedEvent>();
  readonly overtimeChanged$ = new Subject<OvertimeStatusEvent>();
  readonly overtimeDetected$ = new Subject<OvertimeDetectedEvent>();
  readonly alertCreated$ = new Subject<AlertCreatedEvent>();
  readonly allocationChanged$ = new Subject<AllocationChangedEvent>();

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

    this.socket.on('session:updated', (payload: SessionUpdatedEvent) =>
      this.sessionUpdated$.next(payload),
    );

    this.socket.on('overtime:status-changed', (payload: OvertimeStatusEvent) =>
      this.overtimeChanged$.next(payload),
    );

    this.socket.on('overtime:detected', (payload: OvertimeDetectedEvent) =>
      this.overtimeDetected$.next(payload),
    );

    this.socket.on('alert:created', (payload: AlertCreatedEvent) =>
      this.alertCreated$.next(payload),
    );

    this.socket.on('project:allocation-changed', (payload: AllocationChangedEvent) =>
      this.allocationChanged$.next(payload),
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
