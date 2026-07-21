const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('agent', {
  setAuthToken: (token) => ipcRenderer.invoke('set-auth-token', token),
  clearAuthToken: () => ipcRenderer.invoke('clear-auth-token'),
  clockIn: () => ipcRenderer.invoke('clock-in'),
  clockOut: () => ipcRenderer.invoke('clock-out'),
  startBreak: (reason) => ipcRenderer.invoke('start-break', reason),
  endBreak: () => ipcRenderer.invoke('end-break'),
  getStatus: () => ipcRenderer.invoke('get-status'),
  connectRealtime: () => ipcRenderer.invoke('connect-realtime'),
  disconnectRealtime: () => ipcRenderer.invoke('disconnect-realtime'),
  isRealtimeConnected: () => ipcRenderer.invoke('is-realtime-connected'),
});
