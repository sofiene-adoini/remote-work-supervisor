import type { Context } from 'koa';
import { WorkPolicyService } from '../../company-work-policy/services/work-policy.service';

const SESSION_UID = 'api::session.session';
const USER_UID = 'plugin::users-permissions.user';
const ALERT_UID = 'api::alert.alert';
const SCREENSHOT_UID = 'api::screenshot-analysis.screenshot-analysis';

function parseDateRange(startDate?: string, endDate?: string): { start: Date; end: Date } {
  const end = endDate ? new Date(endDate) : new Date();
  const start = startDate ? new Date(startDate) : (() => {
    const d = new Date(end);
    d.setDate(d.getDate() - 30);
    return d;
  })();
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function computeSessionWorkedMinutes(s: any, now: Date): number {
  const startMs = new Date(s.clockIn).getTime();
  const endMs = s.clockOut ? new Date(s.clockOut).getTime() : now.getTime();
  return Math.max(0, Math.round((endMs - startMs) / 60000) - (s.totalBreakMinutes || 0));
}

function classifyAttendance(workedMin: number, expectedMin: number, policy: any): string {
  if (workedMin === 0) return 'absent';
  if (workedMin >= expectedMin) return workedMin > policy.overtimeStartsAfterDailyHours * 60 ? 'overtime' : 'excellent';
  if (workedMin >= expectedMin * 0.9) return 'good';
  if (workedMin >= expectedMin * 0.75) return 'acceptable';
  return 'underworked';
}

export default {
  async summary(ctx: Context) {
    const roleName = ctx.state.user?.role?.name;
    if (roleName !== 'HR' && roleName !== 'Admin') return ctx.forbidden('HR or Admin role required');

    const { startDate, endDate } = ctx.query as { startDate?: string; endDate?: string };
    const { start, end } = parseDateRange(startDate, endDate);
    const policy = await WorkPolicyService.get();

    const employees = await strapi.db.query(USER_UID).findMany({
      where: { role: { name: 'Employee' } },
    });

    const sessions = await strapi.db.query(SESSION_UID).findMany({
      where: { clockIn: { $gte: start.toISOString(), $lte: end.toISOString() } },
      populate: ['user'],
    });

    let totalWorked = 0;
    let totalBreak = 0;
    let totalOT = 0;
    let totalMissing = 0;
    let absentDays = 0;
    let overtimeDays = 0;
    let breakViolations = 0;
    let workedDays = 0;

    const empSessionMap = new Map<number, any[]>();
    for (const s of sessions) {
      if (!s.user) continue;
      const uid = typeof s.user === 'object' ? s.user.id : s.user;
      if (!empSessionMap.has(uid)) empSessionMap.set(uid, []);
      empSessionMap.get(uid)!.push(s);
    }

    for (const [uid, empSessions] of empSessionMap) {
      const byDay = new Map<string, any[]>();
      for (const s of empSessions) {
        const day = new Date(s.clockIn).toDateString();
        if (!byDay.has(day)) byDay.set(day, []);
        byDay.get(day)!.push(s);
      }

      for (const [, daySessions] of byDay) {
        let dayWorked = 0;
        let dayBreak = 0;
        for (const s of daySessions) {
          dayWorked += computeSessionWorkedMinutes(s, new Date());
          dayBreak += s.totalBreakMinutes || 0;
        }
        totalWorked += dayWorked;
        totalBreak += dayBreak;
        workedDays++;

        const expectedMin = policy.expectedDailyHours * 60;
        if (dayWorked > policy.overtimeStartsAfterDailyHours * 60) {
          totalOT += dayWorked - policy.overtimeStartsAfterDailyHours * 60;
          overtimeDays++;
        }
        if (dayWorked < expectedMin) {
          totalMissing += expectedMin - dayWorked;
        }
        if (dayBreak < policy.minimumBreakMinutes && dayWorked >= expectedMin * 0.5) {
          breakViolations++;
        }
      }
    }

    const workingDaysInRange = TimeCalcService.countWorkingDays(start, end);
    absentDays = Math.max(0, workingDaysInRange * employees.length - workedDays);

    return ctx.send({
      totalEmployees: employees.length,
      totalWorkedHours: Math.round((totalWorked / 60) * 10) / 10,
      totalBreakHours: Math.round((totalBreak / 60) * 10) / 10,
      totalOvertimeHours: Math.round((totalOT / 60) * 10) / 10,
      totalMissingHours: Math.round((totalMissing / 60) * 10) / 10,
      absentDays,
      overtimeDays,
      breakViolations,
      averageAttendancePct: workedDays > 0 && workingDaysInRange > 0
        ? Math.min(100, Math.round((totalWorked / (workingDaysInRange * policy.expectedDailyHours * 60)) * 100 * employees.length / Math.max(1, workedDays)))
        : 0,
      workingDaysInRange,
    });
  },

  async employees(ctx: Context) {
    const roleName = ctx.state.user?.role?.name;
    if (roleName !== 'HR' && roleName !== 'Admin') return ctx.forbidden('HR or Admin role required');

    const {
      startDate, endDate, page = '1', pageSize = '20',
      search, status, attendance, teamId,
      sortBy = 'fullName', sortDir = 'asc',
    } = ctx.query as Record<string, string>;

    const { start, end } = parseDateRange(startDate, endDate);
    const policy = await WorkPolicyService.get();
    const pg = Math.max(1, parseInt(page, 10));
    const ps = Math.min(100, Math.max(1, parseInt(pageSize, 10)));

    const where: any = { role: { name: 'Employee' } };
    if (search) {
      where.$or = [
        { fullName: { $containsi: search } },
        { email: { $containsi: search } },
      ];
    }
    if (teamId) {
      where.team = { id: parseInt(teamId, 10) };
    }

    const allEmployees = await strapi.db.query(USER_UID).findMany({ where, populate: ['team'] });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const agentSockets = (strapi as any).agentSockets as Map<number, any> | undefined;

    const enriched = await Promise.all(allEmployees.map(async (emp) => {
      const empSessions = await strapi.db.query(SESSION_UID).findMany({
        where: {
          user: emp.id,
          clockIn: { $gte: start.toISOString(), $lte: end.toISOString() },
        },
        populate: ['user'],
      });

      const latestSession = await strapi.db.query(SESSION_UID).findOne({
        where: {
          user: emp.id,
          clockIn: { $gte: today.toISOString() },
        },
        populate: ['user'],
        orderBy: { clockIn: 'desc' },
      });

      let currentStatus = 'clocked_out';
      if (latestSession) {
        if (latestSession.status === 'active') currentStatus = 'active';
        else if (latestSession.status === 'break') currentStatus = 'break';
        else currentStatus = 'clocked_out';
      }
      const agentOnline = agentSockets ? agentSockets.has(emp.id) : false;

      const byDay = new Map<string, any[]>();
      for (const s of empSessions) {
        const day = new Date(s.clockIn).toDateString();
        if (!byDay.has(day)) byDay.set(day, []);
        byDay.get(day)!.push(s);
      }

      let totalWorked = 0;
      let totalBreak = 0;
      let totalOT = 0;
      let daysPresent = 0;
      let breakViolations = 0;
      let longestDayMin = 0;

      for (const [, daySessions] of byDay) {
        let dayWorked = 0;
        let dayBreak = 0;
        for (const s of daySessions) {
          dayWorked += computeSessionWorkedMinutes(s, new Date());
          dayBreak += s.totalBreakMinutes || 0;
        }
        totalWorked += dayWorked;
        totalBreak += dayBreak;
        daysPresent++;
        if (dayWorked > longestDayMin) longestDayMin = dayWorked;
        if (dayWorked > policy.overtimeStartsAfterDailyHours * 60) {
          totalOT += dayWorked - policy.overtimeStartsAfterDailyHours * 60;
        }
        if (dayBreak < policy.minimumBreakMinutes && dayWorked >= policy.expectedDailyHours * 30) {
          breakViolations++;
        }
      }

      const workingDays = TimeCalcService.countWorkingDays(start, end);
      const expectedMin = workingDays * policy.expectedDailyHours * 60;
      const missingMin = Math.max(0, expectedMin - totalWorked);
      const attendancePct = expectedMin > 0 ? Math.min(100, Math.round((totalWorked / expectedMin) * 100)) : 0;
      const evaluation = classifyAttendance(totalWorked / Math.max(1, daysPresent), policy.expectedDailyHours * 60, policy);

      const lastActivity = latestSession
        ? (latestSession.clockOut || latestSession.clockIn)
        : null;

      return {
        userId: emp.id,
        fullName: emp.fullName,
        email: emp.email,
        team: emp.team ? { id: emp.team.id, name: emp.team.name } : null,
        workedHours: Math.round((totalWorked / 60) * 10) / 10,
        expectedHours: Math.round((expectedMin / 60) * 10) / 10,
        missingHours: Math.round((missingMin / 60) * 10) / 10,
        overtimeHours: Math.round((totalOT / 60) * 10) / 10,
        breakHours: Math.round((totalBreak / 60) * 10) / 10,
        attendancePct,
        evaluation,
        currentStatus,
        agentOnline,
        lastActivity,
        breakViolations,
        daysPresent,
        longestDayHours: Math.round((longestDayMin / 60) * 10) / 10,
      };
    }));

    let filtered = enriched;

    if (status) {
      filtered = filtered.filter((e) => e.currentStatus === status);
    }
    if (attendance) {
      filtered = filtered.filter((e) => e.evaluation === attendance);
    }

    const sortField = sortBy === 'name' ? 'fullName' : sortBy;
    filtered.sort((a: any, b: any) => {
      const av = a[sortField] ?? 0;
      const bv = b[sortField] ?? 0;
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === 'asc' ? av - bv : bv - av;
    });

    const total = filtered.length;
    const paged = filtered.slice((pg - 1) * ps, pg * ps);

    return ctx.send({
      employees: paged,
      pagination: { page: pg, pageSize: ps, total, totalPages: Math.ceil(total / ps) },
    });
  },

  async employeeDetail(ctx: Context) {
    const roleName = ctx.state.user?.role?.name;
    if (roleName !== 'HR' && roleName !== 'Admin') return ctx.forbidden('HR or Admin role required');

    const { id } = ctx.params;
    const { startDate, endDate } = ctx.query as { startDate?: string; endDate?: string };
    const { start, end } = parseDateRange(startDate, endDate);
    const policy = await WorkPolicyService.get();

    const user = await strapi.db.query(USER_UID).findOne({
      where: { id: parseInt(id, 10) },
      populate: ['team'],
    });
    if (!user) return ctx.notFound('Employee not found');

    const sessions = await strapi.db.query(SESSION_UID).findMany({
      where: {
        user: user.id,
        clockIn: { $gte: start.toISOString(), $lte: end.toISOString() },
      },
      populate: ['user'],
      orderBy: { clockIn: 'asc' },
    });

    const alerts = await strapi.db.query(ALERT_UID).findMany({
      where: {
        user: user.id,
        createdAt: { $gte: start.toISOString(), $lte: end.toISOString() },
      },
    });

    const screenshots = await strapi.db.query(SCREENSHOT_UID).findMany({
      where: {
        employee: user.id,
        capturedAt: { $gte: start.toISOString(), $lte: end.toISOString() },
      },
    });

    const byDay = new Map<string, any[]>();
    for (const s of sessions) {
      const day = new Date(s.clockIn).toDateString();
      if (!byDay.has(day)) byDay.set(day, []);
      byDay.get(day)!.push(s);
    }

    let totalWorked = 0;
    let totalBreak = 0;
    let totalOT = 0;
    let longestDayMin = 0;
    let longestBreakMin = 0;
    let breakViolations = 0;
    let autoBreakCount = 0;
    let manualBreakCount = 0;
    let suspiciousCount = screenshots.filter((s: any) => s.isSuspicious).length;

    for (const [, daySessions] of byDay) {
      let dayWorked = 0;
      let dayBreak = 0;
      for (const s of daySessions) {
        const wm = computeSessionWorkedMinutes(s, new Date());
        dayWorked += wm;
        dayBreak += s.totalBreakMinutes || 0;
        if ((s.totalBreakMinutes || 0) > longestBreakMin) longestBreakMin = s.totalBreakMinutes || 0;
      }
      totalWorked += dayWorked;
      totalBreak += dayBreak;
      if (dayWorked > longestDayMin) longestDayMin = dayWorked;
      if (dayWorked > policy.overtimeStartsAfterDailyHours * 60) {
        totalOT += dayWorked - policy.overtimeStartsAfterDailyHours * 60;
      }
      if (dayBreak < policy.minimumBreakMinutes && dayWorked >= policy.expectedDailyHours * 30) {
        breakViolations++;
      }
    }

    const breakAlerts = alerts.filter((a: any) => a.type === 'break_started');
    autoBreakCount = breakAlerts.filter((a: any) => a.message?.includes('Automatic')).length;
    manualBreakCount = breakAlerts.length - autoBreakCount;

    const workingDays = TimeCalcService.countWorkingDays(start, end);
    const expectedMin = workingDays * policy.expectedDailyHours * 60;
    const daysPresent = byDay.size;
    const avgDailyMin = daysPresent > 0 ? totalWorked / daysPresent : 0;

    return ctx.send({
      employee: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        team: user.team ? { id: user.team.id, name: user.team.name } : null,
      },
      summary: {
        workedHours: Math.round((totalWorked / 60) * 10) / 10,
        expectedHours: Math.round((expectedMin / 60) * 10) / 10,
        missingHours: Math.round((Math.max(0, expectedMin - totalWorked) / 60) * 10) / 10,
        overtimeHours: Math.round((totalOT / 60) * 10) / 10,
        breakHours: Math.round((totalBreak / 60) * 10) / 10,
        averageDailyHours: Math.round((avgDailyMin / 60) * 10) / 10,
        longestDayHours: Math.round((longestDayMin / 60) * 10) / 10,
        longestBreakMinutes: longestBreakMin,
        breakViolations,
        suspiciousScreenshotCount: suspiciousCount,
        autoBreakCount,
        manualBreakCount,
        daysPresent,
        workingDaysInRange: workingDays,
      },
    });
  },

  async employeeTimeline(ctx: Context) {
    const roleName = ctx.state.user?.role?.name;
    if (roleName !== 'HR' && roleName !== 'Admin') return ctx.forbidden('HR or Admin role required');

    const { id } = ctx.params;
    const { startDate, endDate } = ctx.query as { startDate?: string; endDate?: string };
    const { start, end } = parseDateRange(startDate, endDate);
    const policy = await WorkPolicyService.get();

    const sessions = await strapi.db.query(SESSION_UID).findMany({
      where: {
        user: parseInt(id, 10),
        clockIn: { $gte: start.toISOString(), $lte: end.toISOString() },
      },
      populate: ['user'],
      orderBy: { clockIn: 'asc' },
    });

    const alerts = await strapi.db.query(ALERT_UID).findMany({
      where: {
        user: parseInt(id, 10),
        createdAt: { $gte: start.toISOString(), $lte: end.toISOString() },
      },
    });

    const screenshots = await strapi.db.query(SCREENSHOT_UID).findMany({
      where: {
        employee: parseInt(id, 10),
        capturedAt: { $gte: start.toISOString(), $lte: end.toISOString() },
      },
    });

    const byDay = new Map<string, any[]>();
    for (const s of sessions) {
      const day = new Date(s.clockIn).toDateString();
      if (!byDay.has(day)) byDay.set(day, []);
      byDay.get(day)!.push(s);
    }

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const timeline: any[] = [];

    const cursor = new Date(start);
    while (cursor <= end) {
      const dayKey = cursor.toDateString();
      const daySessions = byDay.get(dayKey) || [];
      const dayStr = cursor.toISOString().split('T')[0];

      const dayAlerts = alerts.filter((a: any) => new Date(a.createdAt).toDateString() === dayKey);
      const dayScreenshots = screenshots.filter((s: any) => new Date(s.capturedAt).toDateString() === dayKey);

      if (daySessions.length === 0) {
        const isWorking = WorkPolicyService.isWorkingDay(cursor);
        timeline.push({
          date: dayStr,
          dayOfWeek: dayNames[cursor.getDay()],
          isWorkingDay: isWorking,
          sessions: [],
          clockIn: null,
          clockOut: null,
          breaks: [],
          workedMinutes: 0,
          breakMinutes: 0,
          overtimeMinutes: 0,
          attendance: isWorking ? 'absent' : 'day_off',
          alerts: dayAlerts.map((a: any) => ({ id: a.id, type: a.type, title: a.title, severity: a.severity, message: a.message })),
          screenshotCount: dayScreenshots.length,
          suspiciousCount: dayScreenshots.filter((s: any) => s.isSuspicious).length,
        });
      } else {
        let firstIn: string | null = null;
        let lastOut: string | null = null;
        let dayWorked = 0;
        let dayBreak = 0;
        const breaks: { start: string; end: string | null; minutes: number }[] = [];

        for (const s of daySessions) {
          if (!firstIn || s.clockIn < firstIn) firstIn = s.clockIn;
          if (s.clockOut && (!lastOut || s.clockOut > lastOut)) lastOut = s.clockOut;
          dayWorked += computeSessionWorkedMinutes(s, new Date());
          dayBreak += s.totalBreakMinutes || 0;
          if (s.breakStart) {
            breaks.push({
              start: s.breakStart,
              end: s.breakEnd || null,
              minutes: s.totalBreakMinutes || 0,
            });
          }
        }

        const expectedMin = policy.expectedDailyHours * 60;
        const otMin = dayWorked > policy.overtimeStartsAfterDailyHours * 60
          ? dayWorked - policy.overtimeStartsAfterDailyHours * 60 : 0;

        timeline.push({
          date: dayStr,
          dayOfWeek: dayNames[cursor.getDay()],
          isWorkingDay: true,
          clockIn: firstIn,
          clockOut: lastOut,
          breaks,
          workedMinutes: dayWorked,
          breakMinutes: dayBreak,
          overtimeMinutes: otMin,
          attendance: classifyAttendance(dayWorked, expectedMin, policy),
          alerts: dayAlerts.map((a: any) => ({ id: a.id, type: a.type, title: a.title, severity: a.severity, message: a.message })),
          screenshotCount: dayScreenshots.length,
          suspiciousCount: dayScreenshots.filter((s: any) => s.isSuspicious).length,
        });
      }

      cursor.setDate(cursor.getDate() + 1);
    }

    return ctx.send({ timeline });
  },

  async charts(ctx: Context) {
    const roleName = ctx.state.user?.role?.name;
    if (roleName !== 'HR' && roleName !== 'Admin') return ctx.forbidden('HR or Admin role required');

    const { startDate, endDate } = ctx.query as { startDate?: string; endDate?: string };
    const { start, end } = parseDateRange(startDate, endDate);
    const policy = await WorkPolicyService.get();

    const sessions = await strapi.db.query(SESSION_UID).findMany({
      where: { clockIn: { $gte: start.toISOString(), $lte: end.toISOString() } },
      populate: ['user'],
    });

    const dailyAgg = new Map<string, { worked: number; ot: number; breakMin: number; count: number }>();
    const empAgg = new Map<number, { worked: number; ot: number; idle: number }>();

    const cursor = new Date(start);
    while (cursor <= end) {
      dailyAgg.set(cursor.toISOString().split('T')[0], { worked: 0, ot: 0, breakMin: 0, count: 0 });
      cursor.setDate(cursor.getDate() + 1);
    }

    for (const s of sessions) {
      if (!s.user) continue;
      const uid = typeof s.user === 'object' ? s.user.id : s.user;
      const day = new Date(s.clockIn).toISOString().split('T')[0];
      const wm = computeSessionWorkedMinutes(s, new Date());

      const da = dailyAgg.get(day);
      if (da) {
        da.worked += wm;
        da.breakMin += s.totalBreakMinutes || 0;
        da.count++;
        if (wm > policy.overtimeStartsAfterDailyHours * 60) {
          da.ot += wm - policy.overtimeStartsAfterDailyHours * 60;
        }
      }

      if (!empAgg.has(uid)) empAgg.set(uid, { worked: 0, ot: 0, idle: 0 });
      const ea = empAgg.get(uid)!;
      ea.worked += wm;
      if (wm > policy.overtimeStartsAfterDailyHours * 60) {
        ea.ot += wm - policy.overtimeStartsAfterDailyHours * 60;
      }
    }

    const dailyData = Array.from(dailyAgg.entries()).map(([date, v]) => ({
      date,
      workedHours: Math.round((v.worked / 60) * 10) / 10,
      overtimeHours: Math.round((v.ot / 60) * 10) / 10,
      breakHours: Math.round((v.breakMin / 60) * 10) / 10,
      activeEmployees: v.count,
    }));

    const empArray = Array.from(empAgg.entries()).map(([uid, v]) => ({
      userId: uid,
      workedHours: Math.round((v.worked / 60) * 10) / 10,
      overtimeHours: Math.round((v.ot / 60) * 10) / 10,
    }));

    const topProductive = [...empArray].sort((a, b) => b.workedHours - a.workedHours).slice(0, 10);
    const topOvertime = [...empArray].sort((a, b) => b.overtimeHours - a.overtimeHours).slice(0, 10);

    const users = await strapi.db.query(USER_UID).findMany({
      where: { id: { $in: empArray.map((e) => e.userId) } },
    });
    const userMap = new Map<number, string>();
    for (const u of users) userMap.set(u.id, u.fullName);

    return ctx.send({
      dailyData,
      topProductive: topProductive.map((e) => ({ ...e, name: userMap.get(e.userId) || 'Unknown' })),
      topOvertime: topOvertime.map((e) => ({ ...e, name: userMap.get(e.userId) || 'Unknown' })),
    });
  },

  async exportCsv(ctx: Context) {
    const roleName = ctx.state.user?.role?.name;
    if (roleName !== 'HR' && roleName !== 'Admin') return ctx.forbidden('HR or Admin role required');

    const { startDate, endDate, search, status, attendance, teamId } = ctx.query as Record<string, string>;

    const fakeCtx = {
      ...ctx,
      query: { startDate, endDate, search, status, attendance, teamId, page: '1', pageSize: '10000', sortBy: 'fullName', sortDir: 'asc' },
      state: ctx.state,
      send: (data: any) => data,
    } as any;

    const result = await (this as any).employees(fakeCtx);

    const rows: string[] = ['Employee,Email,Team,Worked Hours,Expected Hours,Missing Hours,Overtime,Break Hours,Attendance %,Status,Evaluation'];
    for (const emp of result.employees) {
      rows.push([
        `"${emp.fullName}"`,
        emp.email,
        emp.team?.name || '',
        emp.workedHours,
        emp.expectedHours,
        emp.missingHours,
        emp.overtimeHours,
        emp.breakHours,
        emp.attendancePct,
        emp.currentStatus,
        emp.evaluation,
      ].join(','));
    }

    ctx.set('Content-Type', 'text/csv');
    ctx.set('Content-Disposition', `attachment; filename="hr-analytics-${new Date().toISOString().split('T')[0]}.csv"`);
    return ctx.send(rows.join('\n'));
  },
};

const TimeCalcService = {
  countWorkingDays(start: Date, end: Date): number {
    let count = 0;
    const d = new Date(start);
    d.setHours(0, 0, 0, 0);
    while (d <= end) {
      if (WorkPolicyService.isWorkingDay(d)) count++;
      d.setDate(d.getDate() + 1);
    }
    return count;
  },
};
