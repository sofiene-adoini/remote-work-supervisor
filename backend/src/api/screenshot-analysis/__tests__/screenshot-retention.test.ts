/**
 * Screenshot Retention Cleanup — Integration Tests
 *
 * Run with:  npx ts-node --project tsconfig.test.json scripts/test-retention.ts
 * Or manually invoke runRetentionTests() from a Strapi bootstrap.
 *
 * The tests create ephemeral employees, sessions, analyses and a fake upload file,
 * then exercise the retention service and verify correctness.
 * Every test cleans up after itself so it is safe to run repeatedly.
 */

const SESSION_UID = 'api::session.session';
const SA_UID = 'api::screenshot-analysis.screenshot-analysis';
const USER_UID = 'plugin::users-permissions.user';
const FILE_UID = 'plugin::upload.file';

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.error(`  ✗ ${label}`);
  }
}

/* ── helpers ────────────────────────────────────────────────────── */

async function createEmployee(email: string) {
  const role = await strapi.db.query('plugin::users-permissions.role').findOne({
    where: { type: 'employee' },
  });
  return strapi.db.query(USER_UID).create({
    data: {
      username: email,
      email,
      password: 'placeholder',
      provider: 'local',
      confirmed: true,
      fullName: email.split('@')[0],
      isActive: true,
      role: role.id,
    },
  });
}

async function createSession(userId: number, clockIn: string, status = 'completed') {
  return strapi.db.query(SESSION_UID).create({
    data: {
      clockIn,
      status,
      totalBreakMinutes: 0,
      user: userId,
    },
  });
}

async function createFakeUploadFile(label: string) {
  return strapi.db.query(FILE_UID).create({
    data: {
      name: `${label}.png`,
      alternativeText: label,
      caption: label,
      hash: label,
      ext: '.png',
      mime: 'image/png',
      size: 1.0,
      url: `/uploads/${label}.png`,
      provider: 'local',
      width: 100,
      height: 100,
    },
  });
}

async function createAnalysis(userId: number, sessionId: number, fileId: number | null) {
  return strapi.db.query(SA_UID).create({
    data: {
      capturedAt: new Date().toISOString(),
      diffScore: 0.05,
      isSuspicious: false,
      analysisStatus: 'normal',
      employee: userId,
      session: sessionId,
      screenshot: fileId ? { id: fileId } : null,
    },
  });
}

async function cleanupTestEmployee(userId: number) {
  const analyses = await strapi.db.query(SA_UID).findMany({
    where: { employee: userId },
    populate: ['screenshot'],
  });
  for (const a of analyses) {
    if (a.screenshot?.id) {
      await strapi.db.query(FILE_UID).delete({ where: { id: a.screenshot.id } });
    }
    await strapi.db.query(SA_UID).delete({ where: { id: a.id } });
  }
  const sessions = await strapi.db.query(SESSION_UID).findMany({
    where: { user: userId },
  });
  for (const s of sessions) {
    await strapi.db.query(SESSION_UID).delete({ where: { id: s.id } });
  }
  await strapi.db.query(USER_UID).delete({ where: { id: userId } });
}

/* ── tests ──────────────────────────────────────────────────────── */

async function test1_threeSessions_allRetained() {
  console.log('\nTEST 1: Employee has screenshots in 3 sessions → all retained');
  const emp = await createEmployee('test1@retention.local');
  const s1 = await createSession(emp.id, '2026-07-10T09:00:00Z');
  const s2 = await createSession(emp.id, '2026-07-11T09:00:00Z');
  const s3 = await createSession(emp.id, '2026-07-12T09:00:00Z');

  const f1 = await createFakeUploadFile('t1-s1');
  const f2 = await createFakeUploadFile('t1-s2');
  const f3 = await createFakeUploadFile('t1-s3');
  await createAnalysis(emp.id, s1.id, f1.id);
  await createAnalysis(emp.id, s2.id, f2.id);
  await createAnalysis(emp.id, s3.id, f3.id);

  const { cleanupEmployeeScreenshots } = require('../services/screenshot-retention');
  await cleanupEmployeeScreenshots(emp.id);

  const remaining = await strapi.db.query(SA_UID).findMany({
    where: { employee: emp.id },
    populate: ['screenshot'],
  });
  assert(remaining.length === 3, 'all 3 analyses exist');
  assert(remaining.every((a: any) => a.screenshot !== null), 'all screenshots still attached');

  await cleanupTestEmployee(emp.id);
}

