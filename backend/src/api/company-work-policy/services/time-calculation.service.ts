import { WorkPolicyService, CompanyWorkPolicy } from '../../company-work-policy/services/work-policy.service';

const SESSION_UID = 'api::session.session';
const OT_UID = 'api::overtime-declaration.overtime-declaration';

export type AttendanceStatus = 'completed' | 'underworked' | 'overtime' | 'absent' | 'day_off';
export type AttendanceEvaluation = 'excellent' | 'good' | 'acceptable' | 'underworked' | 'absent' | 'holiday' | 'weekend' | 'break_violation' | 'overtime';

export interface DailyStats {
  workedMinutes: number;
  productiveMinutes: number;
  idleMinutes: number;
  breakMinutes: number;
  overtimeMinutes: number;
  expectedMinutes: number;
  missingMinutes: number;
  extraMinutes: number;
  attendanceStatus: AttendanceStatus;
}

export interface WeeklyStats {
  expectedHours: number;
  workedHours: number;
  overtimeHours: number;
  missingHours: number;
  productiveHours: number;
  idleHours: number;
  breakHours: number;
  attendanceRate: number;
  completionRate: number;
}

export interface MonthlyStats {
  expectedHours: number;
  workedHours: number;
  overtimeHours: number;
  missingHours: number;
  averageDailyHours: number;
  attendancePercentage: number;
  productivePercentage: number;
}

export interface EnrichedSession {
  id: number;
  clockIn: string;
  clockOut: string | null;
  status: string;
  totalBreakMinutes: number;
  workedMinutes: number;
}

export interface SessionUpdatePayload {
  userId: number;
  status: 'clocked_out' | 'active' | 'break';
  sessionId: number | null;
  clockIn: string | null;
  clockOut: string | null;
  breakStartedAt: string | null;
  totalBreakMinutes: number;
  workedTodayMinutes: number;
  weeklyMinutes: number;
  currentProject: { id: number; name: string } | null;
  agentOnline: boolean;
  dailyStats: DailyStats;
  weeklyStats: WeeklyStats;
}

function minutesBetween(start: string | Date, end: string | Date): number {
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
}

function computeWorkedMinutes(session: { clockIn: string; clockOut: string | null; totalBreakMinutes: number; status: string }, now: Date): number {
  const start = new Date(session.clockIn).getTime();
  const end = session.clockOut ? new Date(session.clockOut).getTime() : now.getTime();
  const elapsedMinutes = Math.max(0, Math.round((end - start) / 60000));
  return Math.max(0, elapsedMinutes - (session.totalBreakMinutes || 0));
}

function computeActiveWorkedMinutes(session: { clockIn: string; totalBreakMinutes: number; breakStart?: string | null }, now: Date): number {
  const start = new Date(session.clockIn).getTime();
  const accumulatedBreakMs = (session.totalBreakMinutes || 0) * 60000;
  const currentBreakMs = session.breakStart ? now.getTime() - new Date(session.breakStart).getTime() : 0;
  return Math.max(0, Math.round((now.getTime() - start - accumulatedBreakMs - currentBreakMs) / 60000));
}

