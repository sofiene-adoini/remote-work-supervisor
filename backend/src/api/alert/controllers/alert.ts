import type { Context } from 'koa';
const ALERT_UID = 'api::alert.alert';

export default {
  async myAlerts(ctx: Context) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized('Authentication required');

    const { limit = '5', unreadOnly = 'false' } = ctx.query as { limit?: string; unreadOnly?: string };

    const where: any = { user: userId };
    if (unreadOnly === 'true') {
      where.isRead = false;
    }

    const alerts = await strapi.db.query(ALERT_UID).findMany({
      where,
      orderBy: { createdAt: 'desc' },
      limit: parseInt(limit, 10),
      populate: ['session'],
    });

    const unreadCount = await strapi.db.query(ALERT_UID).count({
      where: { user: userId, isRead: false },
    });

    return ctx.send({ alerts, unreadCount });
  },

  async allAlerts(ctx: Context) {
    const { limit = '20' } = ctx.query as { limit?: string };

    const alerts = await strapi.db.query(ALERT_UID).findMany({
      orderBy: { createdAt: 'desc' },
      limit: parseInt(limit, 10),
      populate: ['user', 'session'],
    });

    return ctx.send({ alerts });
  },

  async markRead(ctx: Context) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized('Authentication required');

    const { id } = ctx.params;

    const alert = await strapi.db.query(ALERT_UID).findOne({
      where: { id: parseInt(id, 10), user: userId },
    });

    if (!alert) {
      return ctx.notFound('Alert not found');
    }

    const updated = await strapi.db.query(ALERT_UID).update({
      where: { id: alert.id },
      data: { isRead: true },
    });

    return ctx.send({ alert: updated });
  },

  async markAllRead(ctx: Context) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized('Authentication required');

    await strapi.db.query(ALERT_UID).updateMany({
      where: { user: userId, isRead: false },
      data: { isRead: true },
    });

    return ctx.send({ ok: true });
  },
};
