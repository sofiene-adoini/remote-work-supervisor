import type { Core } from '@strapi/strapi';
import { Server } from 'socket.io';

const USER_UID = 'plugin::users-permissions.user';

export default {
  register(/* { strapi }: { strapi: Core.Strapi } */) {},

  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    // ── Socket.IO ────────────────────────────────────────────────────
    const origins = process.env.CORS_ORIGIN?.split(',') ?? ['http://localhost:4200'];
    const io = new Server(strapi.server.httpServer as any, {
      cors: { origin: origins, credentials: true },
    });

    io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth?.token;
        if (!token) return next(new Error('Missing auth token'));

        const jwtService = strapi.plugin('users-permissions').service('jwt');
        const decoded = await jwtService.verify(token);
        const user = await strapi.db.query(USER_UID).findOne({
          where: { id: decoded.id },
          populate: ['role', 'team'],
        });

        if (!user || user.isActive === false) return next(new Error('Invalid user'));

        (socket as any).user = user;
        next();
      } catch {
        next(new Error('Authentication failed'));
      }
    });

    io.on('connection', (socket) => {
      const user = (socket as any).user;
      const roleName = user.role?.name;

      strapi.log.info(`[Realtime] user=${user.id} (${user.fullName}) role=${roleName} connected`);

      socket.join(`user:${user.id}`);

      if (user.team?.id) {
        socket.join(`team:${user.team.id}`);
      }

      if (roleName === 'HR' || roleName === 'Admin') {
        socket.join('company');
      }

      socket.on('disconnect', () => {
        strapi.log.info(`[Realtime] user=${user.id} disconnected`);
      });
    });

    (strapi as any).io = io;
    strapi.log.info(`[Realtime] Socket.IO server ready`);

    // ── Role seeding (existing) ──────────────────────────────────────
    const pluginStore = strapi.store({ type: 'plugin', name: 'users-permissions' });
    const advanced = ((await pluginStore.get({ key: 'advanced' })) ?? {}) as Record<string, unknown>;

    await pluginStore.set({
      key: 'advanced',
      value: {
        ...advanced,
        allow_register: false,
        email_reset_password: '/set-initial-password',
      },
    });

    const roles = [
      { name: 'Employee', type: 'employee', description: 'Employee dashboard access.' },
      { name: 'Manager', type: 'manager', description: 'Manager dashboard access.' },
      { name: 'HR', type: 'hr', description: 'Human resources dashboard access.' },
      { name: 'Admin', type: 'admin', description: 'Administrative HR access.' },
    ];

    for (const role of roles) {
      const existing = await strapi.db.query('plugin::users-permissions.role').findOne({
        where: { type: role.type },
      });

      if (!existing) {
        await strapi.db.query('plugin::users-permissions.role').create({ data: role });
      }
    }

    const ensuredRoles = await strapi.db.query('plugin::users-permissions.role').findMany({
      where: { type: { $in: roles.map((role) => role.type) } },
    });

    const ensurePermission = async (roleId: number, action: string) => {
      const existing = await strapi.db.query('plugin::users-permissions.permission').findOne({
        where: { role: roleId, action },
      });

      if (!existing) {
        await strapi.db.query('plugin::users-permissions.permission').create({
          data: { role: roleId, action },
        });
      }
    };

    for (const role of ensuredRoles) {
      await ensurePermission(role.id, 'plugin::users-permissions.auth.me');

      if (role.name === 'HR' || role.name === 'Admin') {
        await ensurePermission(role.id, 'plugin::users-permissions.auth.invite');
      }
    }
  },
};
