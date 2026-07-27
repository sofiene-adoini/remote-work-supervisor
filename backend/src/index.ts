import type { Core } from '@strapi/strapi';
import { Server, Socket } from 'socket.io';
import { createAndEmit } from './api/alert/services/notification.service';
import { emitSessionUpdate, startContinuousWorkCheck } from './api/session/controllers/session';

const USER_UID = 'plugin::users-permissions.user';
const OFFLINE_GRACE_MS = 15_000;

export default {
  register(/* { strapi }: { strapi: Core.Strapi } */) {},

  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    // ── Socket.IO ────────────────────────────────────────────────────
    const origins = process.env.CORS_ORIGIN?.split(',') ?? ['http://localhost:4200'];
    const io = new Server(strapi.server.httpServer as any, {
      cors: { origin: origins, credentials: true },
    });

    // ── Agent connection state (in-memory) ───────────────────────────
    const agentSockets = new Map<number, Socket>();
    const offlineTimers = new Map<number, NodeJS.Timeout>();

    // ── JWT middleware (unchanged) ───────────────────────────────────
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
        (socket as any).clientType = socket.handshake.auth?.clientType || 'dashboard';
        next();
      } catch {
        next(new Error('Authentication failed'));
      }
    });

    // ── Connection handler ───────────────────────────────────────────
    io.on('connection', (socket) => {
      const user = (socket as any).user;
      const clientType = (socket as any).clientType;
      const roleName = user.role?.name;

      // ── Room joining (agent + dashboard) ──────────────────────────
      socket.join(`user:${user.id}`);

      if (clientType !== 'agent') {
        socket.join(`employee:${user.id}`);
      }

      if (user.team?.id) {
        socket.join(`team:${user.team.id}`);
      }

      if (roleName === 'HR' || roleName === 'Admin') {
        socket.join('company');
      }

      if (roleName === 'HR') {
        socket.join('hr');
      }

      if (roleName === 'Admin') {
        socket.join('admin');
      }

      // ── Agent-specific handling ───────────────────────────────────
      if (clientType === 'agent') {
        const uid = Number(user.id);

        // Cancel any pending offline timer
        if (offlineTimers.has(uid)) {
          clearTimeout(offlineTimers.get(uid)!);
          offlineTimers.delete(uid);
          strapi.log.info(`[Realtime Agent] Offline timer cancelled for employee ${uid}`);

          // Emit "Agent Online" alert (reconnection after disconnect)
          createAndEmit({
            type: 'agent_online',
            title: 'Agent Online',
            message: 'Employee monitoring agent reconnected.',
            severity: 'info',
            userId: uid,
          }).catch((err: any) => strapi.log.error(`[Realtime Agent] agent_online alert failed: ${err.message}`));
        }

        // Store agent socket (replace previous if exists)
        const prevSocket = agentSockets.get(uid);
        if (prevSocket && prevSocket.id !== socket.id) {
          prevSocket.disconnect(true);
        }
        agentSockets.set(uid, socket);
        emitSessionUpdate(uid).catch(() => {});

        strapi.log.info(`[Realtime Agent] Employee ${user.id} (${user.fullName}) connected`);
      } else {
        strapi.log.info(`[Realtime] user=${user.id} (${user.fullName}) role=${roleName} connected`);
      }

      // ── Disconnect handler ─────────────────────────────────────────
      socket.on('disconnect', () => {
        if (clientType === 'agent') {
          const uid = Number(user.id);
          agentSockets.delete(uid);

          // Start grace timer
          const timer = setTimeout(async () => {
            offlineTimers.delete(uid);

            // Auto clock-out if still active
            try {
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const activeSession = await strapi.db.query('api::session.session').findOne({
                where: {
                  user: uid,
                  clockIn: { $gte: today.toISOString() },
                  status: { $in: ['active', 'break'] },
                },
                orderBy: { clockIn: 'desc' },
              });

              if (activeSession) {
                await strapi.db.query('api::session.session').update({
                  where: { id: activeSession.id },
                  data: {
                    clockOut: new Date().toISOString(),
                    status: 'completed',
                    breakEnd: activeSession.breakStart && !activeSession.breakEnd
                      ? new Date().toISOString()
                      : activeSession.breakEnd,
                  },
                });
                strapi.log.info(`[Realtime Agent] Auto clock-out for employee ${uid} (agent offline)`);
              }
            } catch (err: any) {
              strapi.log.error(`[Realtime Agent] Auto clock-out failed for employee ${uid}: ${err.message}`);
            }

            createAndEmit({
              type: 'agent_offline',
              title: 'Agent Offline',
              message: 'Employee monitoring agent disconnected unexpectedly.',
              severity: 'warning',
              userId: uid,
            }).catch((err: any) => strapi.log.error(`[Realtime Agent] agent_offline alert failed: ${err.message}`));

            emitSessionUpdate(uid).catch(() => {});
            strapi.log.info(`[Realtime Agent] Offline alert emitted for employee ${uid}`);
          }, OFFLINE_GRACE_MS);

          offlineTimers.set(uid, timer);
          strapi.log.info(`[Realtime Agent] Employee ${uid} disconnected — offline timer started (${OFFLINE_GRACE_MS / 1000}s)`);
        } else {
          strapi.log.info(`[Realtime] user=${user.id} disconnected`);
        }
      });
    });

    (strapi as any).io = io;
    (strapi as any).agentSockets = agentSockets;

    strapi.log.info(`[Realtime] Socket.IO server ready`);

    // ── Seed default company work policy ──────────────────────────────
    const POLICY_UID = 'api::company-work-policy.company-work-policy';
    try {
      const existingPolicy = await strapi.db.query(POLICY_UID).findOne({ where: { id: 1 } });
      if (!existingPolicy) {
        await strapi.db.query(POLICY_UID).create({
          data: {
            id: 1,
            expectedDailyHours: 8,
            expectedWeeklyHours: 40,
            maximumDailyHours: 12,
            maximumWeeklyHours: 60,
            minimumBreakMinutes: 30,
            autoOvertimeEnabled: true,
            overtimeStartsAfterDailyHours: 8,
            allowClockInOutsideSchedule: true,
            allowWeekendWork: false,
            workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
            lateToleranceMinutes: 5,
            earlyLeaveToleranceMinutes: 5,
            maximumContinuousWorkHours: 6,
            timezone: 'Africa/Tunis',
          },
        });
        strapi.log.info('[Policy] Default company work policy seeded');
      }
    } catch (err: any) {
      strapi.log.error(`[Policy] Failed to seed work policy: ${err.message}`);
    }

    // ── Start continuous work protection ──────────────────────────────
    startContinuousWorkCheck();

    // ── Cleanup on shutdown ──────────────────────────────────────────
    const cleanup = () => {
      for (const [, timer] of offlineTimers) clearTimeout(timer);
      offlineTimers.clear();
      agentSockets.clear();
    };
    process.on('SIGTERM', cleanup);
    process.on('SIGINT', cleanup);

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