export const TimeCalculationService = {
  async computeDailyStats(userId: number, date: Date): Promise<DailyStats> {
    const policy = await WorkPolicyService.get();
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const sessions = await strapi.db.query(SESSION_UID).findMany({
      where: {
        user: userId,
        clockIn: { $gte: dayStart.toISOString(), $lt: dayEnd.toISOString() },
      },
      orderBy: { clockIn: 'asc' },
    });

    if (sessions.length === 0 && WorkPolicyService.isWorkingDay(date)) {
      return {
        workedMinutes: 0, productiveMinutes: 0, idleMinutes: 0, breakMinutes: 0,
        overtimeMinutes: 0, expectedMinutes: policy.expectedDailyHours * 60,
        missingMinutes: policy.expectedDailyHours * 60, extraMinutes: 0,
        attendanceStatus: 'absent',
      };
    }

    if (sessions.length === 0 && !WorkPolicyService.isWorkingDay(date)) {
      return {
        workedMinutes: 0, productiveMinutes: 0, idleMinutes: 0, breakMinutes: 0,
        overtimeMinutes: 0, expectedMinutes: 0, missingMinutes: 0, extraMinutes: 0,
        attendanceStatus: 'day_off',
      };
    }

    let totalWorked = 0;
    let totalBreak = 0;
    for (const s of sessions) {
      totalWorked += computeWorkedMinutes(s, new Date());
      totalBreak += s.totalBreakMinutes || 0;
    }

    const expectedMinutes = policy.expectedDailyHours * 60;
    const overtimeMinutes = policy.autoOvertimeEnabled && totalWorked > policy.overtimeStartsAfterDailyHours * 60
      ? totalWorked - policy.overtimeStartsAfterDailyHours * 60
      : (policy.autoOvertimeEnabled ? Math.max(0, totalWorked - expectedMinutes) : 0);
    const missingMinutes = Math.max(0, expectedMinutes - totalWorked);
    const extraMinutes = Math.max(0, totalWorked - policy.maximumDailyHours * 60);

    let attendanceStatus: AttendanceStatus;
    if (totalWorked >= expectedMinutes) {
      attendanceStatus = overtimeMinutes > 0 ? 'overtime' : 'completed';
    } else if (totalWorked > 0) {
      attendanceStatus = 'underworked';
    } else {
      attendanceStatus = WorkPolicyService.isWorkingDay(date) ? 'absent' : 'day_off';
    }

    return {
      workedMinutes: totalWorked,
      productiveMinutes: totalWorked,
      idleMinutes: 0,
      breakMinutes: totalBreak,
      overtimeMinutes,
      expectedMinutes,
      missingMinutes,
      extraMinutes,
      attendanceStatus,
    };
  },

  async computeWeeklyStats(userId: number, weekStart: Date): Promise<WeeklyStats> {
    const policy = await WorkPolicyService.get();
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const sessions = await strapi.db.query(SESSION_UID).findMany({
      where: {
        user: userId,
        clockIn: { $gte: weekStart.toISOString(), $lt: weekEnd.toISOString() },
      },
    });

    let workedMinutes = 0;
    let breakMinutes = 0;
    for (const s of sessions) {
      const end = s.clockOut ? new Date(s.clockOut).getTime() : Date.now();
      const start = new Date(s.clockIn).getTime();
      workedMinutes += Math.max(0, Math.round((end - start) / 60000) - (s.totalBreakMinutes || 0));
      breakMinutes += s.totalBreakMinutes || 0;
    }

    const workingDaysThisWeek = this.countWorkingDaysInRange(weekStart, weekEnd);
    const expectedMinutes = workingDaysThisWeek * policy.expectedDailyHours * 60;
    const overtimeMinutes = Math.max(0, workedMinutes - policy.overtimeStartsAfterDailyHours * 60 * workingDaysThisWeek);
    const missingMinutes = Math.max(0, expectedMinutes - workedMinutes);

    const attendanceRate = expectedMinutes > 0 ? Math.min(100, Math.round((workedMinutes / expectedMinutes) * 100)) : 0;
    const completionRate = expectedMinutes > 0 ? Math.min(100, Math.round((Math.min(workedMinutes, expectedMinutes) / expectedMinutes) * 100)) : 0;

    return {
      expectedHours: Math.round((expectedMinutes / 60) * 10) / 10,
      workedHours: Math.round((workedMinutes / 60) * 10) / 10,
      overtimeHours: Math.round((overtimeMinutes / 60) * 10) / 10,
      missingHours: Math.round((missingMinutes / 60) * 10) / 10,
      productiveHours: Math.round((workedMinutes / 60) * 10) / 10,
      idleHours: 0,
      breakHours: Math.round((breakMinutes / 60) * 10) / 10,
      attendanceRate,
      completionRate,
    };
  },

  async computeMonthlyStats(userId: number, year: number, month: number): Promise<MonthlyStats> {
    const policy = await WorkPolicyService.get();
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0, 23, 59, 59);

    const sessions = await strapi.db.query(SESSION_UID).findMany({
      where: {
        user: userId,
        clockIn: { $gte: monthStart.toISOString(), $lte: monthEnd.toISOString() },
      },
    });

    let workedMinutes = 0;
    for (const s of sessions) {
      const end = s.clockOut ? new Date(s.clockOut).getTime() : monthEnd.getTime();
      const start = new Date(s.clockIn).getTime();
      workedMinutes += Math.max(0, Math.round((end - start) / 60000) - (s.totalBreakMinutes || 0));
    }

    const workingDaysThisMonth = this.countWorkingDaysInRange(monthStart, monthEnd);
    const expectedMinutes = workingDaysThisMonth * policy.expectedDailyHours * 60;
    const overtimeMinutes = Math.max(0, workedMinutes - policy.overtimeStartsAfterDailyHours * 60 * workingDaysThisMonth);
    const missingMinutes = Math.max(0, expectedMinutes - workedMinutes);

    const daysWithSessions = new Set(sessions.map((s) => new Date(s.clockIn).toDateString())).size;
    const averageDailyHours = daysWithSessions > 0 ? Math.round((workedMinutes / daysWithSessions / 60) * 10) / 10 : 0;
    const attendancePercentage = expectedMinutes > 0 ? Math.min(100, Math.round((workedMinutes / expectedMinutes) * 100)) : 0;

    return {
      expectedHours: Math.round((expectedMinutes / 60) * 10) / 10,
      workedHours: Math.round((workedMinutes / 60) * 10) / 10,
      overtimeHours: Math.round((overtimeMinutes / 60) * 10) / 10,
      missingHours: Math.round((missingMinutes / 60) * 10) / 10,
      averageDailyHours,
      attendancePercentage,
      productivePercentage: attendancePercentage,
    };
  },

  async getUserSessionsForDate(userId: number, date: Date): Promise<EnrichedSession[]> {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const sessions = await strapi.db.query(SESSION_UID).findMany({
      where: {
        user: userId,
        clockIn: { $gte: dayStart.toISOString(), $lt: dayEnd.toISOString() },
      },
      orderBy: { clockIn: 'asc' },
    });

    return sessions.map((s) => ({
      id: s.id,
      clockIn: s.clockIn,
      clockOut: s.clockOut,
      status: s.status,
      totalBreakMinutes: s.totalBreakMinutes || 0,
      workedMinutes: computeWorkedMinutes(s, new Date()),
    }));
  },

  async getUserSessionsForRange(userId: number, start: Date, end: Date): Promise<EnrichedSession[]> {
    const sessions = await strapi.db.query(SESSION_UID).findMany({
      where: {
        user: userId,
        clockIn: { $gte: start.toISOString(), $lt: end.toISOString() },
      },
      orderBy: { clockIn: 'asc' },
    });

    return sessions.map((s) => ({
      id: s.id,
      clockIn: s.clockIn,
      clockOut: s.clockOut,
      status: s.status,
      totalBreakMinutes: s.totalBreakMinutes || 0,
      workedMinutes: computeWorkedMinutes(s, new Date()),
    }));
  },

  computeWorkedMinutes,

  computeActiveWorkedMinutes,

  countWorkingDaysInRange(start: Date, end: Date): number {
    let count = 0;
    const d = new Date(start);
    d.setHours(0, 0, 0, 0);
    while (d < end) {
      if (WorkPolicyService.isWorkingDay(d)) count++;
      d.setDate(d.getDate() + 1);
    }
    return count;
  },
};
