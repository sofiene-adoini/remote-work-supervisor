import type { Context } from 'koa';
const PROJECT_UID = 'api::project.project';
const TIME_ENTRY_UID = 'api::time-entry.time-entry';

export default {
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