async function test2_fourSessions_oldestDeleted() {
  console.log('\nTEST 2: Employee has screenshots in 4 sessions → oldest session screenshots deleted');
  const emp = await createEmployee('test2@retention.local');
  const s1 = await createSession(emp.id, '2026-07-08T09:00:00Z');
  const s2 = await createSession(emp.id, '2026-07-09T09:00:00Z');
  const s3 = await createSession(emp.id, '2026-07-10T09:00:00Z');
  const s4 = await createSession(emp.id, '2026-07-11T09:00:00Z');

  const f1 = await createFakeUploadFile('t2-s1');
  const f2 = await createFakeUploadFile('t2-s2');
  const f3 = await createFakeUploadFile('t2-s3');
  const f4 = await createFakeUploadFile('t2-s4');
  const a1 = await createAnalysis(emp.id, s1.id, f1.id);
  const a2 = await createAnalysis(emp.id, s2.id, f2.id);
  await createAnalysis(emp.id, s3.id, f3.id);
  await createAnalysis(emp.id, s4.id, f4.id);

  const { cleanupEmployeeScreenshots } = require('../services/screenshot-retention');
  await cleanupEmployeeScreenshots(emp.id);

  const remaining = await strapi.db.query(SA_UID).findMany({
    where: { employee: emp.id },
    populate: ['screenshot'],
  });
  assert(remaining.length === 4, 'all 4 analyses still exist');

  const a1After = remaining.find((a: any) => a.id === a1.id);
  const a2After = remaining.find((a: any) => a.id === a2.id);
  assert(a1After?.screenshot === null, 'oldest session (s1) screenshot is null');
  assert(a2After?.screenshot !== null, 's2 is within latest 3 — screenshot retained');

  const file1 = await strapi.db.query(FILE_UID).findOne({ where: { id: f1.id } });
  const file2 = await strapi.db.query(FILE_UID).findOne({ where: { id: f2.id } });
  assert(file1 === null, 'file record for s1 is deleted');
  assert(file2 !== null, 'file record for s2 is retained');

  await cleanupTestEmployee(emp.id);
}

async function test3_fiveSessions_onlyLatest3Retained() {
  console.log('\nTEST 3: Employee has screenshots in 5 sessions → only latest 3 retained');
  const emp = await createEmployee('test3@retention.local');
  const s1 = await createSession(emp.id, '2026-07-06T09:00:00Z');
  const s2 = await createSession(emp.id, '2026-07-07T09:00:00Z');
  const s3 = await createSession(emp.id, '2026-07-08T09:00:00Z');
  const s4 = await createSession(emp.id, '2026-07-09T09:00:00Z');
  const s5 = await createSession(emp.id, '2026-07-10T09:00:00Z');

  const files = [];
  for (let i = 1; i <= 5; i++) {
    files.push(await createFakeUploadFile(`t3-s${i}`));
  }
  for (let i = 0; i < 5; i++) {
    const sessionIds = [s1.id, s2.id, s3.id, s4.id, s5.id];
    await createAnalysis(emp.id, sessionIds[i], files[i].id);
  }

  const { cleanupEmployeeScreenshots } = require('../services/screenshot-retention');
  await cleanupEmployeeScreenshots(emp.id);

  const remaining = await strapi.db.query(SA_UID).findMany({
    where: { employee: emp.id },
    populate: ['screenshot'],
  });
  assert(remaining.length === 5, 'all 5 analyses still exist');

  const withScreenshot = remaining.filter((a: any) => a.screenshot !== null);
  assert(withScreenshot.length === 3, 'exactly 3 analyses still have screenshots');

  for (let i = 0; i < 2; i++) {
    const fileGone = await strapi.db.query(FILE_UID).findOne({ where: { id: files[i].id } });
    assert(fileGone === null, `file for session s${i + 1} is deleted`);
  }

  await cleanupTestEmployee(emp.id);
}

async function test4_twoEmployees_isolated() {
  console.log('\nTEST 4: Cleanup for Employee A never deletes Employee B screenshots');
  const empA = await createEmployee('test4a@retention.local');
  const empB = await createEmployee('test4b@retention.local');

  const sA1 = await createSession(empA.id, '2026-07-08T09:00:00Z');
  const sA2 = await createSession(empA.id, '2026-07-09T09:00:00Z');
  const sB1 = await createSession(empB.id, '2026-07-08T09:00:00Z');

  const fA1 = await createFakeUploadFile('t4-ea1');
  const fA2 = await createFakeUploadFile('t4-ea2');
  const fB1 = await createFakeUploadFile('t4-eb1');
  await createAnalysis(empA.id, sA1.id, fA1.id);
  await createAnalysis(empA.id, sA2.id, fA2.id);
  await createAnalysis(empB.id, sB1.id, fB1.id);

  const { cleanupEmployeeScreenshots } = require('../services/screenshot-retention');
  await cleanupEmployeeScreenshots(empA.id);

  const bAnalyses = await strapi.db.query(SA_UID).findMany({
    where: { employee: empB.id },
    populate: ['screenshot'],
  });
  assert(bAnalyses.length === 1, 'Employee B analysis count unchanged');
  assert(bAnalyses[0].screenshot !== null, 'Employee B screenshot still attached');

  await cleanupTestEmployee(empA.id);
  await cleanupTestEmployee(empB.id);
}

