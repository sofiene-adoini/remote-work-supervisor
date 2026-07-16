import type { Context } from 'koa';
const SESSION_UID = 'api::session.session';
const USER_UID = 'plugin::users-permissions.user';

function emitSessionChanged(updated: any, userId: number) {
  const io = (strapi as any).io;
  if (!io) return;

  const payload = {
    userId,
    status: updated.status,
    clockIn: updated.clockIn,
    clockOut: updated.clockOut ?? null,
    totalBreakMinutes: updated.totalBreakMinutes ?? 0,
  };

  io.to('company').emit('session:status-changed', payload);
  io.to(`user:${userId}`).emit('session:status-changed', payload);

  strapi.db.query(USER_UID).findOne({
    where: { id: userId },
    populate: ['team'],
  }).then((user: any) => {
    if (user?.team?.id) {
      io.to(`team:${user.team.id}`).emit('session:status-changed', payload);
    }
  }).catch(() => {});
}

export default {
  async currentStatus(ctx: Context) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized('Authentication required');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const session = await strapi.db.query(SESSION_UID).findOne({
      where: {
        user: userId,
        clockIn: { $gte: today.toISOString() },
      },
      orderBy: { clockIn: 'desc' },
    });

    if (!session) {
      return ctx.send({ status: 'clocked_out', session: null });
    }

    return ctx.send({ status: session.status, session });
  },

  async clockIn(ctx: Context) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized('Authentication required');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existing = await strapi.db.query(SESSION_UID).findOne({
      where: {
        user: userId,
        clockIn: { $gte: today.toISOString() },
        status: { $in: ['active', 'break'] },
      },
    });

    if (existing) {
      return ctx.badRequest('Already clocked in today. Clock out first.');
    }

    const session = await strapi.db.query(SESSION_UID).create({
      data: {
        clockIn: new Date().toISOString(),
        status: 'active',
        totalBreakMinutes: 0,
        user: userId,
      },
    });

    emitSessionChanged(session, userId);

    return ctx.send({ session });
  },

  async clockOut(ctx: Context) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized('Authentication required');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const session = await strapi.db.query(SESSION_UID).findOne({
      where: {
        user: userId,
        clockIn: { $gte: today.toISOString() },
        status: { $in: ['active', 'break'] },
      },
      orderBy: { clockIn: 'desc' },
    });

    if (!session) {
      return ctx.badRequest('No active session found.');
    }

    const updated = await strapi.db.query(SESSION_UID).update({
      where: { id: session.id },
      data: {
        clockOut: new Date().toISOString(),
        status: 'completed',
        breakEnd: session.breakStart && !session.breakEnd ? new Date().toISOString() : session.breakEnd,
      },
    });

    emitSessionChanged(updated, userId);

    return ctx.send({ session: updated });
  },

  async startBreak(ctx: Context) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized('Authentication required');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const session = await strapi.db.query(SESSION_UID).findOne({
      where: {
        user: userId,
        clockIn: { $gte: today.toISOString() },
        status: 'active',
      },
      orderBy: { clockIn: 'desc' },
    });

    if (!session) {
      return ctx.badRequest('No active session found. Clock in first.');
    }

    const updated = await strapi.db.query(SESSION_UID).update({
      where: { id: session.id },
      data: {
        breakStart: new Date().toISOString(),
        status: 'break',
      },
    });

    emitSessionChanged(updated, userId);

    return ctx.send({ session: updated });
  },

  async endBreak(ctx: Context) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized('Authentication required');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const session = await strapi.db.query(SESSION_UID).findOne({
      where: {
        user: userId,
        clockIn: { $gte: today.toISOString() },
        status: 'break',
      },
      orderBy: { clockIn: 'desc' },
    });

    if (!session) {
      return ctx.badRequest('No active break found.');
    }

    const breakStart = new Date(session.breakStart);
    const breakEnd = new Date();
    const breakMinutes = Math.round((breakEnd.getTime() - breakStart.getTime()) / 60000);

    const updated = await strapi.db.query(SESSION_UID).update({
      where: { id: session.id },
      data: {
        breakEnd: breakEnd.toISOString(),
        status: 'active',
        totalBreakMinutes: (session.totalBreakMinutes || 0) + breakMinutes,
      },
    });

    emitSessionChanged(updated, userId);

    return ctx.send({ session: updated });
  },

  async history(ctx: Context) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized('Authentication required');

    const { weekStart } = ctx.query as { weekStart?: string };
    const monday = weekStart ? new Date(weekStart as string) : (() => {
      const d = new Date();
      const dayOfWeek = d.getDay();
      d.setDate(d.getDate() - ((dayOfWeek + 6) % 7));
      d.setHours(0, 0, 0, 0);
      return d;
    })();

    if (weekStart) {
      monday.setHours(0, 0, 0, 0);
    }

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 7);

    const sessions = await strapi.db.query(SESSION_UID).findMany({
      where: {
        user: userId,
        clockIn: {
          $gte: monday.toISOString(),
          $lt: sunday.toISOString(),
        },
      },
      orderBy: { clockIn: 'asc' },
    });

    const enriched = sessions.map((s) => {
      const start = new Date(s.clockIn).getTime();
      const end = s.clockOut ? new Date(s.clockOut).getTime() : Date.now();
      const totalMin = (end - start) / 60000;
      const breakMin = s.totalBreakMinutes || 0;
      const workedMin = Math.max(0, totalMin - breakMin);
      return {
        ...s,
        workedMinutes: Math.round(workedMin),
      };
    });

    return ctx.send({ sessions: enriched });
  },

  async todayDetail(ctx: Context) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized('Authentication required');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sessions = await strapi.db.query(SESSION_UID).findMany({
      where: {
        user: userId,
        clockIn: { $gte: today.toISOString() },
      },
      orderBy: { clockIn: 'asc' },
    });

    const enriched = sessions.map((s) => {
      const start = new Date(s.clockIn).getTime();
      const end = s.clockOut ? new Date(s.clockOut).getTime() : Date.now();
      const totalMin = (end - start) / 60000;
      const breakMin = s.totalBreakMinutes || 0;
      const workedMin = Math.max(0, totalMin - breakMin);
      return {
        ...s,
        workedMinutes: Math.round(workedMin),
      };
    });

    const totalWorkedMin = enriched.reduce((sum, s) => sum + s.workedMinutes, 0);
    const totalBreakMin = enriched.reduce((sum, s) => sum + (s.totalBreakMinutes || 0), 0);

    return ctx.send({
      sessions: enriched,
      totalWorkedMinutes: totalWorkedMin,
      totalBreakMinutes: totalBreakMin,
    });
  },

  async weeklyHours(ctx: Context) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized('Authentication required');

    const now = new Date();
    const dayOfWeek = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
    monday.setHours(0, 0, 0, 0);

    const sessions = await strapi.db.query(SESSION_UID).findMany({
      where: {
        user: userId,
        clockIn: { $gte: monday.toISOString() },
      },
      orderBy: { clockIn: 'asc' },
    });

    const hoursByDay: Record<string, number> = {};
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    days.forEach((d) => (hoursByDay[d] = 0));

    for (const session of sessions) {
      const sessionDate = new Date(session.clockIn);
      const dayIdx = (sessionDate.getDay() + 6) % 7;
      const dayName = days[dayIdx];

      const start = new Date(session.clockIn).getTime();
      const end = session.clockOut ? new Date(session.clockOut).getTime() : now.getTime();
      const totalMinutes = (end - start) / 60000;
      const breakMin = session.totalBreakMinutes || 0;
      const workMinutes = Math.max(0, totalMinutes - breakMin);

      hoursByDay[dayName] += Math.round((workMinutes / 60) * 10) / 10;
    }

    return ctx.send({ hoursByDay, days });
  },
};
