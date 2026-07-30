import type { Context } from 'koa';
import { OvertimeDetectionService } from '../services/overtime-detection.service';
import { WorkPolicyService } from '../../company-work-policy/services/work-policy.service';

const OT_UID = 'api::overtime-declaration.overtime-declaration';
const TEAM_UID = 'api::team.team';

function buildWhere(params: Record<string, string>, extra: Record<string, any> = {}): any {
  const where: any = { ...extra };

  if (params.status) {
    where.status = params.status;
  }
  if (params.dateFrom || params.dateTo) {
    where.date = {};
    if (params.dateFrom) where.date.$gte = params.dateFrom;
    if (params.dateTo) where.date.$lte = params.dateTo;
  }
  if (params.search) {
    where.$or = [
      { reason: { $containsi: params.search } },
      { notes: { $containsi: params.search } },
    ];
  }
  if (params.minDuration) {
    where.overtimeMinutes = { ...(where.overtimeMinutes || {}), $gte: parseInt(params.minDuration, 10) };
  }
  if (params.maxDuration) {
    where.overtimeMinutes = { ...(where.overtimeMinutes || {}), $lte: parseInt(params.maxDuration, 10) };
  }
  if (params.employeeId) {
    where.user = { id: parseInt(params.employeeId, 10) };
  }

  return where;
}

function buildSort(params: Record<string, string>): Record<string, string> {
  const sortField = params.sortBy || 'createdAt';
  const sortOrder = params.sortOrder === 'asc' ? 'asc' : 'desc';
  return { [sortField]: sortOrder };
}

function parsePagination(params: Record<string, string>): { page: number; pageSize: number; offset: number } | null {
  if (!params.page && !params.pageSize && !params.limit) return null;
  const pageSize = Math.min(parseInt(params.pageSize || params.limit || '50', 10), 200);
  const page = Math.max(parseInt(params.page || '1', 10), 1);
  return { page, pageSize, offset: (page - 1) * pageSize };
}

