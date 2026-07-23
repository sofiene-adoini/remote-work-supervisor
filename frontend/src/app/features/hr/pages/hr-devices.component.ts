import { Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { LucideMonitor, LucideSmartphone, LucideTrash2, LucideRefreshCw, LucideShield } from '@lucide/angular';
import { AgentDevicesService } from '../../employee/services/agent-devices.service';
import { AgentDevice } from '../../employee/models/agent-device.models';

@Component({
  selector: 'app-hr-devices',
  imports: [DatePipe, LucideMonitor, LucideSmartphone, LucideTrash2, LucideRefreshCw, LucideShield],
  template: `
    <div class="page-container">
      <div class="page-header">
        <h1 class="page-title">Trusted Devices</h1>
        <button class="btn-ghost" type="button" (click)="loadDevices()">
          <svg lucideRefreshCw class="icon-sm" [class.spin]="loading()"></svg>
          Refresh
        </button>
      </div>

      @if (loading()) {
        <div class="sk-list">
          @for (i of [1,2,3]; track i) {
            <div class="sk sk-row-lg"></div>
          }
        </div>
      } @else if (devices().length === 0) {
        <div class="empty-state">
          <svg lucideShield class="empty-icon"></svg>
          <p class="empty-text">No trusted devices</p>
          <p class="empty-sub">Employees will see their paired devices here.</p>
        </div>
      } @else {
        <div class="device-list">
          @for (device of devices(); track device.id) {
            <div class="device-card" [class.revoked]="device.revoked">
              <div class="device-icon">
                @if (device.operatingSystem.toLowerCase().includes('mac')) {
                  <svg lucideSmartphone class="icon-md"></svg>
                } @else {
                  <svg lucideMonitor class="icon-md"></svg>
                }
              </div>
              <div class="device-info">
                <div class="device-header">
                  <span class="device-name">{{ device.deviceName }}</span>
                  <span class="device-status" [class]="deviceStatusClass(device)">
                    {{ deviceStatusLabel(device) }}
                  </span>
                </div>
                <div class="device-meta">
                  @if (device.employee) {
                    <span class="device-owner">{{ device.employee.fullName }}</span>
                    <span class="dot">·</span>
                  }
                  <span>{{ device.hostname }}</span>
                  <span class="dot">·</span>
                  <span>{{ device.operatingSystem }}</span>
                  <span class="dot">·</span>
                  <span>v{{ device.agentVersion }}</span>
                </div>
                <div class="device-dates">
                  <span>Paired {{ device.pairedAt | date:'mediumDate' }}</span>
                  @if (device.lastSeenAt) {
                    <span class="dot">·</span>
                    <span>Last seen {{ device.lastSeenAt | date:'short' }}</span>
                  }
                </div>
              </div>
              <div class="device-actions">
                @if (device.active && !device.revoked) {
                  <button class="btn-danger-sm" type="button" (click)="revokeDevice(device)" title="Revoke access">
                    <svg lucideTrash2 class="icon-xs"></svg>
                    Revoke
                  </button>
                }
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    @use 'styles/design-tokens' as t;

    .page-container { width: 100%; }

    .page-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1.5rem;
    }

    .page-title {
      margin: 0;
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--rws-text);
    }

    .btn-ghost {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.375rem 0.75rem;
      border: 1px solid var(--rws-border);
      border-radius: var(--rws-radius);
      background: #fff;
      color: var(--rws-text);
      font-size: 0.8125rem;
      font-weight: 500;
      cursor: pointer;
      font-family: inherit;
      transition: border-color 150ms ease;

      &:hover { border-color: var(--rws-accent); color: var(--rws-accent); }
      &:focus-visible { outline: 3px solid var(--rws-focus-ring); outline-offset: 2px; }
    }

    .icon-xs { width: 14px; height: 14px; }
    .icon-sm { width: 16px; height: 16px; }
    .icon-md { width: 20px; height: 20px; }

    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    .spin { animation: spin 1s linear infinite; }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 4rem 2rem;
      text-align: center;
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    }

    .empty-icon { width: 48px; height: 48px; color: var(--rws-text-muted); opacity: 0.3; margin-bottom: 1rem; }
    .empty-text { margin: 0 0 0.375rem; font-size: 1.0625rem; font-weight: 500; color: var(--rws-text); }
    .empty-sub { margin: 0; font-size: 0.875rem; color: var(--rws-text-muted); }

    .device-list {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .device-card {
      display: flex;
      align-items: flex-start;
      gap: 1rem;
      padding: 1rem 1.25rem;
      background: #fff;
      border: 1px solid var(--rws-border);
      border-radius: 12px;
      transition: border-color 150ms ease;

      &:hover { border-color: #d0d5dd; }
      &.revoked { opacity: 0.5; }
    }

    .device-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      border-radius: 10px;
      background: #e8f1fb;
      color: var(--rws-primary);
      flex-shrink: 0;
    }

    .device-info { flex: 1; min-width: 0; }

    .device-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.25rem;
    }

    .device-name {
      font-size: 0.9375rem;
      font-weight: 600;
      color: var(--rws-text);
    }

    .device-status {
      font-size: 0.6875rem;
      font-weight: 600;
      padding: 0.125rem 0.5rem;
      border-radius: 999px;

      &.status-online { background: #e8f8f6; color: #167d72; }
      &.status-offline { background: var(--rws-bg); color: var(--rws-text-muted); }
      &.status-revoked { background: #fde8e8; color: #b91c1c; }
      &.status-expired { background: #fef3e2; color: #92610a; }
    }

    .device-meta {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      font-size: 0.8125rem;
      color: var(--rws-text-muted);
      margin-bottom: 0.25rem;
    }

    .device-owner {
      font-weight: 600;
      color: var(--rws-primary);
    }

    .device-dates {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      font-size: 0.75rem;
      color: var(--rws-text-muted);
    }

    .dot { opacity: 0.4; }

    .device-actions {
      display: flex;
      gap: 0.375rem;
      flex-shrink: 0;
    }

    .btn-danger-sm {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.375rem 0.75rem;
      border: 1px solid #d64545;
      border-radius: var(--rws-radius);
      background: #fff;
      color: #d64545;
      font-size: 0.75rem;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
      transition: background 150ms ease, color 150ms ease;

      &:hover { background: #fde8e8; }
      &:focus-visible { outline: 3px solid var(--rws-focus-ring); outline-offset: 2px; }
    }

    .sk-list {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .sk-row-lg {
      height: 80px;
      border-radius: 12px;
      background: linear-gradient(90deg, #f0f2f5 25%, #e8eaed 50%, #f0f2f5 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
    }

    @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
    }
  `],
})
export class HrDevicesComponent implements OnInit {
  private readonly agentDevices = inject(AgentDevicesService);

