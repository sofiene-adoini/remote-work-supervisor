import type { Context } from 'koa';
import { createAndEmit } from '../../alert/services/notification.service';

const SESSION_UID = 'api::session.session';
const USER_UID = 'plugin::users-permissions.user';
const PROJECT_UID = 'api::project.project';

// ── Rich session update emitter (single source of truth for frontend) ──────

export async function emitSessionUpdate(userId: number) {
  const io = (strapi as any).io;
  if (!io) return;

  const now = new Date();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Latest session today
  const session = await strapi.db.query(SESSION_UID).findOne({
    where: {
      user: userId,
      clockIn: { $gte: today.toISOString() },
    },
    orderBy: { clockIn: 'desc' },
  });

  let status: 'clocked_out' | 'active' | 'break' = 'clocked_out';
  let workedTodayMinutes = 0;

  if (session && session.status !== 'completed') {
    status = session.status === 'break' ? 'break' : 'active';

    const start = new Date(session.clockIn).getTime();
    const breakMs = (session.totalBreakMinutes || 0) * 60000;
    const currentBreak =
      session.breakStart && !session.breakEnd
        ? now.getTime() - new Date(session.breakStart).getTime()
        : 0;
    workedTodayMinutes = Math.max(0, Math.round((now.getTime() - start - breakMs - currentBreak) / 60000));
  } else if (session && session.status === 'completed') {
    const start = new Date(session.clockIn).getTime();
    const end = new Date(session.clockOut).getTime();
    workedTodayMinutes = Math.max(0, Math.round((end - start - (session.totalBreakMinutes || 0) * 60000) / 60000));
  }

  // Weekly worked minutes
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
  monday.setHours(0, 0, 0, 0);

  const weekSessions = await strapi.db.query(SESSION_UID).findMany({
    where: {
      user: userId,
      clockIn: { $gte: monday.toISOString() },
    },
  });

  let weeklyMinutes = 0;
  for (const s of weekSessions) {
    const start = new Date(s.clockIn).getTime();
    const end = s.clockOut ? new Date(s.clockOut).getTime() : now.getTime();
    weeklyMinutes += Math.max(0, Math.round((end - start - (s.totalBreakMinutes || 0) * 60000) / 60000));
  }

  // Agent online status
  const agentSockets = (strapi as any).agentSockets as Map<number, any> | undefined;
  const agentOnline = agentSockets ? agentSockets.has(userId) : false;

  // Current assigned project (first active project for this user)
  let currentProject: { id: number; name: string } | null = null;
  try {
    const projects = await strapi.db.query(PROJECT_UID).findMany({
      where: { status: 'active', users: { id: userId } },
      limit: 1,
    });
    if (projects.length > 0) {
      currentProject = { id: projects[0].id, name: projects[0].name };
    }
  } catch {}

  const payload = {
    userId,
    status,
    sessionId: session?.id ?? null,
    clockIn: session?.clockIn ?? null,
    clockOut: session?.clockOut ?? null,
    breakStartedAt: session?.breakStart ?? null,
    totalBreakMinutes: session?.totalBreakMinutes ?? 0,
    workedTodayMinutes,
    weeklyMinutes,
    currentProject,
    agentOnline,
  };

  io.to(`employee:${userId}`).emit('session:updated', payload);

  // Also emit legacy event for backward compat
  io.to('company').emit('session:status-changed', {
    userId,
    status: session?.status ?? 'completed',
    clockIn: session?.clockIn ?? null,
    clockOut: session?.clockOut ?? null,
    totalBreakMinutes: session?.totalBreakMinutes ?? 0,
  });
  io.to(`user:${userId}`).emit('session:status-changed', {
    userId,
    status: session?.status ?? 'completed',
    clockIn: session?.clockIn ?? null,
    clockOut: session?.clockOut ?? null,
    totalBreakMinutes: session?.totalBreakMinutes ?? 0,
  });
}