export default {
  async myDeclarations(ctx: Context) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized('Authentication required');

    const params = ctx.query as Record<string, string>;
    const where = buildWhere(params, { user: userId });
    const orderBy = buildSort(params);
    const pag = parsePagination(params);

    if (pag) {
      const [declarations, total] = await Promise.all([
        strapi.db.query(OT_UID).findMany({
          where,
          orderBy,
          limit: pag.pageSize,
          offset: pag.offset,
          populate: ['session', 'reviewer'],
        }),
        strapi.db.query(OT_UID).count({ where }),
      ]);
      return ctx.send({
        declarations,
        total,
        page: pag.page,
        pageSize: pag.pageSize,
        totalPages: Math.ceil(total / pag.pageSize),
      });
    }

    const declarations = await strapi.db.query(OT_UID).findMany({
      where,
      orderBy,
      populate: ['session', 'reviewer'],
    });
    return ctx.send({ declarations });
  },

  async pending(ctx: Context) {
    const params = ctx.query as Record<string, string>;
    const where: any = { status: { $in: ['detected', 'submitted'] } };

    if (params.search) {
      where.$or = [
        { reason: { $containsi: params.search } },
        { notes: { $containsi: params.search } },
      ];
    }
    if (params.dateFrom || params.dateTo) {
      where.date = {};
      if (params.dateFrom) where.date.$gte = params.dateFrom;
      if (params.dateTo) where.date.$lte = params.dateTo;
    }
    if (params.teamId) {
      const team = await strapi.db.query(TEAM_UID).findOne({
        where: { id: parseInt(params.teamId, 10) },
        populate: ['users'],
      });
      if (team && team.users) {
        where.user = { id: { $in: (team.users as any[]).map((u: any) => u.id) } };
      }
    }
    if (params.employeeId) {
      if (where.user) {
        const ids = (where.user.id.$in as number[]).filter(
          (id: number) => id === parseInt(params.employeeId!, 10),
        );
        where.user = { id: { $in: ids } };
      } else {
        where.user = { id: parseInt(params.employeeId, 10) };
      }
    }

    const orderBy = buildSort(params);
    const pag = parsePagination(params);

    if (pag) {
      const [declarations, total] = await Promise.all([
        strapi.db.query(OT_UID).findMany({
          where,
          orderBy,
          limit: pag.pageSize,
          offset: pag.offset,
          populate: ['user', 'session', 'reviewer'],
        }),
        strapi.db.query(OT_UID).count({ where }),
      ]);
      return ctx.send({ declarations, total, page: pag.page, pageSize: pag.pageSize, totalPages: Math.ceil(total / pag.pageSize) });
    }

    const declarations = await strapi.db.query(OT_UID).findMany({
      where,
      orderBy,
      populate: ['user', 'session', 'reviewer'],
    });
    return ctx.send({ declarations });
  },

  async allDeclarations(ctx: Context) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized('Authentication required');

    const params = ctx.query as Record<string, string>;
    const where = buildWhere(params);

    if (params.teamId) {
      const team = await strapi.db.query(TEAM_UID).findOne({
        where: { id: parseInt(params.teamId, 10) },
        populate: ['users'],
      });
      if (team && team.users) {
        const teamUserIds = (team.users as any[]).map((u: any) => u.id);
        if (where.user) {
          const existingId = where.user.id;
          where.user = { id: { $in: teamUserIds.filter((id: number) => existingId ? id === existingId : true) } };
        } else {
          where.user = { id: { $in: teamUserIds } };
        }
      }
    }

    const orderBy = buildSort(params);
    const limit = Math.min(parseInt(params.limit || '50', 10), 200);
    const page = Math.max(parseInt(params.page || '1', 10), 1);
    const offset = (page - 1) * limit;

    const [declarations, total] = await Promise.all([
      strapi.db.query(OT_UID).findMany({
        where,
        orderBy,
        limit,
        offset,
        populate: ['user', 'session', 'reviewer'],
      }),
      strapi.db.query(OT_UID).count({ where }),
    ]);

    return ctx.send({
      declarations,
      total,
      page,
      pageSize: limit,
      totalPages: Math.ceil(total / limit),
    });
  },

  async recentDecisions(ctx: Context) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized('Authentication required');

    const declarations = await strapi.db.query(OT_UID).findMany({
      where: { user: userId, status: { $in: ['approved', 'rejected'] } },
      orderBy: { reviewedAt: 'desc' },
      limit: 10,
      populate: ['session', 'reviewer'],
    });

    return ctx.send({ declarations });
  },

  async hrStats(ctx: Context) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dayOfWeek = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7));
    monday.setHours(0, 0, 0, 0);

    const [pendingDecls, todayApprovedDecls, todayRejectedDecls, weekApprovedDecls, weekRejectedDecls] = await Promise.all([
      strapi.db.query(OT_UID).findMany({ where: { status: { $in: ['detected', 'submitted'] } } }),
      strapi.db.query(OT_UID).findMany({ where: { status: 'approved', reviewedAt: { $gte: today.toISOString() } } }),
      strapi.db.query(OT_UID).findMany({ where: { status: 'rejected', reviewedAt: { $gte: today.toISOString() } } }),
      strapi.db.query(OT_UID).findMany({ where: { status: 'approved', reviewedAt: { $gte: monday.toISOString() } } }),
      strapi.db.query(OT_UID).findMany({ where: { status: 'rejected', reviewedAt: { $gte: monday.toISOString() } } }),
    ]);

    const sumMin = (arr: any[], key: string) => arr.reduce((s: number, d: any) => s + (d[key] || 0), 0);

    return ctx.send({
      pendingCount: pendingDecls.length,
      pendingHours: Math.round((sumMin(pendingDecls, 'overtimeMinutes') / 60) * 10) / 10,
      approvedToday: todayApprovedDecls.length,
      rejectedToday: todayRejectedDecls.length,
      approvedHoursThisWeek: Math.round((sumMin(weekApprovedDecls, 'overtimeMinutes') / 60) * 10) / 10,
      rejectedHoursThisWeek: Math.round((sumMin(weekRejectedDecls, 'overtimeMinutes') / 60) * 10) / 10,
    });
  },

  async submitJustification(ctx: Context) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized('Authentication required');

    const { id } = ctx.params;
    const { reason, notes } = ctx.request.body as { reason?: string; notes?: string };

    const ot = await strapi.db.query(OT_UID).findOne({
      where: { id: parseInt(id, 10) },
      populate: ['user'],
    });

    if (!ot) return ctx.notFound('Overtime declaration not found');

    const otUserId = typeof ot.user === 'object' ? ot.user.id : ot.user;
    if (otUserId !== userId) return ctx.forbidden('You can only submit justification for your own overtime');

    if (ot.status !== 'detected') {
      return ctx.badRequest(`Cannot submit justification for overtime in "${ot.status}" status`);
    }

    const policy = await WorkPolicyService.get();

    const newStatus = policy.requireHrApproval ? 'submitted' : 'approved';

    const updated = await strapi.db.query(OT_UID).update({
      where: { id: ot.id },
      data: {
        reason: reason || ot.reason,
        notes: notes || ot.notes,
        status: newStatus,
        justificationSubmittedAt: new Date().toISOString(),
        reviewedAt: policy.requireHrApproval ? null : new Date().toISOString(),
      },
    });

    const populated = await strapi.db.query(OT_UID).findOne({
      where: { id: updated.id },
      populate: ['user', 'session', 'reviewer'],
    });

    OvertimeDetectionService.emitOvertimeStatusChanged(populated);

    createAndEmit({
      type: 'overtime_submitted',
      title: 'Overtime Submitted',
      message: `Employee submitted overtime justification: ${reason || 'No reason provided'}`,
      severity: 'info',
      userId,
    }).catch(() => {});

    return ctx.send({ declaration: populated });
  },

  async cancel(ctx: Context) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized('Authentication required');

    const { id } = ctx.params;

    const ot = await strapi.db.query(OT_UID).findOne({
      where: { id: parseInt(id, 10) },
      populate: ['user'],
    });

    if (!ot) return ctx.notFound('Overtime declaration not found');

    const otUserId = typeof ot.user === 'object' ? ot.user.id : ot.user;
    if (otUserId !== userId) return ctx.forbidden('You can only cancel your own overtime');

    if (!['detected', 'submitted'].includes(ot.status)) {
      return ctx.badRequest(`Cannot cancel overtime in "${ot.status}" status`);
    }

    const updated = await strapi.db.query(OT_UID).update({
      where: { id: ot.id },
      data: { status: 'cancelled' },
    });

    const populated = await strapi.db.query(OT_UID).findOne({
      where: { id: updated.id },
      populate: ['user', 'session', 'reviewer'],
    });

    OvertimeDetectionService.emitOvertimeStatusChanged(populated);

    createAndEmit({
      type: 'overtime_cancelled',
      title: 'Overtime Cancelled',
      message: `Employee cancelled their overtime declaration.`,
      severity: 'info',
      userId,
    }).catch(() => {});

    return ctx.send({ declaration: populated });
  },

  async approve(ctx: Context) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized('Authentication required');

    const { id } = ctx.params;

    const ot = await strapi.db.query(OT_UID).findOne({
      where: { id: parseInt(id, 10) },
      populate: ['user'],
    });

    if (!ot) return ctx.notFound('Overtime declaration not found');
    if (ot.status !== 'submitted') return ctx.badRequest('Only submitted declarations can be approved');

    const updated = await strapi.db.query(OT_UID).update({
      where: { id: ot.id },
      data: {
        status: 'approved',
        reviewer: userId,
        reviewedAt: new Date().toISOString(),
      },
    });

    const populated = await strapi.db.query(OT_UID).findOne({
      where: { id: updated.id },
      populate: ['user', 'session', 'reviewer'],
    });

    OvertimeDetectionService.emitOvertimeStatusChanged(populated);

    const otUserId = typeof ot.user === 'object' ? ot.user.id : ot.user;

    createAndEmit({
      type: 'overtime_approved',
      title: 'Overtime Approved',
      message: `Your overtime of ${Math.round(ot.overtimeMinutes / 60 * 10) / 10}h has been approved.`,
      severity: 'info',
      userId: otUserId,
    }).catch(() => {});

    return ctx.send({ declaration: populated });
  },

  async reject(ctx: Context) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized('Authentication required');

    const { id } = ctx.params;

    const ot = await strapi.db.query(OT_UID).findOne({
      where: { id: parseInt(id, 10) },
      populate: ['user'],
    });

    if (!ot) return ctx.notFound('Overtime declaration not found');
    if (ot.status !== 'submitted') return ctx.badRequest('Only submitted declarations can be rejected');

    const updated = await strapi.db.query(OT_UID).update({
      where: { id: ot.id },
      data: {
        status: 'rejected',
        reviewer: userId,
        reviewedAt: new Date().toISOString(),
      },
    });

    const populated = await strapi.db.query(OT_UID).findOne({
      where: { id: updated.id },
      populate: ['user', 'session', 'reviewer'],
    });

    OvertimeDetectionService.emitOvertimeStatusChanged(populated);

    const otUserId = typeof ot.user === 'object' ? ot.user.id : ot.user;

    createAndEmit({
      type: 'overtime_rejected',
      title: 'Overtime Rejected',
      message: `Your overtime of ${Math.round(ot.overtimeMinutes / 60 * 10) / 10}h has been rejected.`,
      severity: 'warning',
      userId: otUserId,
    }).catch(() => {});

    return ctx.send({ declaration: populated });
  },
};

function createAndEmit(params: any) {
  const { createAndEmit: create } = require('../../alert/services/notification.service');
  return create(params);
}
