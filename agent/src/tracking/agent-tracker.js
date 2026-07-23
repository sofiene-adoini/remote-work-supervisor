const { uIOhook, UiohookKey } = require('uiohook-napi');

// ── Thresholds ──────────────────────────────────────────────────────
// Production thresholds.  Idle detection is informational only; the
// auto-break threshold is the authoritative 15-minute cutoff.
// const IDLE_THRESHOLD_MS = 5 * 60 * 1000; // 5 min — considered "idle"
const IDLE_THRESHOLD_MS = 1* 60 * 1000; // 5 min — considered "idle" test with 1 min time 
// const AUTO_BREAK_THRESHOLD_MS = 15 * 60 * 1000; // 15 min — auto-break starts
const AUTO_BREAK_THRESHOLD_MS = 2 * 60 * 1000; // 2 min — auto-break starts
const CHECK_INTERVAL_MS = 30 * 1000; // poll every 30 s

// ── Internal state ──────────────────────────────────────────────────
let lastActivityAt = Date.now();
let currentStatus = 'clocked_out'; // session status: clocked_out | active | break
let activityState = 'idle';        // tracker-local: active | idle
let autoBreakActive = false;
let isTracking = false;
let checkTimer = null;

// ── Callbacks ───────────────────────────────────────────────────────
let _onAutoBreakStart = null;
let _onAutoBreakEnd = null;
let _onActivityStateChange = null;

// ── Test overrides (isolated from production) ───────────────────────
let _idleThreshold = IDLE_THRESHOLD_MS;
let _autoBreakThreshold = AUTO_BREAK_THRESHOLD_MS;
let _checkInterval = CHECK_INTERVAL_MS;

// ── Helpers ─────────────────────────────────────────────────────────

function log(msg) {
  console.log(`[tracker] ${msg}`);
}

function markActivity() {
  lastActivityAt = Date.now();
}

/**
 * Compute the derived activity state from the raw idle duration and
 * current session status.  This is a pure function — side-effects
 * (callbacks, logging) happen in the caller.
 */
function deriveActivityState(idleMs) {
  if (currentStatus !== 'active') return 'idle';
  return idleMs < _idleThreshold ? 'active' : 'idle';
}

function emitActivityStateChange(newState, idleMs) {
  if (newState === activityState) return; // no change — suppress spam
  const prev = activityState;
  activityState = newState;
  log(`activity state changed: ${prev} → ${newState}`);
  if (_onActivityStateChange) {
    _onActivityStateChange({ state: newState, idleMs, lastActivityAt });
  }
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * Called by main.js whenever the session status changes (clock-in,
 * clock-out, manual break start/end) so the idle detector always
 * knows the real current state.
 */
function setStatus(status) {
  currentStatus = status;

  if (status !== 'break') {
    // Clear auto-break flag when leaving break state.
    autoBreakActive = false;
  }

  if (status === 'active') {
    markActivity();
    activityState = 'active';
  } else if (status === 'clocked_out') {
    activityState = 'idle';
  }
}

/**
 * Start the global input listener and the periodic idle checker.
 *
 * @param {Object}  callbacks
 * @param {Function} callbacks.onAutoBreakStart      – called when 15-min idle threshold is hit
 * @param {Function} callbacks.onAutoBreakEnd        – called when activity resumes during auto-break
 * @param {Function} [callbacks.onActivityStateChange] – called on active↔idle transitions
 */
function startTracking({ onAutoBreakStart, onAutoBreakEnd, onActivityStateChange } = {}) {
  if (isTracking) return;
  isTracking = true;

  _onAutoBreakStart = onAutoBreakStart || null;
  _onAutoBreakEnd = onAutoBreakEnd || null;
  _onActivityStateChange = onActivityStateChange || null;

  // Reset timestamps so we don't immediately trigger idle after start.
  lastActivityAt = Date.now();
  activityState = 'active';

  uIOhook.on('mousemove', markActivity);
  uIOhook.start();

  log('tracking started');

  checkTimer = setInterval(() => {
    const idleMs = Date.now() - lastActivityAt;

    // ── Auto-break logic (existing behaviour, preserved) ───────────
    if (currentStatus === 'active' && idleMs >= _autoBreakThreshold) {
      autoBreakActive = true;
      currentStatus = 'break';
      log('automatic break threshold reached — starting auto-break');
      if (_onAutoBreakStart) _onAutoBreakStart();
      return;
    }

    if (currentStatus === 'break' && autoBreakActive && idleMs < _autoBreakThreshold) {
      autoBreakActive = false;
      currentStatus = 'active';
      lastActivityAt = Date.now(); // reset so we don't re-idle immediately
      log('activity resumed — ending auto-break');
      if (_onAutoBreakEnd) _onAutoBreakEnd();
      return;
    }

    // ── Activity state transitions (new) ───────────────────────────
    const newState = deriveActivityState(idleMs);
    emitActivityStateChange(newState, idleMs);
  }, _checkInterval);
}

function stopTracking() {
  if (!isTracking) return;
  isTracking = false;

  uIOhook.stop();

  if (checkTimer) clearInterval(checkTimer);
  checkTimer = null;

  autoBreakActive = false;
  activityState = 'idle';
  _onAutoBreakStart = null;
  _onAutoBreakEnd = null;
  _onActivityStateChange = null;

  log('tracking stopped');
}

function getStatus() {
  return {
    currentStatus,
    activityState,
    autoBreakActive,
    idleMs: Date.now() - lastActivityAt,
    lastActivityAt,
  };
}

// ── Test helpers (only usable externally, never in production) ──────

function _setTestOverrides(overrides = {}) {
  if ('idleThreshold' in overrides) _idleThreshold = overrides.idleThreshold;
  if ('autoBreakThreshold' in overrides) _autoBreakThreshold = overrides.autoBreakThreshold;
  if ('checkInterval' in overrides) _checkInterval = overrides.checkInterval;
}

function _resetTestOverrides() {
  _idleThreshold = IDLE_THRESHOLD_MS;
  _autoBreakThreshold = AUTO_BREAK_THRESHOLD_MS;
  _checkInterval = CHECK_INTERVAL_MS;
}

module.exports = {
  startTracking,
  stopTracking,
  setStatus,
  getStatus,
  // exposed only for testing — prefixed with underscore
  _setTestOverrides,
  _resetTestOverrides,
  // constants for test assertions
  IDLE_THRESHOLD_MS,
  AUTO_BREAK_THRESHOLD_MS,
  CHECK_INTERVAL_MS,
};
