const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const os = require('os');

const {
  setAuthToken,
  clearAuthToken,
  getAuthToken,
  clockIn,
  clockOut,
  startBreak,
  endBreak,
  reportIdle,
  pairDevice,
  refreshToken,
  sendHeartbeat,
  unpairSelf,
} = require('./src/api/api');
const { setSessionState, getSessionState, resetSessionState } = require('./src/state/session-state');
const tracker = require('./src/tracking/agent-tracker');
const screenshot = require('./src/screenshots/agent-screenshot');
const realtime = require('./src/realtime/realtime-agent');
const SecureStorage = require('./src/auth/secure-storage');

let mainWindow;
let heartbeatInterval = null;
let refreshInterval = null;

const secureStorage = new SecureStorage({
  userDataPath: app.getPath('userData'),
});

const HEARTBEAT_MS = 5 * 60 * 1000;
const REFRESH_MS = 55 * 60 * 1000;

// ── Device info (static — computed once) ───────────────────────────

function getDeviceInfo() {
  return {
    hostname: os.hostname(),
    platform: os.platform(),
    release: os.release(),
    agentVersion: app.getVersion() || '1.0.0',
  };
}

// ── Auto-break callbacks (called by the tracker) ───────────────────

async function handleAutoBreakStart() {
  try {
    await startBreak('auto-idle');
    setSessionState({ status: 'break' });
    tracker.setStatus('break');
    screenshot.setStatus('break');
    notifyRenderer('session-update', getSessionState());
  } catch (err) {
    console.error('[agent] auto-break-start API failed:', err.message);
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
    notifyRenderer('session-update', getSessionState());
  } catch (err) {
    console.error('[agent] auto-break-end API failed:', err.message);
  }
}

// ── Heartbeat ──────────────────────────────────────────────────────

function startHeartbeat() {
  stopHeartbeat();
  heartbeatInterval = setInterval(async () => {
    try {
      const creds = await secureStorage.load();
      if (!creds?.deviceId) return;
      await sendHeartbeat(creds.deviceId);
    } catch (err) {
      console.error('[agent] heartbeat failed:', err.message);
      if (isAuthError(err)) {
        await handleAuthFailure('Heartbeat authentication failed');
      }
    }
  }, HEARTBEAT_MS);
}

function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

// ── Token auto-refresh ─────────────────────────────────────────────

function startAutoRefresh() {
  stopAutoRefresh();
  refreshInterval = setInterval(async () => {
    await doRefresh();
  }, REFRESH_MS);
}

function stopAutoRefresh() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
}

async function doRefresh() {
  try {
    const creds = await secureStorage.load();
    if (!creds?.deviceId || !creds?.refreshToken) return;

    const result = await refreshToken(creds.deviceId, creds.refreshToken);
    if (result.jwt) {
      setAuthToken(result.jwt);
      if (result.refreshToken) {
        await secureStorage.save({
          deviceId: creds.deviceId,
          refreshToken: result.refreshToken,
          trustExpiresAt: creds.trustExpiresAt,
        });
      }
      console.log('[agent] JWT refreshed successfully');
    }
  } catch (err) {
    console.error('[agent] auto-refresh failed:', err.message);
    if (isAuthError(err)) {
      await handleAuthFailure('Token refresh failed — device may be revoked or trust expired');
    }
  }
}

// ── Auth error detection ───────────────────────────────────────────

function isAuthError(err) {
  const msg = (err.message || '').toLowerCase();
  return (
    err.status === 401 ||
    err.status === 403 ||
    msg.includes('device_trust_expired') ||
    msg.includes('not found') ||
    msg.includes('revoked') ||
    msg.includes('authentication required') ||
    msg.includes('device not found')
  );
}

// ── Auth failure handling ──────────────────────────────────────────

async function handleAuthFailure(reason) {
  console.log(`[agent] Auth failure: ${reason} — returning to pairing screen`);
  await fullTeardown();
  await secureStorage.clear();
  notifyRenderer('pairing-required', { reason });
}

// ── Full teardown (stops all active sessions, connections, timers) ──

async function fullTeardown() {
  stopHeartbeat();
  stopAutoRefresh();
  clearAuthToken();
  resetSessionState();
  tracker.stopTracking();
  screenshot.stopCapturing();
  realtime.disconnect();
}

