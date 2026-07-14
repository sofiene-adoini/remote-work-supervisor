import type { Context } from 'koa';
const PROJECT_UID = 'api::project.project';
const TIME_ENTRY_UID = 'api::time-entry.time-entry';
const TEAM_UID = 'api::team.team';
const USER_UID = 'plugin::users-permissions.user';

export default {
  async create(ctx: Context) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized('Authentication required');

    const { name, description, assignmentType, teamId, employeeIds } = ctx.request.body as {
      name?: string;
      description?: string;
      assignmentType?: 'team' | 'individual';
      teamId?: number;
      employeeIds?: number[];
    };

    if (!name?.trim()) return ctx.badRequest('Project name is required');
    if (assignmentType !== 'team' && assignmentType !== 'individual') {
      return ctx.badRequest('assignmentType must be "team" or "individual"');
    }

    let resolvedTeamId: number | null = null;
    let resolvedUserIds: number[] = [];

    if (assignmentType === 'team') {
      if (!teamId) return ctx.badRequest('teamId is required for team assignment');
      const team = await strapi.db.query(TEAM_UID).findOne({
        where: { id: teamId },
        populate: ['users'],
      });
      if (!team) return ctx.notFound('Team not found');
      resolvedTeamId = team.id;
      resolvedUserIds = (team.users ?? []).map((u: any) => u.id);
    } else {
      if (!employeeIds?.length) return ctx.badRequest('employeeIds is required for individual assignment');
      for (const eid of employeeIds) {
        const user = await strapi.db.query(USER_UID).findOne({ where: { id: eid } });
        if (!user) return ctx.badRequest(`User ${eid} not found`);
      }
      resolvedUserIds = employeeIds;
    }

    const project = await strapi.db.query(PROJECT_UID).create({
      data: {
        name: name.trim(),
        description: description || '',
        status: 'active',
        team: resolvedTeamId,
        users: resolvedUserIds,
      },
    });

    const result = await strapi.db.query(PROJECT_UID).findOne({
      where: { id: project.id },
      populate: ['team', 'users'],
    });

    return ctx.send({ project: result });
  },

  async reassign(ctx: Context) {
    const { id } = ctx.params;
    const { assignmentType, teamId, employeeIds } = ctx.request.body as {
      assignmentType?: 'team' | 'individual';
      teamId?: number;
      employeeIds?: number[];
    };

    const project = await strapi.db.query(PROJECT_UID).findOne({
      where: { id: parseInt(id, 10) },
    });
    if (!project) return ctx.notFound('Project not found');

    if (assignmentType !== 'team' && assignmentType !== 'individual') {
      return ctx.badRequest('assignmentType must be "team" or "individual"');
    }

    let resolvedTeamId: number | null = null;
    let resolvedUserIds: number[] = [];

    if (assignmentType === 'team') {
      if (!teamId) return ctx.badRequest('teamId is required for team assignment');
      const team = await strapi.db.query(TEAM_UID).findOne({
        where: { id: teamId },
        populate: ['users'],
      });
      if (!team) return ctx.notFound('Team not found');
      resolvedTeamId = team.id;
      resolvedUserIds = (team.users ?? []).map((u: any) => u.id);
    } else {
      if (!employeeIds?.length) return ctx.badRequest('employeeIds is required for individual assignment');
      for (const eid of employeeIds) {
        const user = await strapi.db.query(USER_UID).findOne({ where: { id: eid } });
        if (!user) return ctx.badRequest(`User ${eid} not found`);
      }
      resolvedUserIds = employeeIds;
    }

    await strapi.db.query(PROJECT_UID).update({
      where: { id: project.id },
      data: {
        team: resolvedTeamId,
        users: resolvedUserIds,
      },
    });

    const result = await strapi.db.query(PROJECT_UID).findOne({
      where: { id: project.id },
      populate: ['team', 'users'],
    });

    return ctx.send({ project: result });
  },

  async listAll(ctx: Context) {
    const projects = await strapi.db.query(PROJECT_UID).findMany({
      orderBy: { name: 'asc' },
      populate: ['team', 'users'],
    });

    const result = projects.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      status: p.status,
      team: p.team ? { id: p.team.id, name: p.team.name } : null,
      users: (p.users ?? []).map((u: any) => ({ id: u.id, fullName: u.fullName })),
      createdAt: p.createdAt,
    }));

    return ctx.send({ projects: result });
  },

  async myProjects(ctx: Context) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized('Authentication required');

    const projects = await strapi.db.query(PROJECT_UID).findMany({
      where: {
        users: { id: userId },
        status: 'active',
      },
      populate: ['users'],
    });

    const now = new Date();
    const dayOfWeek = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
    monday.setHours(0, 0, 0, 0);

    const result = await Promise.all(
      projects.map(async (project) => {
        const weekEntries = await strapi.db.query(TIME_ENTRY_UID).findMany({
          where: {
            project: project.id,
            user: userId,
            date: { $gte: monday.toISOString().split('T')[0] },
          },
        });

        const allEntries = await strapi.db.query(TIME_ENTRY_UID).findMany({
          where: {
            project: project.id,
            user: userId,
          },
        });

        const hoursThisWeek = weekEntries.reduce((sum, e) => sum + Number(e.hours), 0);
        const hoursTotal = allEntries.reduce((sum, e) => sum + Number(e.hours), 0);

        return {
          id: project.id,
          name: project.name,
          description: project.description,
          status: project.status,
          hoursThisWeek: Math.round(hoursThisWeek * 10) / 10,
          hoursTotal: Math.round(hoursTotal * 10) / 10,
          createdAt: project.createdAt,
        };
      })
    );

    return ctx.send({ projects: result });
  },

  async logTime(ctx: Context) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized('Authentication required');

    const { projectId, date, hours, description } = ctx.request.body as {
      projectId: number;
      date: string;
      hours: number;
      description?: string;
    };

    if (!projectId || !date || !hours) {
      return ctx.badRequest('projectId, date, and hours are required');
    }

    if (hours < 0.25 || hours > 24) {
      return ctx.badRequest('Hours must be between 0.25 and 24');
    }

    const project = await strapi.db.query(PROJECT_UID).findOne({
      where: { id: projectId },
    });

    if (!project) {
      return ctx.notFound('Project not found');
    }

    const entry = await strapi.db.query(TIME_ENTRY_UID).create({
      data: {
        date,
        hours,
        description: description || '',
        project: projectId,
        user: userId,
      },
    });

    return ctx.send({ entry });
  },
};
