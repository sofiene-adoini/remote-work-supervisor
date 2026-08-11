const fs = require('fs');
const path = require('path');

function loadDotEnv(fileName) {
  const envFile = path.join(__dirname, '..', '..', fileName);
  const values = {};
  try {
    const content = fs.readFileSync(envFile, 'utf8');
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      let rawValue = trimmed.slice(eq + 1);
      // Strip trailing inline comments (" # ..."), matching dotenv behaviour.
      const commentAt = rawValue.indexOf(' #');
      if (commentAt !== -1) rawValue = rawValue.slice(0, commentAt);
      values[trimmed.slice(0, eq).trim()] = rawValue.trim();
    }
  } catch {
    // .env is optional — fall back to defaults
  }
  return values;
}

// Always load agent/.env; when AGENT_ENV is set, layer agent/.env.<AGENT_ENV>
// (e.g. .env.test / .env.prod) on top so test/prod overrides never touch the
// shared .env. Real process.env vars still win in resolve() below.
const dotenv = loadDotEnv('.env');
const envSuffix = (process.env.AGENT_ENV || '').trim();
if (envSuffix) {
  Object.assign(dotenv, loadDotEnv(`.env.${envSuffix}`));
}

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
