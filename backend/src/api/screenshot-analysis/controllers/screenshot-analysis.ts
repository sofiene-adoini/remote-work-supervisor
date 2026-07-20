import type { Context } from 'koa';
import { cleanupEmployeeScreenshots } from '../services/screenshot-retention';

const SA_UID = 'api::screenshot-analysis.screenshot-analysis';
const SESSION_UID = 'api::session.session';

export default {
  async find(ctx: Context) {
    const userId = ctx.state.user?.id;
    const roleType = ctx.state.user?.role?.type;

    if (!userId) return ctx.unauthorized('Authentication required');
    if (roleType === 'employee') return ctx.forbidden('Employees cannot browse screenshot analyses');

    const { page = '1', pageSize = '25', employeeId, analysisStatus } = ctx.query as {
      page?: string;
      pageSize?: string;
      employeeId?: string;
      analysisStatus?: string;
    };

    const where: Record<string, any> = {};
    if (employeeId) where.employee = employeeId;
    if (analysisStatus) where.analysisStatus = analysisStatus;

    const start = (parseInt(page, 10) - 1) * parseInt(pageSize, 10);
    const limit = parseInt(pageSize, 10);

    const [records, count] = await Promise.all([
      strapi.db.query(SA_UID).findMany({
        where,
        orderBy: { capturedAt: 'desc' },
        offset: start,
        limit,
        populate: ['employee', 'screenshot', 'session'],
      } as any),
      strapi.db.query(SA_UID).count({ where }),
    ]);

    return ctx.send({ records, count });
  },

  async findOne(ctx: Context) {
    const userId = ctx.state.user?.id;
    const roleType = ctx.state.user?.role?.type;

    if (!userId) return ctx.unauthorized('Authentication required');
    if (roleType === 'employee') return ctx.forbidden('Employees cannot access screenshot analyses');

    const record = await strapi.db.query(SA_UID).findOne({
      where: { id: parseInt(ctx.params.id, 10) },
      populate: ['employee', 'screenshot', 'session'],
    });

    if (!record) return ctx.notFound('Screenshot analysis not found');
    return ctx.send({ record });
  },

  async updateStatus(ctx: Context) {
    const userId = ctx.state.user?.id;
    const roleType = ctx.state.user?.role?.type;

    if (!userId) return ctx.unauthorized('Authentication required');
    if (roleType === 'employee') return ctx.forbidden('Employees cannot update screenshot analyses');

    const { id } = ctx.params;
    const { analysisStatus } = ctx.request.body as { analysisStatus?: string };

    if (!analysisStatus || !['normal', 'suspicious', 'reviewed'].includes(analysisStatus)) {
      return ctx.badRequest('analysisStatus must be one of: normal, suspicious, reviewed');
    }

    const record = await strapi.db.query(SA_UID).findOne({
      where: { id: parseInt(id, 10) },
    });

    if (!record) return ctx.notFound('Screenshot analysis not found');

    const updated = await strapi.db.query(SA_UID).update({
      where: { id: record.id },
      data: { analysisStatus, isSuspicious: analysisStatus === 'suspicious' },
    });

    return ctx.send({ record: updated });
  },

  async myAnalyses(ctx: Context) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized('Authentication required');

    const records = await strapi.db.query(SA_UID).findMany({
      where: { employee: userId },
      orderBy: { capturedAt: 'desc' },
      limit: 25,
      populate: ['screenshot', 'session'],
    });

    return ctx.send({ records });
  },

  async create(ctx: Context) {
    const userId = ctx.state.user?.id;
    const roleType = ctx.state.user?.role?.type;

    if (!userId) return ctx.unauthorized('Authentication required');
    if (roleType === 'employee') return ctx.forbidden('Employees cannot create screenshot analyses directly');

    const { capturedAt, diffScore, isSuspicious, analysisStatus, employeeId, screenshotId } =
      ctx.request.body as {
        capturedAt?: string;
        diffScore?: number;
        isSuspicious?: boolean;
        analysisStatus?: string;
        employeeId?: number;
        screenshotId?: number;
      };

    if (!capturedAt) return ctx.badRequest('capturedAt is required');
    if (!employeeId) return ctx.badRequest('employeeId is required');

    const record = await strapi.entityService.create(SA_UID, {
      data: {
        capturedAt,
        diffScore: diffScore ?? null,
        isSuspicious: isSuspicious ?? false,
        analysisStatus: analysisStatus || 'normal',
        employee: employeeId,
        screenshot: screenshotId ? { id: screenshotId } : null,
      },
    } as any);

    return ctx.send({ record }, 201);
  },

  async submit(ctx: Context) {
    const userId = ctx.state.user?.id;
    const roleType = ctx.state.user?.role?.type;

    if (!userId) return ctx.unauthorized('Authentication required');

    const allowedRoles = ['employee', 'hr', 'admin'];
    if (!roleType || !allowedRoles.includes(roleType)) {
      return ctx.forbidden('Invalid role for screenshot submission');
    }

    const { capturedAt, diffScore, isSuspicious, analysisStatus, screenshotId } =
      ctx.request.body as {
        capturedAt?: string;
        diffScore?: number;
        isSuspicious?: boolean;
        analysisStatus?: string;
        screenshotId?: number;
      };

    if (!capturedAt) return ctx.badRequest('capturedAt is required');
    if (!screenshotId) return ctx.badRequest('screenshotId is required');

    // Determine the employee's current active work session server-side
    const activeSession = await strapi.db.query(SESSION_UID).findOne({
      where: {
        user: userId,
        status: { $in: ['active', 'break'] },
      },
      orderBy: { clockIn: 'desc' },
    });

    if (!activeSession) {
      return ctx.conflict('No active work session. Clock in before submitting screenshots.');
    }

    const validStatuses = ['normal', 'suspicious'];
    const safeStatus = validStatuses.includes(analysisStatus || '') ? analysisStatus : 'normal';

    const record = await strapi.entityService.create(SA_UID, {
      data: {
        capturedAt,
        diffScore: diffScore ?? null,
        isSuspicious: isSuspicious ?? false,
        analysisStatus: safeStatus,
        employee: userId,
        session: activeSession.id,
        screenshot: { id: screenshotId },
      },
    } as any);

    // Retention cleanup: fire-and-forget so a cleanup failure never breaks the submission
    try {
      await cleanupEmployeeScreenshots(userId);
    } catch (err: any) {
      strapi.log.error(
        `[screenshot-retention] Cleanup failed for employee ${userId}: ${err.message}`,
      );
    }

    return ctx.send({ record }, 201);
  },
};
