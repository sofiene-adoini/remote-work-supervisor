import type { Context } from 'koa';
const SESSION_UID = 'api::session.session';
const ALERT_UID = 'api::alert.alert';
const OT_UID = 'api::overtime-declaration.overtime-declaration';
const USER_UID = 'plugin::users-permissions.user';

export default {
  async dashboard(ctx: Context) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Total employees (role = Employee)
    const totalEmployees = await strapi.db.query(USER_UID).count({
      where: { role: { name: 'Employee' } },
    });

    // Today's sessions — get all sessions started today
    const todaySessions = await strapi.db.query(SESSION_UID).findMany({
      where: { clockIn: { $gte: today.toISOString() } },
      orderBy: { clockIn: 'desc' },
    });

    // Get the latest session per user to determine current status
    const latestByUser = new Map<number, any>();
    for (const s of todaySessions) {
      const uid = typeof s.user === 'object' ? s.user.id : s.user;
      if (!latestByUser.has(uid)) latestByUser.set(uid, s);
    }

    let activeNow = 0;
    let onBreak = 0;
    let clockedOut = 0;

    for (const session of latestByUser.values()) {
      if (session.status === 'active') activeNow++;
      else if (session.status === 'break') onBreak++;
      else if (session.status === 'completed') clockedOut++;
    }

    // Employees who have no session at all today → idle/flagged
    const employeesWithSession = latestByUser.size;
    const idleFlagged = totalEmployees - employeesWithSession;

    // Total hours worked today across all sessions
    let totalHoursToday = 0;
    for (const session of todaySessions) {
      if (session.clockIn) {
        const start = new Date(session.clockIn).getTime();
        const end = session.clockOut ? new Date(session.clockOut).getTime() : today.getTime();
        const minutes = (end - start) / 60000;
        const breakMin = session.totalBreakMinutes || 0;
        totalHoursToday += Math.max(0, (minutes - breakMin) / 60);
      }
    }

    // Pending overtime declarations
    const pendingOvertime = await strapi.db.query(OT_UID).count({
      where: { status: 'pending' },
    });

    // Unread alerts across all users
    const unreadAlerts = await strapi.db.query(ALERT_UID).count({
      where: { read: false },
    });

    return ctx.send({
      totalEmployees,
      activeNow,
      onBreak,
      clockedOut: Math.max(0, clockedOut),
      idleFlagged: Math.max(0, idleFlagged),
      totalHoursToday: Math.round(totalHoursToday * 10) / 10,
      pendingOvertime,
      unreadAlerts,
    });
  },
};
