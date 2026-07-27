import type { Context } from 'koa';
const ALERT_UID = 'api::alert.alert';
const USER_UID = 'plugin::users-permissions.user';

// ── Reusable date filter builder ──────────────────────────────────────────

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfTomorrow(): Date {
  const d = startOfToday();
  d.setDate(d.getDate() + 1);
  return d;
}

function buildDateFilter(query: any): { createdAt?: any } {
  const now = new Date();

  if (query.from && query.to) {
    const from = new Date(query.from);
    from.setHours(0, 0, 0, 0);
    const to = new Date(query.to);
    to.setHours(23, 59, 59, 999);
    return { createdAt: { $gte: from.toISOString(), $lte: to.toISOString() } };
  }

  if (query.from) {
    const from = new Date(query.from);
    from.setHours(0, 0, 0, 0);
    return { createdAt: { $gte: from.toISOString() } };
  }

  if (query.to) {
    const to = new Date(query.to);
    to.setHours(23, 59, 59, 999);
    return { createdAt: { $lte: to.toISOString() } };
  }

  const period = query.period || 'today';

  switch (period) {
    case 'today': {
      return { createdAt: { $gte: startOfToday().toISOString(), $lt: startOfTomorrow().toISOString() } };
    }
    case 'yesterday': {
      const s = startOfToday();
      s.setDate(s.getDate() - 1);
      const e = startOfToday();
      return { createdAt: { $gte: s.toISOString(), $lt: e.toISOString() } };
    }
    case '7d': {
      const s = startOfToday();
      s.setDate(s.getDate() - 6);
      return { createdAt: { $gte: s.toISOString(), $lt: startOfTomorrow().toISOString() } };
    }
    case '30d': {
      const s = startOfToday();
      s.setDate(s.getDate() - 29);
      return { createdAt: { $gte: s.toISOString(), $lt: startOfTomorrow().toISOString() } };
    }
    default:
      return {};
  }
}

// ── Controller ────────────────────────────────────────────────────────────

export default {
  async myAlerts(ctx: Context) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized('Authentication required');

    const {
      period, from, to,
      limit = '50',
      page = '1',
      unreadOnly = 'false',
    } = ctx.query as Record<string, string>;

    const dateFilter = buildDateFilter({ period, from, to });
    const pageSize = Math.min(parseInt(limit, 10) || 50, 200);
    const currentPage = Math.max(parseInt(page, 10) || 1, 1);
    const offset = (currentPage - 1) * pageSize;

    const where: any = { user: userId, ...dateFilter };
    if (unreadOnly === 'true') {
      where.isRead = false;
    }

    const [alerts, total] = await Promise.all([
      strapi.db.query(ALERT_UID).findMany({
        where,
        orderBy: { createdAt: 'desc' },
        limit: pageSize,
        offset,
        populate: ['session'],
      }),
      strapi.db.query(ALERT_UID).count({ where }),
    ]);

    const unreadCount = await strapi.db.query(ALERT_UID).count({
      where: { user: userId, isRead: false },
    });

    return ctx.send({
      alerts,
      total,
      unreadCount,
      page: currentPage,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  },

  async allAlerts(ctx: Context) {
    const {
      period, from, to,
      limit = '50',
      page = '1',
      employeeId,
      teamId,
      severity,
      type,
      search,
    } = ctx.query as Record<string, string>;

    const dateFilter = buildDateFilter({ period, from, to });
    const pageSize = Math.min(parseInt(limit, 10) || 50, 200);
    const currentPage = Math.max(parseInt(page, 10) || 1, 1);
    const offset = (currentPage - 1) * pageSize;

    const where: any = { ...dateFilter };

    if (employeeId) {
      where.user = { id: parseInt(employeeId, 10) };
    }

    if (teamId) {
      const teamUsers = await strapi.db.query('api::team.team').findOne({
        where: { id: parseInt(teamId, 10) },
        populate: ['users'],
      });
      if (teamUsers?.users?.length) {
        const userIds = teamUsers.users.map((u: any) => u.id);
        where.user = { id: { $in: userIds } };
      } else {
        return ctx.send({ alerts: [], total: 0, unreadCount: 0, page: currentPage, pageSize, totalPages: 0 });
      }
    }

    if (severity) {
      where.severity = severity;
    }

    if (type) {
      where.type = type;
    }

    if (search) {
      const q = search.trim().toLowerCase();
      where.$or = [
        { title: { $containsi: q } },
        { message: { $containsi: q } },
      ];
    }

    const [alerts, total] = await Promise.all([
      strapi.db.query(ALERT_UID).findMany({
        where,
        orderBy: { createdAt: 'desc' },
        limit: pageSize,
        offset,
        populate: ['user', 'session'],
      }),
      strapi.db.query(ALERT_UID).count({ where }),
    ]);

    const unreadCount = await strapi.db.query(ALERT_UID).count({
      where: { isRead: false },
    });

    return ctx.send({
      alerts,
      total,
      unreadCount,
      page: currentPage,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  },

  async markRead(ctx: Context) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized('Authentication required');

    const { id } = ctx.params;
    const roleName = ctx.state.user?.role?.name;
    const isAdminOrHr = roleName === 'HR' || roleName === 'Admin';

    const alert = isAdminOrHr
      ? await strapi.db.query(ALERT_UID).findOne({ where: { id: parseInt(id, 10) } })
      : await strapi.db.query(ALERT_UID).findOne({ where: { id: parseInt(id, 10), user: userId } });

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

    const roleName = ctx.state.user?.role?.name;
    const isAdminOrHr = roleName === 'HR' || roleName === 'Admin';

    const alerts = isAdminOrHr
      ? await strapi.db.query(ALERT_UID).findMany({ where: { isRead: false } })
      : await strapi.db.query(ALERT_UID).findMany({ where: { user: userId, isRead: false } });

    for (const alert of alerts) {
      await strapi.db.query(ALERT_UID).update({
        where: { id: alert.id },
        data: { isRead: true },
      });
    }

    return ctx.send({ ok: true });
  },
};
