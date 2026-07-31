const screenshot = require('screenshot-desktop');
const { PNG } = require('pngjs');
const { createScreenshotAnalysis } = require('../api/api');
const config = require('../config/config');

// Production capture interval from config (default 10 minutes).
// Overridable in agent/.env — AGENT_CAPTURE_INTERVAL_MS.
const CAPTURE_INTERVAL_MS = config.screenshots.captureIntervalMs;
const LOW_DIFF_THRESHOLD = 0.02;
const SUSPICIOUS_CONSECUTIVE_COUNT = 3;

let captureTimer = null;
let currentStatus = 'clocked_out';
let isCapturing = false;

let previousScreenshot = null; // { data: Uint8Array, width: number, height: number }
let consecutiveLowDiffCount = 0;

let _pixelmatch;
async function getPixelmatch() {
  if (!_pixelmatch) {
    _pixelmatch = (await import('pixelmatch')).default;
  }
  return _pixelmatch;
}

function setStatus(status) {
  currentStatus = status;
}

function resetState() {
  previousScreenshot = null;
  consecutiveLowDiffCount = 0;
}

async function compareScreenshots(prevPng, currPng) {
  const pixelmatch = await getPixelmatch();
  const diff = new PNG({ width: currPng.width, height: currPng.height });
  const numDiffPixels = pixelmatch(prevPng.data, currPng.data, diff.data, currPng.width, currPng.height, { threshold: 0.1 });
  const totalPixels = currPng.width * currPng.height;
  return totalPixels > 0 ? numDiffPixels / totalPixels : 0;
}

async function captureAndAnalyze() {
  if (currentStatus !== 'active') return;

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
        } else {
          consecutiveLowDiffCount = 0;
        }

        isSuspicious = consecutiveLowDiffCount >= SUSPICIOUS_CONSECUTIVE_COUNT;
        analysisStatus = isSuspicious ? 'suspicious' : 'normal';
      } catch (err) {
        console.error('[screenshot] comparison failed:', err.message);
        consecutiveLowDiffCount = 0;
      }
    } else {
      consecutiveLowDiffCount = 0;
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

module.exports = { startCapturing, stopCapturing, setStatus, resetState, compareScreenshots };
