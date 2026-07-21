const API_BASE_URL = 'http://localhost:1337/api';

let authToken = null;

function setAuthToken(token) {
  authToken = token;
}

function clearAuthToken() {
  authToken = null;
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
    throw new Error(data?.error?.message || 'API request failed');
  }

  return data;
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
  apiRequest,
  clockIn,
  clockOut,
  startBreak,
  endBreak,
  reportIdle,
  createScreenshotAnalysis,
};
