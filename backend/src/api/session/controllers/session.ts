import type { Context } from 'koa';
import { createAndEmit } from '../../alert/services/notification.service';
import { TimeCalculationService } from '../../company-work-policy/services/time-calculation.service';
import { WorkPolicyService } from '../../company-work-policy/services/work-policy.service';

const SESSION_UID = 'api::session.session';
const BREAK_UID = 'api::break.break';
const USER_UID = 'plugin::users-permissions.user';
const PROJECT_UID = 'api::project.project';

// ── Continuous work protection ───────────────────────────────────────────

let continuousWorkCheckInterval: NodeJS.Timeout | null = null;

export function startContinuousWorkCheck() {
  if (continuousWorkCheckInterval) return;

  continuousWorkCheckInterval = setInterval(async () => {
    try {
      const policy = await WorkPolicyService.get();
      const maxContinuousMs = policy.maximumContinuousWorkHours * 60 * 60 * 1000;
      const now = new Date();

      const activeSessions = await strapi.db.query(SESSION_UID).findMany({
        where: { status: { $in: ['active'] } },
        populate: ['user'],
      });

      for (const session of activeSessions) {
        const userId = typeof session.user === 'object' ? session.user.id : session.user;
        const sessionStart = new Date(session.clockIn).getTime();
        const elapsed = now.getTime() - sessionStart;
        const breakMs = (session.totalBreakMinutes || 0) * 60000;
        const continuousWorkMs = elapsed - breakMs;

        if (continuousWorkMs > maxContinuousMs) {
          const continuousHours = Math.round((continuousWorkMs / 60000 / 60) * 10) / 10;

          await createAndEmit({
            type: 'continuous_work_warning',
            title: 'Continuous Work Warning',
            message: `You have been working for ${continuousHours} hours continuously without taking a break. Please take a break.`,
            severity: 'warning',
            userId,
            sessionId: session.id,
          });

          await createAndEmit({
            type: 'continuous_work_warning',
            title: 'Continuous Work Warning',
            message: `Employee has been working for ${continuousHours} hours continuously without a break.`,
            severity: 'warning',
            userId,
            sessionId: session.id,
          });

          strapi.log.warn(`[Policy] Continuous work warning: user=${userId} ${continuousHours}h without break`);
        }
      }
    } catch (err: any) {
      strapi.log.error(`[Policy] Continuous work check failed: ${err.message}`);
    }
  }, 5 * 60 * 1000);

  strapi.log.info('[Policy] Continuous work check started (5-minute interval)');
}

// ── Rich session update emitter (single source of truth for frontend) ──────

