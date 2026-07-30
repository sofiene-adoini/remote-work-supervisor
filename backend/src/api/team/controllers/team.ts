import type { Context } from 'koa';
const TEAM_UID = 'api::team.team';
const SESSION_UID = 'api::session.session';
const USER_UID = 'plugin::users-permissions.user';

export default {
  async listAll(ctx: Context) {
    const teams = await strapi.db.query(TEAM_UID).findMany({
      orderBy: { name: 'asc' },
      populate: ['users', 'leader', 'projects'],
    });

    const result = teams.map((team: any) => ({
      id: team.id,
      name: team.name,
      description: team.description ?? null,
      leader: team.leader
        ? { id: team.leader.id, fullName: team.leader.fullName, email: team.leader.email }
        : null,
      memberCount: team.users?.length ?? 0,
      activeMemberCount: 0,
      projectCount: team.projects?.length ?? 0,
      createdAt: team.createdAt ?? null,
    }));

    return ctx.send({ teams: result });
  },

  async find(ctx: Context) {
    const { teamId } = ctx.params;
    if (!teamId) return ctx.badRequest('teamId is required');

    const team = await strapi.db.query(TEAM_UID).findOne({
      where: { id: parseInt(teamId, 10) },
      populate: ['users', 'leader', 'projects'],
    });
    if (!team) return ctx.notFound('Team not found');

    const userIds = (team.users ?? []).map((u: any) => u.id);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let members: any[] = [];
    if (userIds.length > 0) {
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
        if (uid) latestByUser.set(uid, s);
      }

      members = team.users.map((user: any) => {
        const session = latestByUser.get(user.id);
        let status: string = 'clocked_out';
        let hoursToday = 0;

        if (session) {
          status = session.status === 'completed' ? 'clocked_out' : session.status;
          const start = new Date(session.clockIn).getTime();
          const end = session.clockOut ? new Date(session.clockOut).getTime() : Date.now();
          const breakMin = session.totalBreakMinutes || 0;
          hoursToday = Math.max(0, ((end - start) / 60000) - (breakMin / 60));
        }

        return {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          status,
          hoursToday: Math.round(hoursToday * 10) / 10,
          isLeader: team.leader?.id === user.id,
        };
      });
    }

    return ctx.send({
      team: {
        id: team.id,
        name: team.name,
        description: team.description ?? null,
        leader: team.leader
          ? { id: team.leader.id, fullName: team.leader.fullName, email: team.leader.email }
          : null,
        memberCount: team.users?.length ?? 0,
        projectCount: team.projects?.length ?? 0,
        projects: (team.projects ?? []).map((p: any) => ({
          id: p.id,
          name: p.name,
        })),
        members,
        createdAt: team.createdAt ?? null,
      },
    });
  },

  async members(ctx: Context) {
    const { teamId } = ctx.params;
    if (!teamId) return ctx.badRequest('teamId is required');

    const team = await strapi.db.query(TEAM_UID).findOne({
      where: { id: parseInt(teamId, 10) },
      populate: ['users', 'leader'],
    });
    if (!team) return ctx.notFound('Team not found');

    const userIds = (team.users ?? []).map((u: any) => u.id);
    if (userIds.length === 0) return ctx.send({ members: [] });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

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
      if (uid) latestByUser.set(uid, s);
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
        hoursToday = Math.max(0, ((end - start) / 60000) - (breakMin / 60));
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

  async unassignedEmployees(ctx: Context) {
    const employees = await strapi.db.query(USER_UID).findMany({
      where: {
        role: { name: 'Employee' },
        team: { id: null },
      },
      populate: ['role'],
      orderBy: { fullName: 'asc' },
    });

    return ctx.send({
      employees: employees.map((e: any) => ({
        id: e.id,
        fullName: e.fullName,
        email: e.email,
        roleName: e.role?.name ?? 'Employee',
      })),
    });
  },

  async create(ctx: Context) {
    const { name, description, memberIds } = ctx.request.body as {
      name?: string;
      description?: string;
      memberIds?: number[];
    };

    if (!name?.trim()) {
      return ctx.badRequest('Team name is required');
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
      data: { name: name.trim(), description: description?.trim() || null },
    });

    for (const mid of validMemberIds) {
      await strapi.db.query(USER_UID).update({
        where: { id: mid },
        data: { team: team.id },
      });
    }

    const updated = await strapi.db.query(TEAM_UID).findOne({
      where: { id: team.id },
      populate: ['users'],
    });

    return ctx.send({ team: updated });
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
        if (user.team) return ctx.badRequest(`User ${mid} is already assigned to a team`);
        await strapi.db.query(USER_UID).update({
          where: { id: mid },
          data: { team: team.id },
        });
      }
    }

    const updated = await strapi.db.query(TEAM_UID).findOne({
      where: { id: team.id },
      populate: ['users'],
    });
    return ctx.send({ team: updated });
  },

  async allMembers(ctx: Context) {
    const users = await strapi.db.query(USER_UID).findMany({
      where: {
        role: { name: 'Employee' },
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
      if (uid) {
        if (!sessionsByUser.has(uid)) sessionsByUser.set(uid, []);
        sessionsByUser.get(uid)!.push(s);
      }
    }

    const result = users.map((user: any) => {
      const userSessions = sessionsByUser.get(user.id) || [];
      let status: string = 'idle';
      let hoursToday = 0;

      if (userSessions.length > 0) {
        const latest = userSessions[0];
        status = latest.status === 'completed' ? 'clocked_out' : latest.status;

        for (const s of userSessions) {
          const start = new Date(s.clockIn).getTime();
          const end = s.clockOut ? new Date(s.clockOut).getTime() : Date.now();
          const breakMin = s.totalBreakMinutes || 0;
          const workedMin = Math.max(0, (end - start) / 60000 - breakMin);
          hoursToday += workedMin;
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

    return ctx.send({ members: result });
  },

  async delete(ctx: Context) {
    const { id } = ctx.params;
    if (!id) return ctx.badRequest('Team ID is required');

    const team = await strapi.db.query(TEAM_UID).findOne({
      where: { id: parseInt(id, 10) },
      populate: ['users'],
    });
    if (!team) return ctx.notFound('Team not found');

    const memberIds = (team.users ?? []).map((u: any) => u.id);
    for (const uid of memberIds) {
      await strapi.db.query(USER_UID).update({
        where: { id: uid },
        data: { team: null },
      });
    }

    if (team.leader) {
      await strapi.db.query(TEAM_UID).update({
        where: { id: team.id },
        data: { leader: null },
      });
    }

    await strapi.db.query(TEAM_UID).delete({
      where: { id: team.id },
    });

    return ctx.send({ ok: true });
  },

  async assignLeader(ctx: Context) {
    const { id } = ctx.params;
    const { userId } = ctx.request.body as { userId?: number | null };

    if (!id) return ctx.badRequest('Team ID is required');

    const team = await strapi.db.query(TEAM_UID).findOne({
      where: { id: parseInt(id, 10) },
      populate: ['leader'],
    });
    if (!team) return ctx.notFound('Team not found');

    if (userId === null || userId === undefined) {
      await strapi.db.query(TEAM_UID).update({
        where: { id: team.id },
        data: { leader: null },
      });
      return ctx.send({ leader: null });
    }

    const user = await strapi.db.query(USER_UID).findOne({
      where: { id: userId },
    });
    if (!user) return ctx.badRequest('User not found');

    await strapi.db.query(TEAM_UID).update({
      where: { id: team.id },
      data: { leader: userId },
    });

    const leader = { id: user.id, fullName: user.fullName, email: user.email };
    return ctx.send({ leader });
  },
};
