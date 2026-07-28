import type { Context } from 'koa';
import { OvertimeDetectionService } from '../services/overtime-detection.service';
import { WorkPolicyService } from '../../company-work-policy/services/work-policy.service';

const OT_UID = 'api::overtime-declaration.overtime-declaration';

export default {
  async myDeclarations(ctx: Context) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized('Authentication required');

    const { status } = ctx.query as Record<string, string>;

    const where: any = { user: userId };
    if (status) where.status = status;

    const declarations = await strapi.db.query(OT_UID).findMany({
      where,
      orderBy: { createdAt: 'desc' },
      populate: ['session', 'reviewer'],
    });

    return ctx.send({ declarations });
  },

  async pending(ctx: Context) {
    const declarations = await strapi.db.query(OT_UID).findMany({
      where: { status: 'submitted' },
      orderBy: { createdAt: 'desc' },
      populate: ['user', 'session'],
    });

    return ctx.send({ declarations });
  },

  async allDeclarations(ctx: Context) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized('Authentication required');

    const {
      status, employeeId,
      limit = '50', page = '1',
    } = ctx.query as Record<string, string>;

    const where: any = {};
    if (status) where.status = status;
    if (employeeId) where.user = { id: parseInt(employeeId, 10) };

    const pageSize = Math.min(parseInt(limit, 10) || 50, 200);
    const currentPage = Math.max(parseInt(page, 10) || 1, 1);
    const offset = (currentPage - 1) * pageSize;

    const [declarations, total] = await Promise.all([
      strapi.db.query(OT_UID).findMany({
        where,
        orderBy: { createdAt: 'desc' },
        limit: pageSize,
        offset,
        populate: ['user', 'session', 'reviewer'],
      }),
      strapi.db.query(OT_UID).count({ where }),
    ]);

    return ctx.send({
      declarations,
      total,
      page: currentPage,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
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
