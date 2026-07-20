const screenshot = require('screenshot-desktop');
const { PNG } = require('pngjs');
const { uploadScreenshot, createScreenshotAnalysis } = require('../api/api');

// const CAPTURE_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const CAPTURE_INTERVAL_MS = 30 * 1000; //for testing :30 sec
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

async function captureAndUpload() {
     console.log('[screenshot] capture cycle triggered');
  if (currentStatus !== 'active') {
    console.log('[screenshot] skipped - status:', currentStatus);
    return;
}

  let imgBuffer;
  try {
     console.log('[screenshot] taking screenshot...');
    imgBuffer = await screenshot({ format: 'png' });

    console.log('[screenshot] screenshot captured, bytes:', imgBuffer.length);
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
      console.warn('[screenshot] dimension mismatch between consecutive screenshots, resetting counter');
      consecutiveLowDiffCount = 0;
    }
  }

  previousScreenshot = currentPng;

  let screenshotId;
  try {
    const uploadResult = await uploadScreenshot(imgBuffer);
    screenshotId = uploadResult[0]?.id;
  } catch (err) {
    console.error('[screenshot] upload failed:', err.message);
    return;
  }

  if (!screenshotId) {
    console.error('[screenshot] upload returned no media ID');
    return;
  }

  try {
    await createScreenshotAnalysis({
      capturedAt: new Date().toISOString(),
      diffScore,
      isSuspicious,
      analysisStatus,
      screenshotId,
    });
  } catch (err) {
    console.error('[screenshot] ScreenshotAnalysis creation failed:', err.message);
  }
}

function startCapturing() {
     console.log('[screenshot] startCapturing called');
  if (isCapturing) return;
  isCapturing = true;
  resetState();
  captureTimer = setInterval(captureAndUpload, CAPTURE_INTERVAL_MS);
}

function stopCapturing() {
  isCapturing = false;
  if (captureTimer) clearInterval(captureTimer);
  captureTimer = null;
  resetState();
}

module.exports = { startCapturing, stopCapturing, setStatus, resetState, compareScreenshots };
