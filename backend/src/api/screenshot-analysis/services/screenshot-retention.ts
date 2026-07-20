import path from 'path';
import fs from 'fs/promises';

const SESSION_UID = 'api::session.session';
const SA_UID = 'api::screenshot-analysis.screenshot-analysis';
const FILE_UID = 'plugin::upload.file';

const RETENTION_SESSION_COUNT = 3;

async function getLatestSessionIds(employeeId: number, limit: number): Promise<number[]> {
  const sessions = await strapi.db.query(SESSION_UID).findMany({
    where: { user: employeeId },
    orderBy: { clockIn: 'desc' },
    limit,
  });
  return sessions.map((s: any) => s.id);
}

async function deleteMediaFileRecord(fileId: number): Promise<void> {
  const file = await strapi.db.query(FILE_UID).findOne({
    where: { id: fileId },
  });
  if (!file) return;

  await strapi.db.query(FILE_UID).delete({
    where: { id: fileId },
  });

  try {
    const staticPublic = (strapi as any).dirs?.static?.public || path.join(process.cwd(), 'public');
    const relativeUrl = file.url?.startsWith('/') ? file.url.slice(1) : file.url;
    if (relativeUrl) {
      const physicalPath = path.join(staticPublic, relativeUrl);
      await fs.unlink(physicalPath);
    }
  } catch {
    // Physical file may already be removed or inaccessible — not fatal
  }
}

export async function cleanupEmployeeScreenshots(employeeId: number): Promise<void> {
  const latestSessionIds = await getLatestSessionIds(employeeId, RETENTION_SESSION_COUNT);
  if (latestSessionIds.length === 0) return;

  const allAnalyses = await strapi.db.query(SA_UID).findMany({
    where: {
      employee: employeeId,
    },
    populate: ['session', 'screenshot'],
  });

  const latestSet = new Set(latestSessionIds);
  const toClean = allAnalyses.filter(
    (a: any) => a.session && !latestSet.has(a.session.id) && a.screenshot,
  );

  for (const analysis of toClean) {
    try {
      const fileId = analysis.screenshot.id;

      await strapi.db.query(SA_UID).update({
        where: { id: analysis.id },
        data: { screenshot: null },
      });

      await deleteMediaFileRecord(fileId);
    } catch (err: any) {
      strapi.log.error(
        `[screenshot-retention] Failed to clean analysis ${analysis.id}: ${err.message}`,
      );
    }
  }
}
