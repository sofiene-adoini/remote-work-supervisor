import type { Context } from 'koa';
const BREAK_UID = 'api::break.break';
const SESSION_UID = 'api::session.session';

export default {
  async bySession(ctx: Context) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized('Authentication required');

    const { sessionId } = ctx.query as { sessionId?: string };
    if (!sessionId) return ctx.badRequest('sessionId is required');

    const session = await strapi.db.query(SESSION_UID).findOne({
      where: { id: parseInt(sessionId, 10), user: userId },
    });
    if (!session) return ctx.notFound('Session not found');

    const breaks = await strapi.db.query(BREAK_UID).findMany({
      where: { session: parseInt(sessionId, 10) },
      orderBy: { start: 'asc' },
    });

    return ctx.send({ breaks });
  },

  async my(ctx: Context) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized('Authentication required');

    const { start, end } = ctx.query as { start?: string; end?: string };

    const where: any = { user: userId };
    if (start || end) {
      where.start = {};
      if (start) where.start.$gte = new Date(start).toISOString();
      if (end) where.end = where.end || {};
      if (end) where.start.$lte = new Date(end).toISOString();
    }

    const breaks = await strapi.db.query(BREAK_UID).findMany({
      where,
      orderBy: { start: 'desc' },
      populate: ['session'],
    });

    const enriched = breaks.map((b: any) => ({
      id: b.id,
      startTime: b.start,
      endTime: b.end,
      durationMinutes: b.duration,
      isAutomatic: b.isAuto,
      reason: b.reason,
      session: b.session
        ? { id: b.session.id, clockIn: b.session.clockIn, clockOut: b.session.clockOut }
        : null,
    }));

    return ctx.send({ breaks: enriched });
  },

  async employee(ctx: Context) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized('Authentication required');

    const roleName = ctx.state.user?.role?.name;
    if (roleName !== 'HR' && roleName !== 'Admin') return ctx.forbidden('HR or Admin role required');

    const targetUserId = parseInt(ctx.params.userId, 10);
    if (!targetUserId) return ctx.badRequest('userId is required');

    const { start, end } = ctx.query as { start?: string; end?: string };

    const where: any = { user: targetUserId };
    if (start || end) {
      where.start = {};
      if (start) where.start.$gte = new Date(start).toISOString();
      if (end) where.end = where.end || {};
      if (end) where.start.$lte = new Date(end).toISOString();
    }

    const breaks = await strapi.db.query(BREAK_UID).findMany({
      where,
      orderBy: { start: 'desc' },
      populate: ['session'],
    });

    const enriched = breaks.map((b: any) => ({
      id: b.id,
      startTime: b.start,
      endTime: b.end,
      durationMinutes: b.duration,
      isAutomatic: b.isAuto,
      reason: b.reason,
      session: b.session
        ? { id: b.session.id, clockIn: b.session.clockIn, clockOut: b.session.clockOut }
        : null,
    }));

    return ctx.send({ breaks: enriched });
  },
};