export default {
  async currentStatus(ctx: Context) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized('Authentication required');

    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const session = await strapi.db.query(SESSION_UID).findOne({
      where: {
        user: userId,
        clockIn: { $gte: today.toISOString() },
      },
      orderBy: { clockIn: 'desc' },
    });

    let status: 'clocked_out' | 'active' | 'break' = 'clocked_out';
    let workedTodayMinutes = 0;

    if (session && session.status !== 'completed') {
      status = session.status === 'break' ? 'break' : 'active';
      const start = new Date(session.clockIn).getTime();
      const breakMs = (session.totalBreakMinutes || 0) * 60000;
      const currentBreak = session.breakStart && !session.breakEnd
        ? now.getTime() - new Date(session.breakStart).getTime() : 0;
      workedTodayMinutes = Math.max(0, Math.round((now.getTime() - start - breakMs - currentBreak) / 60000));
    } else if (session && session.status === 'completed') {
      const start = new Date(session.clockIn).getTime();
      const end = new Date(session.clockOut).getTime();
      workedTodayMinutes = Math.max(0, Math.round((end - start - (session.totalBreakMinutes || 0) * 60000) / 60000));
    }

    const dayOfWeek = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
    monday.setHours(0, 0, 0, 0);

    const weekSessions = await strapi.db.query(SESSION_UID).findMany({
      where: { user: userId, clockIn: { $gte: monday.toISOString() } },
    });

    let weeklyMinutes = 0;
    for (const s of weekSessions) {
      const start = new Date(s.clockIn).getTime();
      const end = s.clockOut ? new Date(s.clockOut).getTime() : now.getTime();
      weeklyMinutes += Math.max(0, Math.round((end - start - (s.totalBreakMinutes || 0) * 60000) / 60000));
    }

    const agentSockets = (strapi as any).agentSockets as Map<number, any> | undefined;
    const agentOnline = agentSockets ? agentSockets.has(userId) : false;

    let currentProject: { id: number; name: string } | null = null;
    try {
      const projects = await strapi.db.query(PROJECT_UID).findMany({
        where: { status: 'active', users: { id: userId } },
        limit: 1,
      });
      if (projects.length > 0) currentProject = { id: projects[0].id, name: projects[0].name };
    } catch {}

    return ctx.send({
      status,
      sessionId: session?.id ?? null,
      clockIn: session?.clockIn ?? null,
      clockOut: session?.clockOut ?? null,
      breakStartedAt: session?.breakStart ?? null,
      totalBreakMinutes: session?.totalBreakMinutes ?? 0,
      workedTodayMinutes,
      weeklyMinutes,
      currentProject,
      agentOnline,
    });
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

    await emitSessionUpdate(userId);

    createAndEmit({
      type: 'clock_in',
      message: 'Employee clocked in.',
      severity: 'info',
      userId,
      sessionId: session.id,
    }).catch((err) => strapi.log.error(`[Notification] clock_in alert failed: ${err.message}`));

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

    await emitSessionUpdate(userId);

    createAndEmit({
      type: 'clock_out',
      message: 'Employee clocked out.',
      severity: 'info',
      userId,
      sessionId: updated.id,
    }).catch((err) => strapi.log.error(`[Notification] clock_out alert failed: ${err.message}`));

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

    await emitSessionUpdate(userId);

    const reason = (ctx.request.body as any)?.reason;
    const isAuto = reason === 'auto-idle';

    createAndEmit({
      type: 'break_started',
      message: isAuto ? 'Automatic break started due to inactivity.' : 'Break started.',
      severity: isAuto ? 'warning' : 'info',
      userId,
      sessionId: updated.id,
    }).catch((err) => strapi.log.error(`[Notification] break_started alert failed: ${err.message}`));

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

    await emitSessionUpdate(userId);

    createAndEmit({
      type: 'break_ended',
      message: `Break ended. Duration: ${breakMinutes} minute${breakMinutes !== 1 ? 's' : ''}.`,
      severity: 'info',
      userId,
      sessionId: updated.id,
    }).catch((err) => strapi.log.error(`[Notification] break_ended alert failed: ${err.message}`));

    return ctx.send({ session: updated });
  },

  async idleDetected(ctx: Context) {
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
      return ctx.send({ ok: true });
    }

    const { idleMs } = (ctx.request.body as any) || {};
    const idleMinutes = idleMs ? Math.round(idleMs / 60000) : undefined;
    const message = idleMinutes
      ? `Employee has been idle for ${idleMinutes} minute${idleMinutes !== 1 ? 's' : ''}.`
      : 'Employee idle detected.';

    await createAndEmit({
      type: 'idle_detected',
      message,
      severity: 'warning',
      userId,
      sessionId: session.id,
    });

    return ctx.send({ ok: true });
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
