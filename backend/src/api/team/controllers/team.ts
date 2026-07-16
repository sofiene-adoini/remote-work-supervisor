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
      populate: ['user'],
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

  async availableManagers(ctx: Context) {
    const managers = await strapi.db.query(USER_UID).findMany({
      where: {
        role: { name: 'Manager' },
        managedTeam: { id: null },
      },
      populate: ['role'],
      orderBy: { fullName: 'asc' },
    });
    return ctx.send({ managers: managers.map((m) => ({ id: m.id, fullName: m.fullName, email: m.email })) });
  },

  async unassignedEmployees(ctx: Context) {
    const employees = await strapi.db.query(USER_UID).findMany({
      where: {
        $or: [
          { role: { name: 'Employee' } },
          { role: { name: 'Manager' } },
        ],
        team: { id: null },
      },
      populate: ['role'],
      orderBy: { fullName: 'asc' },
    });
    return ctx.send({
      employees: employees.map((e) => ({
        id: e.id,
        fullName: e.fullName,
        email: e.email,
        roleName: e.role?.name ?? 'Employee',
      })),
    });
  },

  async create(ctx: Context) {
    const { name, managerId, memberIds } = ctx.request.body as {
      name?: string;
      managerId?: number;
      memberIds?: number[];
    };

    if (!name?.trim()) {
      return ctx.badRequest('Team name is required');
    }

    if (managerId) {
      const manager = await strapi.db.query(USER_UID).findOne({
        where: { id: managerId },
        populate: ['role', 'managedTeam'],
      });
      if (!manager) return ctx.badRequest('Manager not found');
      if (manager.role?.name !== 'Manager' && manager.role?.name !== 'Admin') {
        return ctx.badRequest('User must have a Manager or Admin role');
      }
      if (manager.managedTeam) {
        return ctx.badRequest('This manager is already assigned to a team');
      }
    }

    const validMemberIds: number[] = [];
    if (memberIds?.length) {
      for (const mid of memberIds) {
        const user = await strapi.db.query(USER_UID).findOne({
          where: { id: mid },
          populate: ['team'],
        });
        if (!user) return ctx.badRequest(`User ${mid} not found`);
        if (user.team) return ctx.badRequest(`User ${mid} is already assigned to a team`);
        validMemberIds.push(mid);
      }
    }

    const team = await strapi.db.query(TEAM_UID).create({
      data: { name: name.trim() },
    });

    if (managerId) {
      await strapi.db.query(TEAM_UID).update({
        where: { id: team.id },
        data: { manager: managerId },
      });
    }

    for (const mid of validMemberIds) {
      await strapi.db.query(USER_UID).update({
        where: { id: mid },
        data: { team: team.id },
      });
    }

    const result = await strapi.db.query(TEAM_UID).findOne({
      where: { id: team.id },
      populate: ['manager', 'users'],
    });

    return ctx.send({ team: result });
  },

  async updateMembers(ctx: Context) {
    const { id } = ctx.params;
    const { addMemberIds, removeMemberIds } = ctx.request.body as {
      addMemberIds?: number[];
      removeMemberIds?: number[];
    };

    const team = await strapi.db.query(TEAM_UID).findOne({
      where: { id: parseInt(id, 10) },
      populate: ['users'],
    });
    if (!team) return ctx.notFound('Team not found');

    if (removeMemberIds?.length) {
      for (const mid of removeMemberIds) {
        const user = await strapi.db.query(USER_UID).findOne({
          where: { id: mid },
          populate: ['team'],
        });
        if (user?.team?.id === team.id) {
          await strapi.db.query(USER_UID).update({
            where: { id: mid },
            data: { team: null },
          });
        }
      }
    }

    if (addMemberIds?.length) {
      for (const mid of addMemberIds) {
        const user = await strapi.db.query(USER_UID).findOne({
          where: { id: mid },
          populate: ['team'],
        });
        if (!user) continue;
        if (user.team) {
          return ctx.badRequest(`User ${mid} is already assigned to a team`);
        }
        await strapi.db.query(USER_UID).update({
          where: { id: mid },
          data: { team: team.id },
        });
      }
    }

    const updated = await strapi.db.query(TEAM_UID).findOne({
      where: { id: team.id },
      populate: ['manager', 'users'],
    });

    return ctx.send({ team: updated });
  },

  async updateManager(ctx: Context) {
    const { id } = ctx.params;
    const { managerId } = ctx.request.body as { managerId?: number | null };

    const team = await strapi.db.query(TEAM_UID).findOne({
      where: { id: parseInt(id, 10) },
      populate: ['manager'],
    });
    if (!team) return ctx.notFound('Team not found');

    if (managerId) {
      const manager = await strapi.db.query(USER_UID).findOne({
        where: { id: managerId },
        populate: ['role', 'managedTeam'],
      });
      if (!manager) return ctx.badRequest('Manager not found');
      if (manager.role?.name !== 'Manager' && manager.role?.name !== 'Admin') {
        return ctx.badRequest('User must have a Manager or Admin role');
      }
      if (manager.managedTeam && manager.managedTeam.id !== team.id) {
        return ctx.badRequest('This manager is already assigned to another team');
      }
    }

    await strapi.db.query(TEAM_UID).update({
      where: { id: team.id },
      data: { manager: managerId || null },
    });

    const updated = await strapi.db.query(TEAM_UID).findOne({
      where: { id: team.id },
      populate: ['manager', 'users'],
    });

    return ctx.send({ team: updated });
  },

async allMembers(ctx: Context) {
  const users = await strapi.db.query(USER_UID).findMany({
    where: {
      $or: [
        { role: { name: 'Employee' } },
        { role: { name: 'Manager' } },
      ],
    },
    populate: ['role'],
    orderBy: { fullName: 'asc' },
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const allTodaySessions = await strapi.db.query(SESSION_UID).findMany({
    where: {
      clockIn: { $gte: today.toISOString() },
    },
    populate: ['user'],
    orderBy: { clockIn: 'desc' },
  });

    const sessionsByUser = new Map<number, any[]>();
    for (const s of allTodaySessions) {
      const uid = typeof s.user === 'object' ? s.user?.id : s.user;
      if (!uid) continue;
      if (!sessionsByUser.has(uid)) sessionsByUser.set(uid, []);
      sessionsByUser.get(uid)!.push(s);
    }

    const now = Date.now();

    const result = users.map((user: any) => {
      const userSessions = sessionsByUser.get(user.id) || [];
      let status: string = 'idle';
      let hoursToday = 0;

      if (userSessions.length > 0) {
        const latest = userSessions[0];
        status = latest.status === 'completed' ? 'clocked_out' : latest.status;

        for (const s of userSessions) {
          const start = new Date(s.clockIn).getTime();
          const end = s.clockOut ? new Date(s.clockOut).getTime() : now;
          const breakMin = s.totalBreakMinutes || 0;

          if (!s.clockOut && s.status === 'break' && s.breakStart) {
            const activeBreakMs = now - new Date(s.breakStart).getTime();
            const totalBreakMs = (breakMin * 60000) + activeBreakMs;
            hoursToday += Math.max(0, ((end - start) / 60000 - totalBreakMs / 60000) / 60);
          } else {
            hoursToday += Math.max(0, ((end - start) / 60000 - breakMin) / 60);
          }
        }
      }

      return {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        status,
        hoursToday: Math.round(hoursToday * 10) / 10,
      };
    });

    strapi.log.info(`[allMembers] users=${users.length} sessions=${allTodaySessions.length} sessionUserIds=[${Array.from(sessionsByUser.keys())}]`);

    return ctx.send({ members: result });
  },
};
