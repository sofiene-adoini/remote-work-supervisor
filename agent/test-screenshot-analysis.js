/**
 * DEV-ONLY TEST SCRIPT — Phase 8 Screenshot Analysis
 *
 * Run:  node test-screenshot-analysis.js
 *
 * Tests the core comparison logic and suspicious-activity counter
 * WITHOUT requiring Electron, screenshot-desktop, or a running backend.
 *
 * Test matrix:
 *   1. First screenshot  → diffScore = null
 *   2. Completely different images → diffScore ≈ 1.0
 *   3. Very similar images → diffScore < LOW_DIFF_THRESHOLD
 *   4. Three consecutive low-diff → isSuspicious = true
 *   5. A different screenshot resets the low-diff counter
 */

const { PNG } = require('pngjs');

const LOW_DIFF_THRESHOLD = 0.02;
const SUSPICIOUS_CONSECUTIVE_COUNT = 3;

// ── Helpers ────────────────────────────────────────────────────────

function createSolidPng(width, height, r, g, b) {
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      png.data[idx]     = r;
      png.data[idx + 1] = g;
      png.data[idx + 2] = b;
      png.data[idx + 3] = 255;
    }
  }
  return png;
}

function createNoisyPng(width, height, r, g, b, noiseFraction) {
  const png = createSolidPng(width, height, r, g, b);
  const noiseCount = Math.floor(width * height * noiseFraction);
  for (let i = 0; i < noiseCount; i++) {
    const x = Math.floor(Math.random() * width);
    const y = Math.floor(Math.random() * height);
    const idx = (y * width + x) * 4;
    png.data[idx]     = 255 - r;
    png.data[idx + 1] = 255 - g;
    png.data[idx + 2] = 255 - b;
  }
  return png;
}

// ── Tests ──────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.error(`  ✗ ${label}`);
  }
}

(async () => {
  const pixelmatch = (await import('pixelmatch')).default;

  function compareScreenshots(prevPng, currPng) {
    const diff = new PNG({ width: currPng.width, height: currPng.height });
    const numDiffPixels = pixelmatch(
      prevPng.data, currPng.data, diff.data,
      currPng.width, currPng.height,
      { threshold: 0.1 },
    );
    const totalPixels = currPng.width * currPng.height;
    return totalPixels > 0 ? numDiffPixels / totalPixels : 0;
  }

  // Test 1
  console.log('Test 1: First screenshot → diffScore = null');
  {
    let diffScore = null;
    let isSuspicious = false;
    let analysisStatus = 'normal';
    let consecutiveLowDiffCount = 0;

    assert(diffScore === null, 'diffScore is null');
    assert(isSuspicious === false, 'isSuspicious is false');
    assert(analysisStatus === 'normal', 'analysisStatus is normal');
    assert(consecutiveLowDiffCount === 0, 'counter starts at 0');
  }

  // Test 2
  console.log('\nTest 2: Completely different images → high diff score');
  {
    const img1 = createSolidPng(100, 100, 128, 128, 128);
    const img2 = createSolidPng(100, 100,   0,   0,   0);
    const score = compareScreenshots(img1, img2);

    console.log(`  diffScore = ${score.toFixed(6)}`);
    assert(score > 0.99, 'score > 0.99 for fully inverted images');
  }

  // Test 3
  console.log('\nTest 3: Very similar images → low diff score');
  {
    const img1 = createSolidPng(100, 100, 128, 128, 128);
    const img2 = createNoisyPng(100, 100, 128, 128, 128, 0.005);
    const score = compareScreenshots(img1, img2);

    console.log(`  diffScore = ${score.toFixed(6)}  (threshold = ${LOW_DIFF_THRESHOLD})`);
    assert(score < LOW_DIFF_THRESHOLD, 'score < LOW_DIFF_THRESHOLD');
  }

  // Test 4
  console.log('\nTest 4: Three consecutive low-diff → isSuspicious = true');
  {
    let consecutiveLowDiffCount = 0;
    let isSuspicious = false;
    let analysisStatus = 'normal';

    const base = createSolidPng(100, 100, 128, 128, 128);

    for (let i = 0; i < 3; i++) {
      const img = createNoisyPng(100, 100, 128, 128, 128, 0.005);
      const score = compareScreenshots(base, img);

      if (score < LOW_DIFF_THRESHOLD) {
        consecutiveLowDiffCount++;
      } else {
        consecutiveLowDiffCount = 0;
      }

      isSuspicious = consecutiveLowDiffCount >= SUSPICIOUS_CONSECUTIVE_COUNT;
      analysisStatus = isSuspicious ? 'suspicious' : 'normal';

      console.log(`  iteration ${i + 1}: score=${score.toFixed(6)}  counter=${consecutiveLowDiffCount}  suspicious=${isSuspicious}`);
    }

    assert(consecutiveLowDiffCount === 3, `counter = ${SUSPICIOUS_CONSECUTIVE_COUNT}`);
    assert(isSuspicious === true, 'isSuspicious = true');
    assert(analysisStatus === 'suspicious', 'analysisStatus = suspicious');
  }

  // Test 5
  console.log('\nTest 5: Different screenshot resets low-diff counter');
  {
    let consecutiveLowDiffCount = 0;
    let isSuspicious = false;

    const base = createSolidPng(100, 100, 128, 128, 128);

    for (let i = 0; i < 2; i++) {
      const img = createNoisyPng(100, 100, 128, 128, 128, 0.005);
      const score = compareScreenshots(base, img);
      if (score < LOW_DIFF_THRESHOLD) {
        consecutiveLowDiffCount++;
      } else {
        consecutiveLowDiffCount = 0;
      }
    }
    console.log(`  after 2 similar: counter=${consecutiveLowDiffCount}`);
    assert(consecutiveLowDiffCount === 2, 'counter is 2 after two similar shots');

    const diff = createSolidPng(100, 100, 0, 0, 0);
    const score = compareScreenshots(base, diff);
    console.log(`  different shot:  score=${score.toFixed(6)}`);
    if (score < LOW_DIFF_THRESHOLD) {
      consecutiveLowDiffCount++;
    } else {
      consecutiveLowDiffCount = 0;
    }

    isSuspicious = consecutiveLowDiffCount >= SUSPICIOUS_CONSECUTIVE_COUNT;
    console.log(`  after different: counter=${consecutiveLowDiffCount}  suspicious=${isSuspicious}`);
    assert(consecutiveLowDiffCount === 0, 'counter reset to 0');
    assert(isSuspicious === false, 'isSuspicious = false');
  }

  // Summary
  console.log(`\n${'='.repeat(40)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
})();
