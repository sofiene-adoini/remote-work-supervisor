import type { Context } from 'koa';
import { TimeCalculationService } from '../../company-work-policy/services/time-calculation.service';
import { AttendanceEvaluator } from '../../company-work-policy/services/attendance-evaluator.service';
import { WorkPolicyService } from '../../company-work-policy/services/work-policy.service';

const USER_UID = 'plugin::users-permissions.user';
const SESSION_UID = 'api::session.session';

export default {
  async employeeStats(ctx: Context) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized('Authentication required');

    const { userId: targetUserId } = ctx.query as { userId?: string };
    const targetId = targetUserId ? parseInt(targetUserId, 10) : userId;

    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dayOfWeek = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
    monday.setHours(0, 0, 0, 0);

    const [dailyStats, weeklyStats, monthlyStats] = await Promise.all([
      TimeCalculationService.computeDailyStats(targetId, now),
      TimeCalculationService.computeWeeklyStats(targetId, monday),
      TimeCalculationService.computeMonthlyStats(targetId, now.getFullYear(), now.getMonth() + 1),
    ]);

    const attendanceEvaluation = await AttendanceEvaluator.evaluate(targetId, now, dailyStats);

    const activeSession = await strapi.db.query(SESSION_UID).findOne({
      where: {
        user: targetId,
        clockIn: { $gte: today.toISOString() },
        status: { $in: ['active', 'break'] },
      },
      orderBy: { clockIn: 'desc' },
    });

    let sessionDurationMinutes = 0;
    if (activeSession) {
      const start = new Date(activeSession.clockIn).getTime();
      sessionDurationMinutes = Math.round((now.getTime() - start) / 60000);
    }

    return ctx.send({
      dailyStats,
      weeklyStats,
      monthlyStats,
      attendanceEvaluation,
      currentSession: activeSession ? {
        sessionId: activeSession.id,
        status: activeSession.status,
        clockIn: activeSession.clockIn,
        durationMinutes: sessionDurationMinutes,
      } : null,
    });
  },

  async allEmployeeStats(ctx: Context) {
    const roleName = ctx.state.user?.role?.name;
    if (roleName !== 'HR' && roleName !== 'Admin') {
      return ctx.forbidden('HR or Admin role required');
    }

    const employees = await strapi.db.query(USER_UID).findMany({
      where: { role: { name: 'Employee' } },
      populate: ['role'],
    });

    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dayOfWeek = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
    monday.setHours(0, 0, 0, 0);

    const results = await Promise.all(employees.map(async (emp) => {
      const [dailyStats, weeklyStats] = await Promise.all([
        TimeCalculationService.computeDailyStats(emp.id, now),
        TimeCalculationService.computeWeeklyStats(emp.id, monday),
      ]);

      const attendanceEvaluation = await AttendanceEvaluator.evaluate(emp.id, now, dailyStats);

      const activeSession = await strapi.db.query(SESSION_UID).findOne({
        where: {
          user: emp.id,
          clockIn: { $gte: today.toISOString() },
          status: { $in: ['active', 'break'] },
        },
        orderBy: { clockIn: 'desc' },
      });

      let sessionDurationMinutes = 0;
      if (activeSession) {
        const start = new Date(activeSession.clockIn).getTime();
        sessionDurationMinutes = Math.round((now.getTime() - start) / 60000);
      }

      const policy = await WorkPolicyService.get();

      return {
        userId: emp.id,
        fullName: emp.fullName,
        email: emp.email,
        dailyStats,
        weeklyStats,
        attendanceEvaluation,
        currentSession: activeSession ? {
          status: activeSession.status,
          clockIn: activeSession.clockIn,
          durationMinutes: sessionDurationMinutes,
        } : null,
      };
    }));

    return ctx.send({ employees: results });
  },

  async policy(ctx: Context) {
    const policy = await WorkPolicyService.get();
    return ctx.send({ policy });
  },
};
