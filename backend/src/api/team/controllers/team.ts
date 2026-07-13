import type { Context } from 'koa';
const TEAM_UID = 'api::team.team';
const SESSION_UID = 'api::session.session';
const USER_UID = 'plugin::users-permissions.user';

export default {
  async listAll(ctx: Context) {
    const teams = await strapi.db.query(TEAM_UID).findMany({
      orderBy: { name: 'asc' },
      populate: ['users'],
    });

    const result = teams.map((team) => ({
      id: team.id,
      name: team.name,
      memberCount: team.users?.length ?? 0,
    }));

    return ctx.send({ teams: result });
  },

  async members(ctx: Context) {
    const { teamId } = ctx.params;

    const team = await strapi.db.query(TEAM_UID).findOne({
      where: { id: parseInt(teamId, 10) },
      populate: ['users'],
    });

    if (!team) return ctx.notFound('Team not found');

    const userIds = (team.users ?? []).map((u: any) => u.id);
    if (userIds.length === 0) return ctx.send({ members: [] });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get all today's sessions for these users
    const sessions = await strapi.db.query(SESSION_UID).findMany({
      where: {
        user: { id: { $in: userIds } },
        clockIn: { $gte: today.toISOString() },
      },
      orderBy: { clockIn: 'desc' },
    });

    const latestByUser = new Map<number, any>();
    for (const s of sessions) {
      const uid = typeof s.user === 'object' ? s.user.id : s.user;
      if (!latestByUser.has(uid)) latestByUser.set(uid, s);
    }

    const members = team.users.map((user: any) => {
      const session = latestByUser.get(user.id);
      let status: string = 'clocked_out';
      let hoursToday = 0;

      if (session) {
        status = session.status === 'completed' ? 'clocked_out' : session.status;
        const start = new Date(session.clockIn).getTime();
        const end = session.clockOut ? new Date(session.clockOut).getTime() : Date.now();
        const breakMin = session.totalBreakMinutes || 0;
        hoursToday = Math.max(0, ((end - start) / 60000 - breakMin) / 60);
      }

      return {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        status,
        hoursToday: Math.round(hoursToday * 10) / 10,
      };
    });

    return ctx.send({ members });
  },

  async allMembers(ctx: Context) {
    const users = await strapi.db.query(USER_UID).findMany({
      where: { role: { name: 'Employee' } },
      orderBy: { fullName: 'asc' },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const userIds = users.map((u) => u.id);

    const sessions = userIds.length > 0
      ? await strapi.db.query(SESSION_UID).findMany({
          where: {
            user: { id: { $in: userIds } },
            clockIn: { $gte: today.toISOString() },
          },
          orderBy: { clockIn: 'desc' },
        })
      : [];

    const latestByUser = new Map<number, any>();
    for (const s of sessions) {
      const uid = typeof s.user === 'object' ? s.user.id : s.user;
      if (!latestByUser.has(uid)) latestByUser.set(uid, s);
    }

    const result = users.map((user) => {
      const session = latestByUser.get(user.id);
      let status: string = 'clocked_out';
      let hoursToday = 0;

      if (session) {
        status = session.status === 'completed' ? 'clocked_out' : session.status;
        const start = new Date(session.clockIn).getTime();
        const end = session.clockOut ? new Date(session.clockOut).getTime() : Date.now();
        const breakMin = session.totalBreakMinutes || 0;
        hoursToday = Math.max(0, ((end - start) / 60000 - breakMin) / 60);
      }

      return {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        status,
        hoursToday: Math.round(hoursToday * 10) / 10,
        team: (user as any).team ?? null,
      };
    });

    return ctx.send({ members: result });
  },
};
