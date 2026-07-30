import type { Context } from 'koa';
const PROJECT_UID = 'api::project.project';
const ALLOC_UID = 'api::project-time-allocation.project-time-allocation';
const TEAM_UID = 'api::team.team';
const USER_UID = 'plugin::users-permissions.user';

export default {
  async create(ctx: Context) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized('Authentication required');

    const body = ctx.request.body as {
      name?: string;
      description?: string;
      status?: string;
      priority?: string;
      client?: string;
      expectedStart?: string;
      expectedEnd?: string;
      estimatedHours?: number;
      color?: string;
      assignmentType?: 'team' | 'individual';
      teamId?: number;
      employeeIds?: number[];
      managerId?: number;
    };

    if (!body.name?.trim()) return ctx.badRequest('Project name is required');
    if (body.assignmentType !== 'team' && body.assignmentType !== 'individual') {
      return ctx.badRequest('assignmentType must be "team" or "individual"');
    }

    let resolvedTeamId: number | null = null;
    let resolvedUserIds: number[] = [];

    if (body.assignmentType === 'team') {
      if (!body.teamId) return ctx.badRequest('teamId is required for team assignment');
      const team = await strapi.db.query(TEAM_UID).findOne({
        where: { id: body.teamId },
        populate: ['users'],
      });
      if (!team) return ctx.notFound('Team not found');
      resolvedTeamId = team.id;
      resolvedUserIds = (team.users ?? []).map((u: any) => u.id);
    } else {
      if (!body.employeeIds?.length) return ctx.badRequest('employeeIds is required for individual assignment');
      for (const eid of body.employeeIds) {
        const user = await strapi.db.query(USER_UID).findOne({ where: { id: eid } });
        if (!user) return ctx.badRequest(`User ${eid} not found`);
      }
      resolvedUserIds = body.employeeIds;
    }

    const project = await strapi.db.query(PROJECT_UID).create({
      data: {
        name: body.name.trim(),
        description: body.description || '',
        status: body.status || 'active',
        priority: body.priority || 'medium',
        client: body.client || null,
        expectedStart: body.expectedStart || null,
        expectedEnd: body.expectedEnd || null,
        estimatedHours: body.estimatedHours || null,
        color: body.color || '#0b4a5a',
        team: resolvedTeamId,
        users: resolvedUserIds,
        manager: body.managerId || null,
      },
    });

    const created = await strapi.db.query(PROJECT_UID).findOne({
      where: { id: project.id },
      populate: ['team', 'users', 'manager'],
    });

    return ctx.send({
      project: {
        id: created.id,
        name: created.name,
        description: created.description,
        status: created.status,
        priority: created.priority,
        client: created.client,
        expectedStart: created.expectedStart,
        expectedEnd: created.expectedEnd,
        estimatedHours: created.estimatedHours,
        color: created.color,
        team: created.team ? { id: created.team.id, name: created.team.name } : null,
        users: (created.users ?? []).map((u: any) => ({ id: u.id, fullName: u.fullName })),
        manager: created.manager ? { id: created.manager.id, fullName: created.manager.fullName } : null,
        createdAt: created.createdAt,
      },
    });
  },

  async update(ctx: Context) {
    const { id } = ctx.params;

    const project = await strapi.db.query(PROJECT_UID).findOne({
      where: { id: parseInt(id, 10) },
    });
    if (!project) return ctx.notFound('Project not found');

    const body = ctx.request.body as Record<string, any>;
    const allowedFields = ['name', 'description', 'status', 'priority', 'client', 'expectedStart', 'expectedEnd', 'estimatedHours', 'color', 'manager'];
    const updates: Record<string, any> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) updates[field] = body[field];
    }

    if (body.assignmentType) {
      const { assignmentType, teamId, employeeIds } = body;
      if (assignmentType === 'team') {
        if (!teamId) return ctx.badRequest('teamId is required for team assignment');
        const team = await strapi.db.query(TEAM_UID).findOne({
          where: { id: teamId },
          populate: ['users'],
        });
        if (!team) return ctx.notFound('Team not found');
        updates.team = team.id;
        updates.users = (team.users ?? []).map((u: any) => u.id);
      } else if (assignmentType === 'individual') {
        if (!employeeIds?.length) return ctx.badRequest('employeeIds is required for individual assignment');
        for (const eid of employeeIds) {
          const user = await strapi.db.query(USER_UID).findOne({ where: { id: eid } });
          if (!user) return ctx.badRequest(`User ${eid} not found`);
        }
        updates.team = null;
        updates.users = employeeIds;
      }
    }

    await strapi.db.query(PROJECT_UID).update({
      where: { id: project.id },
      data: updates,
    });

    const updated = await strapi.db.query(PROJECT_UID).findOne({
      where: { id: project.id },
      populate: ['team', 'users', 'manager'],
    });

    return ctx.send({
      project: {
        id: updated.id,
        name: updated.name,
        description: updated.description,
        status: updated.status,
        priority: updated.priority,
        client: updated.client,
        expectedStart: updated.expectedStart,
        expectedEnd: updated.expectedEnd,
        estimatedHours: updated.estimatedHours,
        color: updated.color,
        team: updated.team ? { id: updated.team.id, name: updated.team.name } : null,
        users: (updated.users ?? []).map((u: any) => ({ id: u.id, fullName: u.fullName })),
        manager: updated.manager ? { id: updated.manager.id, fullName: updated.manager.fullName } : null,
        createdAt: updated.createdAt,
      },
    });
  },

  async getById(ctx: Context) {
    const { id } = ctx.params;

    const project = await strapi.db.query(PROJECT_UID).findOne({
      where: { id: parseInt(id, 10) },
      populate: ['team', 'manager'],
    });
    if (!project) return ctx.notFound('Project not found');

    const projectUsers = await strapi.db.query(USER_UID).findMany({
      where: { projects: { id: project.id } },
    });

    const totalMinutes = await computeTotalAllocationMinutes(project.id);
    const activeMinutes = await computeActiveAllocationMinutes(project.id);

    const allocs = await strapi.db.query(ALLOC_UID).findMany({
      where: { project: project.id },
      populate: ['user'],
    });

    const userHours: Record<number, { fullName: string; totalMinutes: number }> = {};
    for (const alloc of allocs) {
      const uid = typeof alloc.user === 'object' && alloc.user ? alloc.user.id : alloc.user;
      const uname = typeof alloc.user === 'object' && alloc.user ? alloc.user.fullName : 'Unknown';
      if (!userHours[uid]) userHours[uid] = { fullName: uname, totalMinutes: 0 };
      userHours[uid].totalMinutes += alloc.durationMinutes || 0;
    }

    const employees = Object.entries(userHours).map(([uid, data]) => ({
      userId: parseInt(uid, 10),
      fullName: data.fullName,
      totalHours: Math.round((data.totalMinutes / 60) * 10) / 10,
    }));

    return ctx.send({
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        status: project.status,
        priority: project.priority,
        client: project.client,
        expectedStart: project.expectedStart,
        expectedEnd: project.expectedEnd,
        estimatedHours: project.estimatedHours,
        color: project.color,
        totalHours: Math.round((totalMinutes / 60) * 10) / 10,
        activeHoursThisWeek: Math.round((activeMinutes / 60) * 10) / 10,
        team: project.team ? { id: project.team.id, name: project.team.name } : null,
        users: (projectUsers ?? []).map((u: any) => ({ id: u.id, fullName: u.fullName })),
        manager: project.manager ? { id: project.manager.id, fullName: project.manager.fullName } : null,
        employees,
        createdAt: project.createdAt,
      },
    });
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

    const reassigned = await strapi.db.query(PROJECT_UID).findOne({
      where: { id: project.id },
      populate: ['team', 'users'],
    });

    return ctx.send({
      project: {
        id: reassigned.id,
        name: reassigned.name,
        description: reassigned.description,
        status: reassigned.status,
        priority: reassigned.priority,
        client: reassigned.client,
        expectedStart: reassigned.expectedStart,
        expectedEnd: reassigned.expectedEnd,
        estimatedHours: reassigned.estimatedHours,
        color: reassigned.color,
        team: reassigned.team ? { id: reassigned.team.id, name: reassigned.team.name } : null,
        users: (reassigned.users ?? []).map((u: any) => ({ id: u.id, fullName: u.fullName })),
        createdAt: reassigned.createdAt,
      },
    });
  },

  async listAll(ctx: Context) {
    const projects = await strapi.db.query(PROJECT_UID).findMany({
      orderBy: { name: 'asc' },
      populate: ['team', 'manager'],
    });

    const result = await Promise.all(
      projects.map(async (p) => {
        const totalMinutes = await computeTotalAllocationMinutes(p.id);
        const activeMinutes = await computeActiveAllocationMinutes(p.id);
        const projectUsers = await strapi.db.query(USER_UID).findMany({
          where: { projects: { id: p.id } },
        });
        return {
          id: p.id,
          name: p.name,
          description: p.description,
          status: p.status,
          priority: p.priority,
          client: p.client,
          expectedStart: p.expectedStart,
          expectedEnd: p.expectedEnd,
          estimatedHours: p.estimatedHours,
          color: p.color,
          totalHours: Math.round((totalMinutes / 60) * 10) / 10,
          activeHoursThisWeek: Math.round((activeMinutes / 60) * 10) / 10,
          team: p.team ? { id: p.team.id, name: p.team.name } : null,
          users: (projectUsers ?? []).map((u: any) => ({ id: u.id, fullName: u.fullName })),
          manager: p.manager ? { id: p.manager.id, fullName: p.manager.fullName } : null,
          createdAt: p.createdAt,
        };
      })
    );

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
    const mondayStr = monday.toISOString();

    const result = await Promise.all(
      projects.map(async (project) => {
        // Compute from allocations
        const allAllocs = await strapi.db.query(ALLOC_UID).findMany({
          where: { project: project.id, user: userId },
        });

        const weekAllocs = allAllocs.filter((a: any) =>
          a.startTime && new Date(a.startTime).getTime() >= monday.getTime()
        );

        const totalMinutes = allAllocs.reduce((sum: number, a: any) => sum + (a.durationMinutes || 0), 0);
        const weekMinutes = weekAllocs.reduce((sum: number, a: any) => sum + (a.durationMinutes || 0), 0);
        const activeAlloc = await strapi.db.query(ALLOC_UID).findOne({
          where: { project: project.id, user: userId, endTime: null },
        });

        if (activeAlloc) {
          const elapsed = Math.round((Date.now() - new Date(activeAlloc.startTime).getTime()) / 60000);
          weekMinutes + elapsed;
        }

        return {
          id: project.id,
          name: project.name,
          description: project.description,
          status: project.status,
          priority: project.priority,
          color: project.color,
          hoursThisWeek: Math.round((weekMinutes / 60) * 10) / 10,
          hoursTotal: Math.round((totalMinutes / 60) * 10) / 10,
          isActive: !!activeAlloc,
          createdAt: project.createdAt,
        };
      })
    );

    return ctx.send({ projects: result });
  },
};

async function computeTotalAllocationMinutes(projectId: number): Promise<number> {
  const allocs = await strapi.db.query(ALLOC_UID).findMany({
    where: { project: projectId },
  });
  return allocs.reduce((sum, a: any) => sum + (a.durationMinutes || 0), 0);
}

async function computeActiveAllocationMinutes(projectId: number): Promise<number> {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
  monday.setHours(0, 0, 0, 0);

  const allocs = await strapi.db.query(ALLOC_UID).findMany({
    where: {
      project: projectId,
      startTime: { $gte: monday.toISOString() },
    },
  });
  return allocs.reduce((sum, a: any) => sum + (a.durationMinutes || 0), 0);
}
