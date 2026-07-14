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
