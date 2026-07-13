import type { Core } from '@strapi/strapi';
import type { Context } from 'koa';
const SESSION_UID = 'api::session.session';

export default {
  async currentStatus(ctx:Context) {
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

  async clockIn(ctx:Context) {
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

    return ctx.send({ session });
  },

  async clockOut(ctx:Context) {
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

    return ctx.send({ session: updated });
  },

  async startBreak(ctx:Context) {
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

    return ctx.send({ session: updated });
  },

  async endBreak(ctx:Context) {
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

    return ctx.send({ session: updated });
  },

  async weeklyHours(ctx:Context) {
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
