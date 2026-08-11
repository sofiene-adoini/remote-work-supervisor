const screenshot = require('screenshot-desktop');
const { PNG } = require('pngjs');
const { createScreenshotAnalysis } = require('../api/api');
const config = require('../config/config');

// Production capture interval from config (default 10 minutes).
// Overridable in agent/.env — AGENT_CAPTURE_INTERVAL_MS.
const CAPTURE_INTERVAL_MS = config.screenshots.captureIntervalMs;
const LOW_DIFF_THRESHOLD = 0.02;
const SUSPICIOUS_CONSECUTIVE_COUNT = 3;
const PIXELMATCH_THRESHOLD = 0.1;

let captureTimer = null;
let currentStatus = 'clocked_out';
let isCapturing = false;

let previousScreenshot = null; // { data: Uint8Array, width: number, height: number }
let consecutiveLowDiffCount = 0;
let suspiciousPeriodActive = false; // one continuous suspicious period = one alert

let _pixelmatch;
async function getPixelmatch() {
  if (!_pixelmatch) {
    _pixelmatch = (await import('pixelmatch')).default;
  }
  return _pixelmatch;
}

function setStatus(status, opts = {}) {
  const prev = currentStatus;
  currentStatus = status;

  if (status === 'break') {
    // A break is an explicit MONITORING BOUNDARY — never just another
    // screenshot-analysis state. Pause capture and reset the entire lifecycle
    // (baseline, counter, suspicious period) so the first post-break
    // screenshot becomes a fresh baseline. Manual and automatic breaks both
    // behave this way; the kind only matters for logging.
    stopCapturing();
    console.log(`[screenshot] monitoring paused — ${opts.automatic ? 'automatic' : 'manual'} break`);
    return;
  }

  if (status === 'active' && prev === 'break') {
    startCapturing();
    console.log('[screenshot] monitoring resumed — new baseline required');
    return;
  }

  if (status === 'clocked_out') {
    stopCapturing();
    console.log('[screenshot] monitoring stopped — clocked out');
  }
}

function resetState() {
  previousScreenshot = null;
  consecutiveLowDiffCount = 0;
  suspiciousPeriodActive = false;
}

function endSuspiciousPeriod() {
  if (suspiciousPeriodActive) {
    suspiciousPeriodActive = false;
    console.log('[screenshot] suspicious period ended');
  }
}

async function compareScreenshots(prevPng, currPng) {
  const pixelmatch = await getPixelmatch();
  const diff = new PNG({ width: currPng.width, height: currPng.height });
  const numDiffPixels = pixelmatch(prevPng.data, currPng.data, diff.data, currPng.width, currPng.height, { threshold: PIXELMATCH_THRESHOLD });
  const totalPixels = currPng.width * currPng.height;
  return totalPixels > 0 ? numDiffPixels / totalPixels : 0;
}

async function captureAndAnalyze() {
  // Monitoring lifecycle: capture runs only while the employee is clocked in
  // AND not on a break. Breaks (manual or automatic) pause monitoring and
  // reset state via setStatus(); clock-out stops it entirely. The timer is
  // already stopped on those transitions; this guard additionally aborts any
  // capture that was already in flight when the transition happened, so no
  // screenshot is ever captured or submitted during a break.
  if (currentStatus === 'clocked_out' || currentStatus === 'break') return;

  let imgBuffer;
  try {
    imgBuffer = await screenshot({ format: 'png' });
  } catch (err) {
    console.error('[screenshot] capture failed:', err.message);
    return;
  }

  let currentPng;
  try {
    currentPng = PNG.sync.read(imgBuffer);
  } catch (err) {
    console.error('[screenshot] PNG parse failed:', err.message);
    return;
  }

  // Release the raw buffer — we only need the parsed PNG for comparison
  imgBuffer = null;

  let diffScore = null;
  let isSuspicious = false;
  let analysisStatus = 'normal';

  if (previousScreenshot) {
    if (previousScreenshot.width === currentPng.width && previousScreenshot.height === currentPng.height) {
      try {
        diffScore = await compareScreenshots(previousScreenshot, currentPng);

        if (diffScore < LOW_DIFF_THRESHOLD) {
          consecutiveLowDiffCount++;
          // A NEW suspicious period begins only when the threshold is crossed
          // while no period is already active → exactly ONE alert per period.
          if (!suspiciousPeriodActive && consecutiveLowDiffCount >= SUSPICIOUS_CONSECUTIVE_COUNT) {
            suspiciousPeriodActive = true;
            isSuspicious = true;
            analysisStatus = 'suspicious';
            console.log('[screenshot] suspicious period started');
          }
        } else {
          // Screen changed significantly → the current period (if any) ends
          // and the low-diff streak resets. Only this can end a period.
          consecutiveLowDiffCount = 0;
          endSuspiciousPeriod();
        }
      } catch (err) {
        console.error('[screenshot] comparison failed:', err.message);
        consecutiveLowDiffCount = 0;
        endSuspiciousPeriod();
      }
    } else {
      consecutiveLowDiffCount = 0;
      endSuspiciousPeriod();
    }
  }

  // Replace previous screenshot reference — old reference is released by GC
  previousScreenshot = currentPng;

  // Submit metadata only — no screenshot data is sent to the server
  try {
    await createScreenshotAnalysis({
      capturedAt: new Date().toISOString(),
      diffScore,
      isSuspicious,
      analysisStatus,
    });
  } catch (err) {
    console.error('[screenshot] ScreenshotAnalysis creation failed:', err.message);
  }
}

// Test hooks (underscore-prefixed, never used in production)
function _getState() {
  return {
    previousScreenshotExists: previousScreenshot !== null,
    previousWidth: previousScreenshot ? previousScreenshot.width : null,
    previousHeight: previousScreenshot ? previousScreenshot.height : null,
    consecutiveLowDiffCount,
    suspiciousPeriodActive,
    isCapturing,
  };
}

function startCapturing() {
  if (isCapturing) return;
  isCapturing = true;
  resetState();
  captureTimer = setInterval(captureAndAnalyze, CAPTURE_INTERVAL_MS);
}

function stopCapturing() {
  isCapturing = false;
  if (captureTimer) clearInterval(captureTimer);
  captureTimer = null;
  resetState();
}

module.exports = {
  startCapturing,
  stopCapturing,
  setStatus,
  resetState,
  compareScreenshots,
  _captureAndAnalyze: captureAndAnalyze,
  _getState,
};
