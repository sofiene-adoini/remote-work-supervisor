const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

const { setAuthToken, clearAuthToken, clockIn, clockOut, startBreak, endBreak, reportIdle } = require('./src/api/api');
const { setSessionState, getSessionState, resetSessionState } = require('./src/state/session-state');
const tracker = require('./src/tracking/agent-tracker');
const screenshot = require('./src/screenshots/agent-screenshot');
const realtime = require('./src/realtime/realtime-agent');

let mainWindow;

// ── Window ─────────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 500,
    height: 400,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
}

// ── Auto-break callbacks (called by the tracker) ───────────────────
// These must be defined before any IPC handler calls tracker.startTracking().

async function handleAutoBreakStart() {
  try {
    await startBreak('auto-idle');
    setSessionState({ status: 'break' });
    tracker.setStatus('break');
    screenshot.setStatus('break');
  } catch (err) {
    console.error('[agent] auto-break-start API failed:', err.message);
    // Reconcile: the tracker optimistically set its own status to 'break';
    // reset it so the idle detector re-evaluates on the next tick.
    tracker.setStatus('active');
    screenshot.setStatus('active');
    setSessionState({ status: 'active' });
  }
}

async function handleAutoBreakEnd() {
  try {
    await endBreak();
    setSessionState({ status: 'active' });
    tracker.setStatus('active');
    screenshot.setStatus('active');
  } catch (err) {
    console.error('[agent] auto-break-end API failed:', err.message);
    // Leave the session in break state — the tracker will retry on the next
    // activity-resumed tick since its internal autoBreakActive flag was cleared.
  }
}

// ── IPC handlers ───────────────────────────────────────────────────

ipcMain.handle('set-auth-token', (_event, token) => {
  setAuthToken(token);
  setSessionState({ isAuthenticated: true });
  realtime.connect(token);
  return { ok: true };
});

ipcMain.handle('clear-auth-token', () => {
  realtime.disconnect();
  clearAuthToken();
  resetSessionState();
  tracker.stopTracking();
  screenshot.stopCapturing();
  return { ok: true };
});

ipcMain.handle('clock-in', async () => {
  try {
    const result = await clockIn();
    const session = result.session;

    setSessionState({ status: 'active', employeeId: session.user });
    tracker.setStatus('active');
    screenshot.setStatus('active');

    tracker.startTracking({
      onAutoBreakStart: handleAutoBreakStart,
      onAutoBreakEnd: handleAutoBreakEnd,
      onActivityStateChange: ({ state, idleMs }) => {
        if (state === 'idle' && idleMs > 0) {
          reportIdle(idleMs).catch((err) => {
            console.error('[agent] reportIdle failed:', err.message);
          });
        }
      },
    });
    screenshot.startCapturing();

    return { ok: true, session };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('clock-out', async () => {
  try {
    const result = await clockOut();

    tracker.stopTracking();
    screenshot.stopCapturing();
    resetSessionState();
    tracker.setStatus('clocked_out');
    screenshot.setStatus('clocked_out');

    return { ok: true, session: result.session };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('start-break', async (_event, reason) => {
  try {
    const result = await startBreak(reason);

    setSessionState({ status: 'break' });
    tracker.setStatus('break');
    screenshot.setStatus('break');

    return { ok: true, session: result.session };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('end-break', async () => {
  try {
    const result = await endBreak();

    setSessionState({ status: 'active' });
    tracker.setStatus('active');
    screenshot.setStatus('active');

    return { ok: true, session: result.session };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('get-status', () => {
  return getSessionState();
});

ipcMain.handle('connect-realtime', () => {
  const token = realtime.getToken();
  if (!token) return { ok: false, error: 'No auth token available' };
  realtime.connect(token);
  return { ok: true };
});

ipcMain.handle('disconnect-realtime', () => {
  realtime.disconnect();
  return { ok: true };
});

ipcMain.handle('is-realtime-connected', () => {
  return { connected: realtime.isConnected() };
});

// ── App lifecycle ──────────────────────────────────────────────────

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  realtime.disconnect();
  tracker.stopTracking();
  screenshot.stopCapturing();

  if (process.platform !== 'darwin') {
    app.quit();
  }
});
