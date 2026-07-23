const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('agent', {
  // ── Auth lifecycle ──────────────────────────────────────────────────
  pairDevice: (code) => ipcRenderer.invoke('pair-device', code),
  autoLogin: () => ipcRenderer.invoke('auto-login'),
  logout: () => ipcRenderer.invoke('logout'),

  // ── Device info ─────────────────────────────────────────────────────
  getDeviceInfo: () => ipcRenderer.invoke('get-device-info'),
  getCredentialInfo: () => ipcRenderer.invoke('get-credential-info'),

  // ── Sessions ────────────────────────────────────────────────────────
  clockIn: () => ipcRenderer.invoke('clock-in'),
  clockOut: () => ipcRenderer.invoke('clock-out'),
  startBreak: (reason) => ipcRenderer.invoke('start-break', reason),
  endBreak: () => ipcRenderer.invoke('end-break'),
  getStatus: () => ipcRenderer.invoke('get-status'),

  // ── Event listeners (main → renderer) ───────────────────────────────
  onPairingRequired: (callback) => {
    ipcRenderer.on('pairing-required', (_event, data) => callback(data));
  },
  onAutoLoginSuccess: (callback) => {
    ipcRenderer.on('auto-login-success', (_event, data) => callback(data));
  },
  onTrustExpired: (callback) => {
    ipcRenderer.on('trust-expired', (_event, data) => callback(data));
  },
  onSessionUpdate: (callback) => {
    ipcRenderer.on('session-update', (_event, data) => callback(data));
  },

  // ── Cleanup listener helpers ────────────────────────────────────────
  removeAllListeners: () => {
    ipcRenderer.removeAllListeners('pairing-required');
    ipcRenderer.removeAllListeners('auto-login-success');
    ipcRenderer.removeAllListeners('trust-expired');
    ipcRenderer.removeAllListeners('session-update');
  },
});
