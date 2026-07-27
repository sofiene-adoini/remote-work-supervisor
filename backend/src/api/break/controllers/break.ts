import type { Context } from 'koa';
const BREAK_UID = 'api::break.break';
const SESSION_UID = 'api::session.session';

export default {
  async bySession(ctx: Context) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized('Authentication required');

    const { sessionId } = ctx.query as { sessionId?: string };
    if (!sessionId) return ctx.badRequest('sessionId is required');

    const session = await strapi.db.query(SESSION_UID).findOne({
      where: { id: parseInt(sessionId, 10), user: userId },
    });
    if (!session) return ctx.notFound('Session not found');

    const breaks = await strapi.db.query(BREAK_UID).findMany({
      where: { session: parseInt(sessionId, 10) },
      orderBy: { start: 'asc' },
    });

    return ctx.send({ breaks });
  },
};