  protected readonly devices = signal<AgentDevice[]>([]);
  protected readonly loading = signal(true);

  ngOnInit(): void {
    this.loadDevices();
  }

  loadDevices(): void {
    this.loading.set(true);
    this.agentDevices.hrListAllDevices().subscribe({
      next: (res) => {
        this.devices.set(res.devices);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  revokeDevice(device: AgentDevice): void {
    this.agentDevices.revokeByHr(device.id).subscribe({
      next: () => {
        this.devices.update((list) =>
          list.map((d) => d.id === device.id ? { ...d, active: false, revoked: true, revokedAt: new Date().toISOString() } : d)
        );
      },
    });
  }

  deviceStatusLabel(device: AgentDevice): string {
    if (device.revoked) return 'Revoked';
    if (!device.active) return 'Inactive';
    if (new Date(device.trustExpiresAt) < new Date()) return 'Expired';
    if (device.lastSeenAt) {
      const lastSeen = new Date(device.lastSeenAt).getTime();
      if (Date.now() - lastSeen < 5 * 60 * 1000) return 'Online';
    }
    return 'Offline';
  }

  deviceStatusClass(device: AgentDevice): string {
    if (device.revoked) return 'status-revoked';
    if (!device.active) return 'status-revoked';
    if (new Date(device.trustExpiresAt) < new Date()) return 'status-expired';
    if (device.lastSeenAt) {
      const lastSeen = new Date(device.lastSeenAt).getTime();
      if (Date.now() - lastSeen < 5 * 60 * 1000) return 'status-online';
    }
    return 'status-offline';
  }
}
