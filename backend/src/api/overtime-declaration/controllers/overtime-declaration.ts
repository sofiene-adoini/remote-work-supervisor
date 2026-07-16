import type { Context } from 'koa';
const OT_UID = 'api::overtime-declaration.overtime-declaration';

function emitOvertimeChanged(updated: any) {
  const io = (strapi as any).io;
  if (!io) return;

  const payload = {
    declarationId: updated.id,
    userId: updated.user,
    status: updated.status,
  };

  io.to('company').emit('overtime:status-changed', payload);
  io.to(`user:${updated.user}`).emit('overtime:status-changed', payload);
}

export default {
  async myDeclarations(ctx: Context) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized('Authentication required');

    const declarations = await strapi.db.query(OT_UID).findMany({
      where: { user: userId },
      orderBy: { createdAt: 'desc' },
    });

    return ctx.send({ declarations });
  },

  async declare(ctx: Context) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized('Authentication required');

    const { date, hours, reason } = ctx.request.body as {
      date: string;
      hours: number;
      reason: string;
    };

    if (!date || !hours || !reason) {
      return ctx.badRequest('date, hours, and reason are required');
    }

    if (hours < 0.25 || hours > 24) {
      return ctx.badRequest('Hours must be between 0.25 and 24');
    }

    const declaration = await strapi.db.query(OT_UID).create({
      data: {
        date,
        hours,
        reason,
        status: 'pending',
        user: userId,
      },
    });

    return ctx.send({ declaration });
  },

  async pending(ctx: Context) {
    const declarations = await strapi.db.query(OT_UID).findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'desc' },
      populate: ['user'],
    });

    return ctx.send({ declarations });
  },

  async allDeclarations(ctx: Context) {
    const declarations = await strapi.db.query(OT_UID).findMany({
      orderBy: { createdAt: 'desc' },
      populate: ['user'],
    });

    return ctx.send({ declarations });
  },

  async approve(ctx: Context) {
    const { id } = ctx.params;

    const declaration = await strapi.db.query(OT_UID).findOne({
      where: { id: parseInt(id, 10) },
    });

    if (!declaration) return ctx.notFound('Declaration not found');
    if (declaration.status !== 'pending') return ctx.badRequest('Declaration is not pending');

    const updated = await strapi.db.query(OT_UID).update({
      where: { id: declaration.id },
      data: { status: 'approved' },
    });

    emitOvertimeChanged(updated);

    return ctx.send({ declaration: updated });
  },

  async reject(ctx: Context) {
    const { id } = ctx.params;

    const declaration = await strapi.db.query(OT_UID).findOne({
      where: { id: parseInt(id, 10) },
    });

    if (!declaration) return ctx.notFound('Declaration not found');
    if (declaration.status !== 'pending') return ctx.badRequest('Declaration is not pending');

    const updated = await strapi.db.query(OT_UID).update({
      where: { id: declaration.id },
      data: { status: 'rejected' },
    });

    emitOvertimeChanged(updated);

    return ctx.send({ declaration: updated });
  },
};
