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

  // Only set Content-Type for non-FormData bodies (FormData sets its own boundary)
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
  return apiRequest('/sessions/break-start', { method: 'POST' });
}

async function endBreak() {
  return apiRequest('/sessions/break-end', { method: 'POST' });
}

// ── Screenshot upload ──────────────────────────────────────────────
// Uses Strapi's built-in upload plugin (POST /api/upload, multipart/form-data).

async function uploadScreenshot(imageBuffer) {
  const formData = new FormData();
  formData.append(
    'files',
    new Blob([imageBuffer], { type: 'image/png' }),
    `screenshot-${Date.now()}.png`,
  );

  return apiRequest('/upload', {
    method: 'POST',
    body: formData,
  });
}

// ── ScreenshotAnalysis ────────────────────────────────────────────

async function createScreenshotAnalysis({ capturedAt, diffScore, isSuspicious, analysisStatus, screenshotId }) {
  return apiRequest('/screenshot-analyses/submit', {
    method: 'POST',
    body: JSON.stringify({
      capturedAt,
      diffScore,
      isSuspicious,
      analysisStatus,
      screenshotId,
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
  uploadScreenshot,
  createScreenshotAnalysis,
};
