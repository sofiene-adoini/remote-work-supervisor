const { uIOhook, UiohookKey } = require('uiohook-napi');

const IDLE_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes, per spec
const CHECK_INTERVAL_MS = 30 * 1000; // check twice a minute — cheap, and keeps the break start time reasonably accurate

let lastActivityAt = Date.now();
let currentStatus = 'clocked_out';
let autoBreakActive = false;
let checkTimer = null;
let isTracking = false;

function markActivity() {
  lastActivityAt = Date.now();
}

/**
 * Called by main.js whenever the session status changes (clock-in, clock-out,
 * manual break start/end) so the idle detector always knows the real current state.
 */
function setStatus(status) {
  currentStatus = status;
  if (status !== 'break') {
    // If we're no longer on break (clocked out, or someone manually ended it),
    // clear our own flag so we don't get confused about who owns the current break.
    autoBreakActive = false;
  }
  if (status === 'active') {
    markActivity(); // don't immediately flag idle right after clocking in or ending a break
  }
}

function startTracking({ onAutoBreakStart, onAutoBreakEnd }) {
  if (isTracking) return;
  isTracking = true;

  uIOhook.on('mousemove', markActivity);
//   uIOhook.on('mousedown', markActivity);
//   uIOhook.on('wheel', markActivity);
//   uIOhook.on('keydown', markActivity);
  uIOhook.start();

  checkTimer = setInterval(() => {
    const idleMs = Date.now() - lastActivityAt;

    if (currentStatus === 'active' && idleMs >= IDLE_THRESHOLD_MS) {
      // Gone idle while clocked in and active — auto-start a break.
      autoBreakActive = true;
      currentStatus = 'break'; // optimistic local update; main.js will reconcile with the real API response
      onAutoBreakStart();
    } else if (currentStatus === 'break' && autoBreakActive && idleMs < IDLE_THRESHOLD_MS) {
      // Activity resumed and WE were the one who auto-started this break — end it.
      autoBreakActive = false;
      currentStatus = 'active';
      onAutoBreakEnd();
    }
    // If on a manual break (autoBreakActive === false), activity resuming does NOT
    // auto-end it — the employee ends a manual break themselves from the popup.
  }, CHECK_INTERVAL_MS);
}

function stopTracking() {
  isTracking = false;
  uIOhook.stop();
  if (checkTimer) clearInterval(checkTimer);
  checkTimer = null;
  autoBreakActive = false;
}

function getStatus() {
  return { currentStatus, autoBreakActive, idleMs: Date.now() - lastActivityAt };
}

module.exports = { startTracking, stopTracking, setStatus, getStatus };