// ── Renderer communication ─────────────────────────────────────────

function notifyRenderer(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

// ── Auto-login on startup ──────────────────────────────────────────

async function attemptAutoLogin() {
  try {
    const creds = await secureStorage.load();
    if (!creds?.deviceId || !creds?.refreshToken) {
      notifyRenderer('pairing-required', { reason: 'No stored credentials' });
      return;
    }

    const result = await refreshToken(creds.deviceId, creds.refreshToken);
    if (!result.jwt) {
      await handleAuthFailure('Refresh returned no JWT');
      return;
    }

    if (result.refreshToken) {
      await secureStorage.save({
        deviceId: creds.deviceId,
        refreshToken: result.refreshToken,
        trustExpiresAt: creds.trustExpiresAt,
      });
    }

    setAuthToken(result.jwt);
    setSessionState({ isAuthenticated: true });
    realtime.connect(result.jwt);
    startHeartbeat();
    startAutoRefresh();

    notifyRenderer('auto-login-success', {
      deviceId: creds.deviceId,
      trustExpiresAt: creds.trustExpiresAt,
    });
  } catch (err) {
    console.error('[agent] Auto-login failed:', err.message);
    await handleAuthFailure('Auto-login failed: ' + err.message);
  }
}

// ── Pairing flow (called from renderer) ────────────────────────────

async function handlePair(code) {
  const info = getDeviceInfo();
  const deviceName = `${info.hostname} (${info.platform})`;

  try {
    const result = await pairDevice(code, {
      deviceName,
      hostname: info.hostname,
      operatingSystem: `${info.platform} ${info.release}`,
      agentVersion: info.agentVersion,
    });

    await secureStorage.save({
      deviceId: result.deviceId,
      refreshToken: result.refreshToken || result.deviceId,
      trustExpiresAt: result.trustExpiresAt,
    });

    setAuthToken(result.jwt);
    setSessionState({ isAuthenticated: true });
    realtime.connect(result.jwt);
    startHeartbeat();
    startAutoRefresh();

    return {
      ok: true,
      deviceId: result.deviceId,
      trustExpiresAt: result.trustExpiresAt,
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ── Logout flow ────────────────────────────────────────────────────

async function handleLogout() {
  try {
    const creds = await secureStorage.load();
    if (creds?.deviceId && getAuthToken()) {
      await unpairSelf(creds.deviceId).catch((err) => {
        console.error('[agent] Backend unpair failed (continuing):', err.message);
      });
    }
  } catch {
    // best-effort
  }

  await fullTeardown();
  await secureStorage.clear();
  notifyRenderer('pairing-required', { reason: 'User logged out' });
}

// ── Window ─────────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 520,
    height: 520,
    resizable: false,
    title: 'The Guardian',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
}

// ── IPC handlers ───────────────────────────────────────────────────

// ── Pairing ────────────────────────────────────────────────────────

ipcMain.handle('pair-device', async (_event, code) => {
  return handlePair(code);
});

ipcMain.handle('auto-login', async () => {
  await attemptAutoLogin();
  return { ok: true };
});

ipcMain.handle('logout', async () => {
  await handleLogout();
  return { ok: true };
});

// ── Device info ────────────────────────────────────────────────────

ipcMain.handle('get-device-info', () => {
  return getDeviceInfo();
});

ipcMain.handle('get-credential-info', async () => {
  const creds = await secureStorage.load();
  if (!creds) return null;
  return {
    deviceId: creds.deviceId,
    trustExpiresAt: creds.trustExpiresAt,
  };
});

// ── Sessions ───────────────────────────────────────────────────────

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
    if (isAuthError(err)) await handleAuthFailure(err.message);
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
    if (isAuthError(err)) await handleAuthFailure(err.message);
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
    if (isAuthError(err)) await handleAuthFailure(err.message);
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
    if (isAuthError(err)) await handleAuthFailure(err.message);
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('get-status', () => {
  return getSessionState();
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

app.on('window-all-closed', async () => {
  const state = getSessionState();
  if (state.isAuthenticated && state.status !== 'clocked_out') {
    try {
      await clockOut();
      console.log('[agent] Auto clock-out on exit');
    } catch {
      console.warn('[agent] Auto clock-out on exit failed (best-effort)');
    }
  }
  await fullTeardown();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
