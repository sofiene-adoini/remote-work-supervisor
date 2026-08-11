import type { Context } from 'koa';
import { createAndEmit } from '../../alert/services/notification.service';

const SA_UID = 'api::screenshot-analysis.screenshot-analysis';
const SESSION_UID = 'api::session.session';
const ALERT_UID = 'api::alert.alert';

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
        populate: ['employee', 'session'],
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
      populate: ['employee', 'session'],
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
      populate: ['session'],
    });

    return ctx.send({ records });
  },

  async create(ctx: Context) {
    const userId = ctx.state.user?.id;
    const roleType = ctx.state.user?.role?.type;

    if (!userId) return ctx.unauthorized('Authentication required');
    if (roleType === 'employee') return ctx.forbidden('Employees cannot create screenshot analyses directly');

    const { capturedAt, diffScore, isSuspicious, analysisStatus, employeeId } =
      ctx.request.body as {
        capturedAt?: string;
        diffScore?: number;
        isSuspicious?: boolean;
        analysisStatus?: string;
        employeeId?: number;
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

    const { capturedAt, diffScore, isSuspicious, analysisStatus } =
      ctx.request.body as {
        capturedAt?: string;
        diffScore?: number;
        isSuspicious?: boolean;
        analysisStatus?: string;
      };

    if (!capturedAt) return ctx.badRequest('capturedAt is required');

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
      },
    } as any);

    if (isSuspicious) {
      // Defense-in-depth: one suspicious_activity alert per continuous
      // suspicious period. The agent now submits isSuspicious=true only once
      // per period, but guard against retries / reconnects / legacy agents:
      // only alert when the previous period has demonstrably ended, i.e. a
      // 'normal' analysis record for this session is newer than the last
      // suspicious_activity alert (that record is the period-ending high-diff).
      const [lastAlert, lastNormal] = await Promise.all([
        strapi.db.query(ALERT_UID).findOne({
          where: { type: 'suspicious_activity', user: userId, session: activeSession.id },
          orderBy: { createdAt: 'desc' },
        }),
        strapi.db.query(SA_UID).findOne({
          where: { session: activeSession.id, analysisStatus: 'normal' },
          orderBy: { createdAt: 'desc' },
        }),
      ]);

      const previousPeriodEnded =
        !lastAlert || (lastNormal && new Date(lastNormal.createdAt) > new Date(lastAlert.createdAt));

      if (previousPeriodEnded) {
        createAndEmit({
          type: 'suspicious_activity',
          message: 'Suspicious screenshot pattern detected — consecutive low-diff captures.',
          severity: 'critical',
          userId,
          sessionId: activeSession.id,
        }).catch((err) => strapi.log.error(`[Notification] suspicious_activity alert failed: ${err.message}`));
      } else {
        strapi.log.warn(`[Notification] suppressed duplicate suspicious_activity for session ${activeSession.id} — suspicious period still open`);
      }
    }

    return ctx.send({ record }, 201);
  },
};