export async function emitSessionUpdate(userId: number) {
  const io = (strapi as any).io;
  if (!io) return;

  const uid = Number(userId);
  const now = new Date();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const session = await strapi.db.query(SESSION_UID).findOne({
    where: {
      user: uid,
      clockIn: { $gte: today.toISOString() },
    },
    orderBy: { clockIn: 'desc' },
  });

  let status: 'clocked_out' | 'active' | 'break' = 'clocked_out';
  let workedTodayMinutes = 0;

  if (session && session.status !== 'completed') {
    status = session.status === 'break' ? 'break' : 'active';
    workedTodayMinutes = TimeCalculationService.computeActiveWorkedMinutes({
      clockIn: session.clockIn,
      totalBreakMinutes: session.totalBreakMinutes || 0,
      breakStart: session.breakStart,
    }, now);
  } else if (session && session.status === 'completed') {
    workedTodayMinutes = TimeCalculationService.computeWorkedMinutes(session, now);
  }

  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
  monday.setHours(0, 0, 0, 0);

  const weekSessions = await strapi.db.query(SESSION_UID).findMany({
    where: { user: uid, clockIn: { $gte: monday.toISOString() } },
  });

  let weeklyMinutes = 0;
  for (const s of weekSessions) {
    weeklyMinutes += TimeCalculationService.computeWorkedMinutes(s, now);
  }

  const agentSockets = (strapi as any).agentSockets as Map<number, any> | undefined;
  const agentOnline = agentSockets ? agentSockets.has(uid) : false;

  let currentProject: { id: number; name: string } | null = null;
  try {
    const projects = await strapi.db.query(PROJECT_UID).findMany({
      where: { status: 'active', users: { id: uid } },
      limit: 1,
    });
    if (projects.length > 0) {
      currentProject = { id: projects[0].id, name: projects[0].name };
    }
  } catch {}

  const [dailyStats, weeklyStats] = await Promise.all([
    TimeCalculationService.computeDailyStats(uid, now),
    TimeCalculationService.computeWeeklyStats(uid, monday),
  ]);

  const payload = {
    userId: uid,
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
    dailyStats,
    weeklyStats,
  };

  io.to(`employee:${uid}`).emit('session:updated', payload);

  io.to('company').emit('session:status-changed', {
    userId: uid,
    status: session?.status ?? 'completed',
    clockIn: session?.clockIn ?? null,
    clockOut: session?.clockOut ?? null,
    totalBreakMinutes: session?.totalBreakMinutes ?? 0,
  });
  io.to(`user:${uid}`).emit('session:status-changed', {
    userId: uid,
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

    const uid = Number(userId);
    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const session = await strapi.db.query(SESSION_UID).findOne({
      where: {
        user: uid,
        clockIn: { $gte: today.toISOString() },
      },
      orderBy: { clockIn: 'desc' },
    });

    let status: 'clocked_out' | 'active' | 'break' = 'clocked_out';
    let workedTodayMinutes = 0;

    if (session && session.status !== 'completed') {
      status = session.status === 'break' ? 'break' : 'active';
      workedTodayMinutes = TimeCalculationService.computeActiveWorkedMinutes({
        clockIn: session.clockIn,
        totalBreakMinutes: session.totalBreakMinutes || 0,
        breakStart: session.breakStart,
      }, now);
    } else if (session && session.status === 'completed') {
      workedTodayMinutes = TimeCalculationService.computeWorkedMinutes(session, now);
    }

    const dayOfWeek = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
    monday.setHours(0, 0, 0, 0);

    const weekSessions = await strapi.db.query(SESSION_UID).findMany({
      where: { user: uid, clockIn: { $gte: monday.toISOString() } },
    });

    let weeklyMinutes = 0;
    for (const s of weekSessions) {
      weeklyMinutes += TimeCalculationService.computeWorkedMinutes(s, now);
    }

    const agentSockets = (strapi as any).agentSockets as Map<number, any> | undefined;
    const agentOnline = agentSockets ? agentSockets.has(uid) : false;

    let currentProject: { id: number; name: string } | null = null;
    try {
      const projects = await strapi.db.query(PROJECT_UID).findMany({
        where: { status: 'active', users: { id: uid } },
        limit: 1,
      });
      if (projects.length > 0) currentProject = { id: projects[0].id, name: projects[0].name };
    } catch {}

    const [dailyStats, weeklyStats] = await Promise.all([
      TimeCalculationService.computeDailyStats(uid, now),
      TimeCalculationService.computeWeeklyStats(uid, monday),
    ]);

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
      dailyStats,
      weeklyStats,
    });
  },

  async dailyStats(ctx: Context) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized('Authentication required');

    const { date } = ctx.query as { date?: string };
    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);

    const stats = await TimeCalculationService.computeDailyStats(userId, targetDate);
    return ctx.send({ stats });
  },

  async weeklyStats(ctx: Context) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized('Authentication required');

    const now = new Date();
    const dayOfWeek = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
    monday.setHours(0, 0, 0, 0);

    const stats = await TimeCalculationService.computeWeeklyStats(userId, monday);
    return ctx.send({ stats });
  },

  async monthlyStats(ctx: Context) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized('Authentication required');

    const { year, month } = ctx.query as { year?: string; month?: string };
    const now = new Date();
    const y = year ? parseInt(year, 10) : now.getFullYear();
    const m = month ? parseInt(month, 10) : now.getMonth() + 1;

    const stats = await TimeCalculationService.computeMonthlyStats(userId, y, m);
    return ctx.send({ stats });
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

    const policy = await WorkPolicyService.get();
    if (!policy.allowWeekendWork && !WorkPolicyService.isWorkingDay(new Date())) {
      createAndEmit({
        type: 'clock_in',
        title: 'Weekend Work',
        message: 'Employee clocked in outside scheduled working days.',
        severity: 'warning',
        userId,
      }).catch(() => {});
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

    const policy = await WorkPolicyService.get();
    const workedMin = TimeCalculationService.computeWorkedMinutes(
      { clockIn: session.clockIn, clockOut: new Date().toISOString(), totalBreakMinutes: session.totalBreakMinutes || 0, status: 'completed' },
      new Date(),
    );

    if (workedMin > policy.maximumDailyHours * 60) {
      createAndEmit({
        type: 'overtime_alert',
        title: 'Daily Maximum Exceeded',
        message: `Employee worked ${Math.round(workedMin / 60 * 10) / 10} hours today, exceeding the daily maximum of ${policy.maximumDailyHours} hours.`,
        severity: 'warning',
        userId,
        sessionId: updated.id,
      }).catch(() => {});
    }

    if ((session.totalBreakMinutes || 0) < policy.minimumBreakMinutes && workedMin >= policy.expectedDailyHours * 60 * 0.5) {
      createAndEmit({
        type: 'break_violation',
        title: 'Insufficient Break Time',
        message: `Employee took only ${session.totalBreakMinutes || 0} minutes of breaks today. Minimum required is ${policy.minimumBreakMinutes} minutes.`,
        severity: 'warning',
        userId,
        sessionId: updated.id,
      }).catch(() => {});
    }

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

    const now = new Date().toISOString();
    const reason = (ctx.request.body as any)?.reason;
    const isAuto = reason === 'auto-idle';

    const updated = await strapi.db.query(SESSION_UID).update({
      where: { id: session.id },
      data: {
        breakStart: now,
        status: 'break',
      },
    });

    await strapi.db.query(BREAK_UID).create({
      data: {
        start: now,
        duration: 0,
        isAuto,
        session: session.id,
      },
    });

    await emitSessionUpdate(userId);

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

    const activeBreak = await strapi.db.query(BREAK_UID).findOne({
      where: { session: session.id, end: null },
      orderBy: { start: 'desc' },
    });

    if (activeBreak) {
      await strapi.db.query(BREAK_UID).update({
        where: { id: activeBreak.id },
        data: {
          end: breakEnd.toISOString(),
          duration: breakMinutes,
        },
      });
    }

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
      populate: ['breaks'],
    });

    const enriched = sessions.map((s) => ({
      ...s,
      workedMinutes: TimeCalculationService.computeWorkedMinutes(s, new Date()),
      breaks: (s.breaks || []).map((b: any) => ({
        id: b.id,
        start: b.start,
        end: b.end,
        duration: b.duration,
        isAuto: b.isAuto,
      })),
    }));

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
      populate: ['breaks'],
    });

    const enriched = sessions.map((s) => ({
      ...s,
      workedMinutes: TimeCalculationService.computeWorkedMinutes(s, new Date()),
    }));

    const totalWorkedMin = enriched.reduce((sum, s) => sum + s.workedMinutes, 0);
    const totalBreakMin = enriched.reduce((sum, s) => sum + (s.totalBreakMinutes || 0), 0);

    return ctx.send({
      sessions: enriched,
      totalWorkedMinutes: totalWorkedMin,
      totalBreakMinutes: totalBreakMin,
    });
  },

  async range(ctx: Context) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized('Authentication required');

    const { start, end } = ctx.query as { start?: string; end?: string };
    if (!start || !end) return ctx.badRequest('start and end query params required (YYYY-MM-DD)');

    const startDate = new Date(start);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(end);
    endDate.setHours(23, 59, 59, 999);

    const sessions = await strapi.db.query(SESSION_UID).findMany({
      where: {
        user: userId,
        clockIn: { $gte: startDate.toISOString(), $lte: endDate.toISOString() },
      },
      orderBy: { clockIn: 'asc' },
      populate: ['breaks'],
    });

    const enriched = sessions.map((s) => ({
      id: s.id,
      clockIn: s.clockIn,
      clockOut: s.clockOut,
      breakStart: s.breakStart,
      breakEnd: s.breakEnd,
      status: s.status,
      totalBreakMinutes: s.totalBreakMinutes,
      workedMinutes: TimeCalculationService.computeWorkedMinutes(s, new Date()),
      breaks: (s.breaks || []).map((b: any) => ({
        id: b.id,
        start: b.start,
        end: b.end,
        duration: b.duration,
        isAuto: b.isAuto,
      })),
    }));

    return ctx.send({ sessions: enriched });
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

      const workMinutes = TimeCalculationService.computeWorkedMinutes(session, now);
      hoursByDay[dayName] += Math.round((workMinutes / 60) * 10) / 10;
    }

    return ctx.send({ hoursByDay, days });
  },
};
