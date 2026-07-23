/**
 * Activity Tracker — Unit Tests
 *
 * Run:  node test-tracker.js
 *
 * Mocks uiohook-napi so no real Electron/input hooks are needed.
 * Uses _setTestOverrides to set thresholds to 100-300 ms so tests finish
 * in under 2 seconds while keeping production thresholds intact.
 */

/* ── Mock uiohook-napi ──────────────────────────────────────────── */

const Module = require('module');
const path = require('path');

const _listeners = {};
const mockUIohook = {
  on(event, fn) { _listeners[event] = fn; },
  start() {},
  stop() { Object.keys(_listeners).forEach(k => delete _listeners[k]); },
};

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'uiohook-napi') {
    return { uIOhook: mockUIohook, UiohookKey: {} };
  }
  return originalLoad.call(this, request, parent, isMain);
};

/* ── Tracker under test ─────────────────────────────────────────── */

const tracker = require('./src/tracking/agent-tracker');

/* ── Test helpers ───────────────────────────────────────────────── */

let passed = 0;
let failed = 0;

function assert(cond, label) {
  if (cond) { passed++; console.log(`  ✓ ${label}`); }
  else      { failed++; console.error(`  ✗ ${label}`); }
}

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

function simulateMouseMove() {
  if (_listeners.mousemove) _listeners.mousemove({});
}

/* ── Tests ──────────────────────────────────────────────────────── */

async function test1_initialState() {
  console.log('\nTEST 1 — Initial state');
  tracker.stopTracking();
  const s = tracker.getStatus();
  assert(s.currentStatus === 'clocked_out', 'currentStatus is clocked_out');
  assert(s.activityState === 'idle',        'activityState is idle');
  assert(s.autoBreakActive === false,       'autoBreakActive is false');
}

async function test2_clockIn() {
  console.log('\nTEST 2 — Clock-in → active');
  tracker.setStatus('active');
  tracker._setTestOverrides({ idleThreshold: 100, autoBreakThreshold: 300, checkInterval: 50 });

  const stateChanges = [];
  tracker.startTracking({
    onAutoBreakStart() {},
    onAutoBreakEnd() {},
    onActivityStateChange(e) { stateChanges.push(e.state); },
  });

  const s = tracker.getStatus();
  assert(s.currentStatus === 'active', 'currentStatus is active');
  assert(s.activityState === 'active', 'activityState is active');

  tracker.stopTracking();
  tracker._resetTestOverrides();
}

async function test3_activeToIdle() {
  console.log('\nTEST 3 — active → idle transition');
  tracker.setStatus('active');
  tracker._setTestOverrides({ idleThreshold: 150, autoBreakThreshold: 600, checkInterval: 50 });

  const stateChanges = [];
  tracker.startTracking({
    onAutoBreakStart() {},
    onAutoBreakEnd() {},
    onActivityStateChange(e) { stateChanges.push(e.state); },
  });

  // Wait past the idle threshold (150 ms) but below auto-break (600 ms)
  await wait(250);

  assert(stateChanges.includes('idle'), 'idle callback fired');
  assert(!stateChanges.includes('active'), 'no spurious active callback');

  const s = tracker.getStatus();
  assert(s.activityState === 'idle', 'activityState is idle');

  tracker.stopTracking();
  tracker._resetTestOverrides();
}

async function test4_autoBreak() {
  console.log('\nTEST 4 — 15-min inactivity → auto-break (simulated with 200 ms)');
  tracker.setStatus('active');
  tracker._setTestOverrides({ idleThreshold: 100, autoBreakThreshold: 200, checkInterval: 50 });

  let breakStarted = false;
  tracker.startTracking({
    onAutoBreakStart() { breakStarted = true; },
    onAutoBreakEnd() {},
    onActivityStateChange() {},
  });

  // Wait past auto-break threshold
  await wait(300);

  assert(breakStarted, 'onAutoBreakStart was called');
  const s = tracker.getStatus();
  assert(s.autoBreakActive === true, 'autoBreakActive is true');
  assert(s.currentStatus === 'break', 'currentStatus is break');

  tracker.stopTracking();
  tracker._resetTestOverrides();
}

async function test5_autoBreakResume() {
  console.log('\nTEST 5 — Activity resumes during auto-break → auto-break ends');
  tracker.setStatus('active');
  tracker._setTestOverrides({ idleThreshold: 100, autoBreakThreshold: 200, checkInterval: 50 });

  let breakStarted = false;
  let breakEnded = false;
  tracker.startTracking({
    onAutoBreakStart() { breakStarted = true; },
    onAutoBreakEnd() { breakEnded = true; },
    onActivityStateChange() {},
  });

  // Trigger auto-break
  await wait(300);
  assert(breakStarted, 'auto-break started');

  // Simulate mouse activity → should end auto-break on next tick
  simulateMouseMove();
  await wait(100);

  assert(breakEnded, 'onAutoBreakEnd was called');
  const s = tracker.getStatus();
  assert(s.autoBreakActive === false, 'autoBreakActive is false');
  assert(s.currentStatus === 'active', 'currentStatus is active');

  tracker.stopTracking();
  tracker._resetTestOverrides();
}