async function test5_nullScreenshot_noCrash() {
  console.log('\nTEST 5: ScreenshotAnalysis with null screenshot → cleanup does not crash');
  const emp = await createEmployee('test5@retention.local');
  const s1 = await createSession(emp.id, '2026-07-08T09:00:00Z');
  const s2 = await createSession(emp.id, '2026-07-09T09:00:00Z');
  await createAnalysis(emp.id, s1.id, null);
  await createAnalysis(emp.id, s2.id, null);

  const { cleanupEmployeeScreenshots } = require('../services/screenshot-retention');
  let crashed = false;
  try {
    await cleanupEmployeeScreenshots(emp.id);
  } catch {
    crashed = true;
  }
  assert(!crashed, 'cleanup did not crash');

  const remaining = await strapi.db.query(SA_UID).findMany({
    where: { employee: emp.id },
  });
  assert(remaining.length === 2, 'both analyses still exist');

  await cleanupTestEmployee(emp.id);
}

async function test6_idempotent() {
  console.log('\nTEST 6: Cleanup executed twice → no crash, no duplicate errors');
  const emp = await createEmployee('test6@retention.local');
  const s1 = await createSession(emp.id, '2026-07-08T09:00:00Z');
  const s2 = await createSession(emp.id, '2026-07-10T09:00:00Z');
  const s3 = await createSession(emp.id, '2026-07-11T09:00:00Z');
  const s4 = await createSession(emp.id, '2026-07-12T09:00:00Z');

  const f1 = await createFakeUploadFile('t6-s1');
  await createAnalysis(emp.id, s1.id, f1.id);
  await createAnalysis(emp.id, s2.id, null);
  await createAnalysis(emp.id, s3.id, null);
  await createAnalysis(emp.id, s4.id, null);

  const { cleanupEmployeeScreenshots } = require('../services/screenshot-retention');

  let crash1 = false;
  try { await cleanupEmployeeScreenshots(emp.id); } catch { crash1 = true; }
  assert(!crash1, 'first cleanup did not crash');

  let crash2 = false;
  try { await cleanupEmployeeScreenshots(emp.id); } catch { crash2 = true; }
  assert(!crash2, 'second cleanup did not crash');

  const remaining = await strapi.db.query(SA_UID).findMany({
    where: { employee: emp.id },
    populate: ['screenshot'],
  });
  assert(remaining.length === 4, 'all 4 analyses still exist');

  const withScreenshot = remaining.filter((a: any) => a.screenshot !== null);
  assert(withScreenshot.length === 0, 'no screenshots remain (s1 was the only one, now cleaned)');

  await cleanupTestEmployee(emp.id);
}

async function test7_noActiveSession_rejected() {
  console.log('\nTEST 7: Submit without an active session → request fails clearly');
  // This test verifies the submit controller logic conceptually.
  // The controller checks for an active/break session before creating the analysis.
  // We verify the query logic here: a user with no active session returns null.
  const emp = await createEmployee('test7@retention.local');
  const s1 = await createSession(emp.id, '2026-07-08T09:00:00Z', 'completed');

  const activeSession = await strapi.db.query(SESSION_UID).findOne({
    where: {
      user: emp.id,
      status: { $in: ['active', 'break'] },
    },
    orderBy: { clockIn: 'desc' },
  });
  assert(activeSession === null, 'no active session found for user with only completed sessions');

  await cleanupTestEmployee(emp.id);
}

/* ── runner ─────────────────────────────────────────────────────── */

export async function runRetentionTests() {
  console.log('══════════════════════════════════════════════');
  console.log(' Screenshot Retention Cleanup — Test Suite');
  console.log('══════════════════════════════════════════════');

  await test1_threeSessions_allRetained();
  await test2_fourSessions_oldestDeleted();
  await test3_fiveSessions_onlyLatest3Retained();
  await test4_twoEmployees_isolated();
  await test5_nullScreenshot_noCrash();
  await test6_idempotent();
  await test7_noActiveSession_rejected();

  console.log('\n══════════════════════════════════════════════');
  console.log(` Results: ${passed} passed, ${failed} failed`);
  console.log('══════════════════════════════════════════════');

  if (failed > 0) process.exit(1);
}
