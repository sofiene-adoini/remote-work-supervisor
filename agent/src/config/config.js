const fs = require('fs');
const path = require('path');

function loadDotEnv() {
  const envFile = path.join(__dirname, '..', '..', '.env');
  const values = {};
  try {
    const content = fs.readFileSync(envFile, 'utf8');
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      values[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
    }
  } catch {
    // .env is optional — fall back to defaults
  }
  return values;
}

const dotenv = loadDotEnv();

function resolve(key, fallback) {
  const raw = process.env[key] ?? dotenv[key];
  return raw !== undefined && raw !== '' ? raw : fallback;
}

function num(key, fallback) {
  const raw = resolve(key, '');
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, '');
}

const config = {
  server: {
    apiBaseUrl: trimTrailingSlash(resolve('AGENT_API_BASE_URL', 'http://localhost:1337/api')),
    serverUrl: trimTrailingSlash(resolve('AGENT_SERVER_URL', 'http://localhost:1337')),
  },
  heartbeat: {
    intervalMs: num('AGENT_HEARTBEAT_MS', 5 * 60 * 1000),
    refreshMs: num('AGENT_REFRESH_MS', 55 * 60 * 1000),
  },
  tracking: {
    idleThresholdMs: num('AGENT_IDLE_THRESHOLD_MS', 5 * 60 * 1000),
    autoBreakThresholdMs: num('AGENT_AUTO_BREAK_THRESHOLD_MS', 15 * 60 * 1000),
    checkIntervalMs: num('AGENT_CHECK_INTERVAL_MS', 30 * 1000),
  },
  screenshots: {
    captureIntervalMs: num('AGENT_CAPTURE_INTERVAL_MS', 10 * 60 * 1000),
  },
};

module.exports = config;