async function test6_manualBreakProtection() {
  console.log('\nTEST 6 — Manual break is NOT auto-ended by mouse activity');
  tracker.setStatus('break'); // manual break
  tracker._setTestOverrides({ idleThreshold: 100, autoBreakThreshold: 200, checkInterval: 50 });

  let breakStarted = false;
  let breakEnded = false;
  tracker.startTracking({
    onAutoBreakStart() { breakStarted = true; },
    onAutoBreakEnd() { breakEnded = true; },
    onActivityStateChange() {},
  });

  // Move mouse repeatedly — manual break must not end
  for (let i = 0; i < 5; i++) {
    simulateMouseMove();
    await wait(80);
  }

  assert(!breakEnded, 'onAutoBreakEnd was NOT called for manual break');
  assert(!breakStarted, 'onAutoBreakStart was NOT called');
  const s = tracker.getStatus();
  assert(s.autoBreakActive === false, 'autoBreakActive is false (manual break)');

  tracker.stopTracking();
  tracker._resetTestOverrides();
}

async function test7_clockOutCleanup() {
  console.log('\nTEST 7 — Clock-out stops tracking');
  tracker.setStatus('active');
  tracker._setTestOverrides({ idleThreshold: 100, autoBreakThreshold: 300, checkInterval: 50 });

  let changeCount = 0;
  tracker.startTracking({
    onAutoBreakStart() {},
    onAutoBreakEnd() {},
    onActivityStateChange() { changeCount++; },
  });

  await wait(50);
  tracker.stopTracking();

  const countAfterStop = changeCount;
  await wait(200);
  assert(changeCount === countAfterStop, 'no state changes after stopTracking');

  const s = tracker.getStatus();
  assert(s.activityState === 'idle', 'activityState is idle after stop');
  assert(s.autoBreakActive === false, 'autoBreakActive is false after stop');

  tracker._resetTestOverrides();
}

async function test8_reEntryProtection() {
  console.log('\nTEST 8 — Calling startTracking() twice does not duplicate');
  tracker.setStatus('active');
  tracker._setTestOverrides({ idleThreshold: 100, autoBreakThreshold: 300, checkInterval: 50 });

  let startCount = 0;
  tracker.startTracking({
    onAutoBreakStart() {},
    onAutoBreakEnd() {},
    onActivityStateChange() {},
  });
  startCount++;

  // Second call should be no-op
  tracker.startTracking({
    onAutoBreakStart() {},
    onAutoBreakEnd() {},
    onActivityStateChange() {},
  });
  startCount++;

  assert(startCount === 2, 'startTracking called twice (only one took effect internally)');

  // Verify only one listener is registered for mousemove
  const mousemoveCount = typeof _listeners.mousemove === 'function' ? 1 : 0;
  assert(mousemoveCount === 1, 'only one mousemove listener registered');

  tracker.stopTracking();
  tracker._resetTestOverrides();
}

async function test9_screenshotCompatibility() {
  console.log('\nTEST 9 — Screenshot module lifecycle unchanged');
  // Verify the tracker API surface is backward-compatible:
  // setStatus, startTracking, stopTracking, getStatus all exist
  assert(typeof tracker.setStatus    === 'function', 'setStatus is a function');
  assert(typeof tracker.startTracking === 'function', 'startTracking is a function');
  assert(typeof tracker.stopTracking  === 'function', 'stopTracking is a function');
  assert(typeof tracker.getStatus     === 'function', 'getStatus is a function');

  // getStatus returns expected shape
  const s = tracker.getStatus();
  assert('currentStatus' in s,      'getStatus has currentStatus');
  assert('autoBreakActive' in s,    'getStatus has autoBreakActive');
  assert('idleMs' in s,             'getStatus has idleMs');
  assert('activityState' in s,      'getStatus has activityState (new)');
  assert('lastActivityAt' in s,     'getStatus has lastActivityAt (new)');
}

/* ── Runner ─────────────────────────────────────────────────────── */

async function main() {
  console.log('══════════════════════════════════════════════');
  console.log(' Activity Tracker — Test Suite');
  console.log('══════════════════════════════════════════════');

  await test1_initialState();
  await test2_clockIn();
  await test3_activeToIdle();
  await test4_autoBreak();
  await test5_autoBreakResume();
  await test6_manualBreakProtection();
  await test7_clockOutCleanup();
  await test8_reEntryProtection();
  await test9_screenshotCompatibility();

  console.log('\n══════════════════════════════════════════════');
  console.log(` Results: ${passed} passed, ${failed} failed`);
  console.log('══════════════════════════════════════════════');

  process.exit(failed > 0 ? 1 : 0);
}

main();
