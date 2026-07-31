const config = require('../config/config');

const API_BASE_URL = config.server.apiBaseUrl;

let authToken = null;

function setAuthToken(token) {
  authToken = token;
}

function clearAuthToken() {
  authToken = null;
}

function getAuthToken() {
  return authToken;
}

async function apiRequest(endpoint, options = {}) {
  const headers = {
    ...(options.headers || {}),
  };

  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    const err = new Error(data?.error?.message || data?.error || data?.message || 'API request failed');
    err.status = response.status;
    err.body = data;
    throw err;
  }

  return data;
}

// ── Agent pairing / auth endpoints ─────────────────────────────────

async function pairDevice(code, deviceInfo) {
  return apiRequest('/agent/pair', {
    method: 'POST',
    body: JSON.stringify({ code, ...deviceInfo }),
  });
}

async function refreshToken(deviceId, refreshToken) {
  return apiRequest('/agent/refresh', {
    method: 'POST',
    body: JSON.stringify({ deviceId, refreshToken }),
  });
}

async function sendHeartbeat(deviceId) {
  return apiRequest('/agent/heartbeat', {
    method: 'POST',
    body: JSON.stringify({ deviceId }),
  });
}

async function unpairSelf(deviceId) {
  return apiRequest('/agent/unpair-self', {
    method: 'POST',
    body: JSON.stringify({ deviceId }),
  });
}

// ── Session endpoints ──────────────────────────────────────────────

async function clockIn() {
  return apiRequest('/sessions/clock-in', { method: 'POST' });
}

async function clockOut() {
  return apiRequest('/sessions/clock-out', { method: 'POST' });
}

async function startBreak(reason) {
  return apiRequest('/sessions/break-start', {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

async function endBreak() {
  return apiRequest('/sessions/break-end', { method: 'POST' });
}

async function reportIdle(idleMs) {
  return apiRequest('/sessions/idle-detected', {
    method: 'POST',
    body: JSON.stringify({ idleMs }),
  });
}

// ── ScreenshotAnalysis (metadata only — no screenshot upload) ──────

async function createScreenshotAnalysis({ capturedAt, diffScore, isSuspicious, analysisStatus }) {
  return apiRequest('/screenshot-analyses/submit', {
    method: 'POST',
    body: JSON.stringify({
      capturedAt,
      diffScore,
      isSuspicious,
      analysisStatus,
    }),
  });
}

module.exports = {
  setAuthToken,
  clearAuthToken,
  getAuthToken,
  apiRequest,
  pairDevice,
  refreshToken,
  sendHeartbeat,
  unpairSelf,
  clockIn,
  clockOut,
  startBreak,
  endBreak,
  reportIdle,
  createScreenshotAnalysis,
};
