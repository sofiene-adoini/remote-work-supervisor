import { Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  LucideMonitor, LucideSmartphone, LucideTrash2, LucideRefreshCw,
  LucideCopy, LucideCheck, LucideClock, LucideShield, LucidePenLine, LucideDownload,
} from '@lucide/angular';
import { AgentDevicesService } from '../services/agent-devices.service';
import { AgentDevice } from '../models/agent-device.models';
import { AGENT_DOWNLOAD_URL, AGENT_VERSION } from '../../../core/constants/app.constants';

@Component({
  selector: 'app-desktop-agent',
  imports: [DatePipe, FormsModule, LucideMonitor, LucideSmartphone, LucideTrash2, LucideRefreshCw, LucideCopy, LucideCheck, LucideClock, LucideShield, LucidePenLine, LucideDownload],
  template: `
    <div class="page-container">
      <!-- Download Desktop Agent Section -->
      <div class="section-card">
        <div class="section-header">
          <div>
            <h2 class="section-title">Desktop Agent</h2>
            <p class="section-desc">Download and install the desktop agent, then pair it with your account.</p>
          </div>
          <span class="version-badge">v{{ agentVersion }}</span>
        </div>
        <div class="download-row">
          <div class="download-info">
            <span class="download-label">Latest Version</span>
            <span class="download-value">v{{ agentVersion }}</span>
            <span class="download-note">Windows 10/11 · 64-bit</span>
          </div>
          @if (agentDownloadUrl) {
            <a class="btn-primary download-btn" [href]="agentDownloadUrl" download>
              <svg lucideDownload class="icon-sm"></svg>
              Download Desktop Agent
            </a>
          }
        </div>
      </div>

      <!-- Pairing Code Section -->
      <div class="section-card">
        <div class="section-header">
          <h2 class="section-title">Pair Desktop Agent</h2>
          <p class="section-desc">Generate a code to pair your Electron desktop agent.</p>
        </div>

        @if (pairingCode()) {
          <div class="code-display">
            <span class="code-text">{{ pairingCode() }}</span>
            <button class="btn-icon" type="button" (click)="copyCode()" [title]="copied() ? 'Copied!' : 'Copy code'">
              @if (copied()) {
                <svg lucideCheck class="icon-sm"></svg>
              } @else {
                <svg lucideCopy class="icon-sm"></svg>
              }
            </button>
          </div>
          <div class="code-timer">
            <svg lucideClock class="icon-xs"></svg>
            <span>Expires in {{ codeCountdown() }}s</span>
          </div>
        }

        <button class="btn-primary" type="button" (click)="generateCode()" [disabled]="generatingCode()">
          @if (generatingCode()) {
            <svg lucideRefreshCw class="icon-sm spin"></svg>
            Generating...
          } @else if (pairingCode()) {
            <svg lucideRefreshCw class="icon-sm"></svg>
            Generate New Code
          } @else {
            <svg lucideShield class="icon-sm"></svg>
            Generate Pairing Code
          }
        </button>
      </div>

      <!-- Trusted Devices Section -->
      <div class="section-card">
        <div class="section-header">
          <h2 class="section-title">Trusted Devices</h2>
          <button class="btn-ghost" type="button" (click)="loadDevices()">
            <svg lucideRefreshCw class="icon-sm" [class.spin]="loadingDevices()"></svg>
            Refresh
          </button>
        </div>

        @if (loadingDevices()) {
          <div class="sk-list">
            @for (i of [1,2]; track i) {
              <div class="sk sk-row-lg"></div>
            }
          </div>
        } @else if (devices().length === 0) {
          <div class="empty-state">
            <svg lucideMonitor class="empty-icon"></svg>
            <p class="empty-text">No trusted devices</p>
            <p class="empty-sub">Generate a pairing code to connect your desktop agent.</p>
          </div>
        } @else {
          <div class="device-list">
            @for (device of devices(); track device.id) {
              <div class="device-card" [class.revoked]="device.revoked" [class.inactive]="!device.active">
                <div class="device-icon">
                  @if (device.operatingSystem.toLowerCase().includes('mac')) {
                    <svg lucideSmartphone class="icon-md"></svg>
                  } @else {
                    <svg lucideMonitor class="icon-md"></svg>
                  }
                </div>
                <div class="device-info">
                  <div class="device-header">
                    <span class="device-name">
                      {{ editingDeviceId() === device.id ? '' : device.deviceName }}
                      @if (editingDeviceId() === device.id) {
                        <input
                          class="rename-input"
                          [value]="device.deviceName"
                          (keydown.enter)="saveRename(device, $any($event.target).value)"
                          (keydown.escape)="editingDeviceId.set(null)"
                          (blur)="saveRename(device, $any($event.target).value)"
                          autofocus
                        />
                      }
                    </span>
                    <span class="device-status" [class]="deviceStatusClass(device)">
                      {{ deviceStatusLabel(device) }}
                    </span>
                  </div>
                  <div class="device-meta">
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
                    @if (!device.revoked) {
                      <span class="dot">·</span>
                      <span>Trust expires {{ device.trustExpiresAt | date:'mediumDate' }}</span>
                    }
                  </div>
                </div>
                <div class="device-actions">
                  @if (device.active && !device.revoked) {
                    <button class="btn-icon-sm" type="button" (click)="startRename(device)" title="Rename">
                      <svg lucidePenLine class="icon-xs"></svg>
                    </button>
                    <button class="btn-icon-sm btn-danger" type="button" (click)="unpairDevice(device)" title="Disconnect">
                      <svg lucideTrash2 class="icon-xs"></svg>
                    </button>
                  }
                </div>
              </div>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    @use 'styles/design-tokens' as t;

    .page-container {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .section-card {
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
      padding: 1.5rem;
    }

    .section-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 1rem;
    }

    .section-title {
      margin: 0;
      font-size: 1.125rem;
      font-weight: 600;
      color: var(--rws-text);
    }

    .section-desc {
      margin: 0.25rem 0 0;
      font-size: 0.8125rem;
      color: var(--rws-text-muted);
    }

    .version-badge {
      padding: 0.25rem 0.625rem;
      border-radius: 999px;
      background: #e8f8f6;
      color: #167d72;
      font-size: 0.75rem;
      font-weight: 600;
      font-family: var(--rws-font-mono);
    }

    .download-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      flex-wrap: wrap;
      padding-top: 0.5rem;
    }

    .download-info {
      display: flex;
      align-items: baseline;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .download-label { font-size: 0.75rem; font-weight: 500; color: var(--rws-text-muted); }
    .download-value { font-size: 0.875rem; font-weight: 600; color: var(--rws-text); font-family: var(--rws-font-mono); }
    .download-note { font-size: 0.75rem; color: var(--rws-text-muted); }
    .download-btn { text-decoration: none; }

    .code-display {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 1rem 1.25rem;
      background: #f8fbff;
      border: 2px dashed var(--rws-accent);
      border-radius: var(--rws-radius);
      margin-bottom: 0.75rem;
    }

    .code-text {
      font-size: 1.75rem;
      font-weight: 700;
      font-family: var(--rws-font-mono);
      color: var(--rws-primary);
      letter-spacing: 0.1em;
    }

    .code-timer {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      font-size: 0.8125rem;
      color: var(--rws-text-muted);
      margin-bottom: 1rem;
    }

    .btn-primary {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.625rem 1.25rem;
      border: none;
      border-radius: var(--rws-radius);
      background: var(--rws-primary);
      color: #fff;
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
      transition: background 150ms ease, opacity 150ms ease;

      &:hover { background: var(--rws-accent-strong); }
      &:disabled { opacity: 0.6; cursor: not-allowed; }
      &:focus-visible { outline: 3px solid var(--rws-focus-ring); outline-offset: 2px; }
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

    .btn-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border: 1px solid var(--rws-border);
      border-radius: var(--rws-radius);
      background: #fff;
      color: var(--rws-text-muted);
      cursor: pointer;
      transition: color 150ms ease, border-color 150ms ease;

      &:hover { color: var(--rws-accent); border-color: var(--rws-accent); }
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
      padding: 3rem 2rem;
      text-align: center;
    }

    .empty-icon { width: 40px; height: 40px; color: var(--rws-text-muted); opacity: 0.3; margin-bottom: 1rem; }
    .empty-text { margin: 0 0 0.375rem; font-size: 1rem; font-weight: 500; color: var(--rws-text); }
    .empty-sub { margin: 0; font-size: 0.8125rem; color: var(--rws-text-muted); }

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
      border: 1px solid var(--rws-border);
      border-radius: 12px;
      transition: border-color 150ms ease;

      &:hover { border-color: #d0d5dd; }
      &.revoked { opacity: 0.5; }
      &.inactive { opacity: 0.5; }
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

    .btn-icon-sm {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 30px;
      height: 30px;
      border: 1px solid var(--rws-border);
      border-radius: var(--rws-radius);
      background: #fff;
      color: var(--rws-text-muted);
      cursor: pointer;
      transition: color 150ms ease, border-color 150ms ease, background 150ms ease;

      &:hover { color: var(--rws-text); border-color: #d0d5dd; }
      &.btn-danger:hover { color: #d64545; border-color: #d64545; background: #fde8e8; }
      &:focus-visible { outline: 3px solid var(--rws-focus-ring); outline-offset: 2px; }
    }

    .rename-input {
      padding: 0.125rem 0.375rem;
      border: 1px solid var(--rws-accent);
      border-radius: 4px;
      font-size: 0.9375rem;
      font-weight: 600;
      font-family: inherit;
      color: var(--rws-text);
      outline: none;
      width: 160px;
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
export class DesktopAgentComponent implements OnInit {
  private readonly agentDevices = inject(AgentDevicesService);

  protected readonly devices = signal<AgentDevice[]>([]);
  protected readonly loadingDevices = signal(true);
  protected readonly pairingCode = signal<string | null>(null);
  protected readonly codeCountdown = signal(0);
  protected readonly generatingCode = signal(false);
  protected readonly copied = signal(false);
  protected readonly editingDeviceId = signal<number | null>(null);

  protected readonly agentVersion = AGENT_VERSION;
  protected readonly agentDownloadUrl = AGENT_DOWNLOAD_URL;

  private countdownInterval: any;

  ngOnInit(): void {
    this.loadDevices();
  }

  loadDevices(): void {
    this.loadingDevices.set(true);
    this.agentDevices.listDevices().subscribe({
      next: (res) => {
        this.devices.set(res.devices);
        this.loadingDevices.set(false);
      },
      error: () => this.loadingDevices.set(false),
    });
  }

  generateCode(): void {
    this.generatingCode.set(true);
    this.agentDevices.generateCode().subscribe({
      next: (res) => {
        this.pairingCode.set(res.code);
        this.generatingCode.set(false);
        this.copied.set(false);
        this.startCountdown();
      },
      error: () => this.generatingCode.set(false),
    });
  }

  copyCode(): void {
    const code = this.pairingCode();
    if (code) {
      navigator.clipboard.writeText(code);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    }
  }

  unpairDevice(device: AgentDevice): void {
    this.agentDevices.unpairDevice(device.id).subscribe({
      next: () => {
        this.devices.update((list) =>
          list.map((d) => d.id === device.id ? { ...d, active: false, revoked: true, revokedAt: new Date().toISOString() } : d)
        );
      },
    });
  }

  startRename(device: AgentDevice): void {
    this.editingDeviceId.set(device.id);
  }

  saveRename(device: AgentDevice, newName: string): void {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === device.deviceName) {
      this.editingDeviceId.set(null);
      return;
    }
    this.agentDevices.renameDevice(device.id, trimmed).subscribe({
      next: (res) => {
        this.devices.update((list) =>
          list.map((d) => d.id === device.id ? { ...d, deviceName: res.device.deviceName } : d)
        );
        this.editingDeviceId.set(null);
      },
      error: () => this.editingDeviceId.set(null),
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

  private startCountdown(): void {
    if (this.countdownInterval) clearInterval(this.countdownInterval);
    this.codeCountdown.set(60);
    this.countdownInterval = setInterval(() => {
      const current = this.codeCountdown();
      if (current <= 1) {
        clearInterval(this.countdownInterval);
        this.pairingCode.set(null);
        this.codeCountdown.set(0);
      } else {
        this.codeCountdown.update((c) => c - 1);
      }
    }, 1000);
  }
}
