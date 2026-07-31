import type { Context } from 'koa';
import crypto from 'node:crypto';

const DEVICE_UID = 'api::agent-device.agent-device';
const CODE_UID = 'api::pairing-code.pairing-code';
const USER_UID = 'plugin::users-permissions.user';

const TRUST_DURATION_MS = (Number(process.env.AGENT_TRUST_DURATION_DAYS) || 90) * 24 * 60 * 60 * 1000;
const CODE_DURATION_SEC = Number(process.env.AGENT_PAIR_CODE_TTL_SECONDS) || 60;
const RATE_LIMIT_WINDOW_MS = Number(process.env.AGENT_PAIR_RATE_LIMIT_WINDOW_MS) || 60 * 1000;
const RATE_LIMIT_MAX = Number(process.env.AGENT_PAIR_RATE_LIMIT_MAX) || 5;

const rateLimitMap = new Map<number, { count: number; windowStart: number }>();

function checkRateLimit(userId: number): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(userId, { count: 1, windowStart: now });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }

  entry.count++;
  return true;
}

function generateCode(): string {
  const bytes = crypto.randomBytes(4);
  const hex = bytes.toString('hex').toUpperCase();
  return `RWS-${hex.slice(0, 4)}-${hex.slice(4, 8)}`;
}

function hashCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

export default {
  async generateCode(ctx: Context) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized('Authentication required');

    if (!checkRateLimit(userId)) {
      return ctx.tooManyRequests('Too many pairing attempts. Wait a minute.');
    }

    const oldCodes = await strapi.db.query(CODE_UID).findMany({
      where: { employee: userId, active: true },
    });
    for (const c of oldCodes) {
      await strapi.db.query(CODE_UID).update({
        where: { id: c.id },
        data: { active: false },
      });
    }

    const plainCode = generateCode();
    const hashedCode = hashCode(plainCode);
    const expiresAt = new Date(Date.now() + CODE_DURATION_SEC * 1000).toISOString();

    const code = await strapi.db.query(CODE_UID).create({
      data: {
        hashedCode,
        expiresAt,
        active: true,
        employee: userId,
      },
    });

    return ctx.send({ code: plainCode, expiresAt: code.expiresAt });
  },

  async pair(ctx: Context) {
    const { code, deviceName, hostname, operatingSystem, agentVersion } = ctx.request.body ?? {};

    if (!code || !deviceName || !hostname || !operatingSystem) {
      return ctx.badRequest('code, deviceName, hostname, and operatingSystem are required.');
    }

    const hashedCode = hashCode(code);

    const pairingCode = await strapi.db.query(CODE_UID).findOne({
      where: { hashedCode, active: true },
      populate: ['employee'],
    });

    if (!pairingCode) {
      return ctx.badRequest('Invalid pairing code.');
    }

    if (pairingCode.usedAt) {
      return ctx.badRequest('Pairing code already used.');
    }

    if (new Date(pairingCode.expiresAt) < new Date()) {
      return ctx.badRequest('Pairing code expired.');
    }

    const employee = pairingCode.employee;
    if (!employee || !employee.id) {
      return ctx.badRequest('Invalid pairing code.');
    }

    await strapi.db.query(CODE_UID).update({
      where: { id: pairingCode.id },
      data: { usedAt: new Date().toISOString(), active: false },
    });

    const deviceId = crypto.randomUUID();
    const now = new Date().toISOString();
    const trustExpiresAt = new Date(Date.now() + TRUST_DURATION_MS).toISOString();
    const ipAddress = ctx.request.ip || ctx.ip || 'unknown';

    const device = await strapi.db.query(DEVICE_UID).create({
      data: {
        deviceId,
        deviceName,
        hostname,
        operatingSystem,
        agentVersion: agentVersion || 'unknown',
        pairedAt: now,
        lastLoginAt: now,
        lastSeenAt: now,
        trustExpiresAt,
        lastIPAddress: ipAddress,
        active: true,
        revoked: false,
        employee: employee.id,
      },
    });

    const sessionManager = strapi.sessionManager('users-permissions');

    const refresh = await sessionManager.generateRefreshToken(
      String(employee.id),
      deviceId,
      { type: 'refresh' },
    );

    const access = await sessionManager.generateAccessToken(refresh.token);
    if ('error' in access) {
      return ctx.internalServerError('Failed to generate access token');
    }

    const cookieName = 'rws_refresh';
    ctx.cookies.set(cookieName, refresh.token, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    return ctx.send({
      jwt: access.token,
      refreshToken: refresh.token,
      deviceId: device.deviceId,
      trustExpiresAt: device.trustExpiresAt,
    });
  },

  async refreshToken(ctx: Context) {
    const { deviceId } = ctx.request.body ?? {};
    if (!deviceId) return ctx.badRequest('deviceId is required.');

    const device = await strapi.db.query(DEVICE_UID).findOne({
      where: { deviceId, active: true, revoked: false },
      populate: ['employee'],
    });

    if (!device) {
      return ctx.unauthorized('Device not found or revoked.');
    }

    if (new Date(device.trustExpiresAt) < new Date()) {
      return ctx.send({ error: 'DEVICE_TRUST_EXPIRED' }, 401);
    }

    if (!device.employee || !device.employee.id) {
      return ctx.unauthorized('Device has no associated employee.');
    }

    const now = new Date().toISOString();
    await strapi.db.query(DEVICE_UID).update({
      where: { id: device.id },
      data: { lastLoginAt: now, lastSeenAt: now },
    });

    const sessionManager = strapi.sessionManager('users-permissions');

    const cookieName = 'rws_refresh';
    let currentRefreshToken = ctx.request.body?.refreshToken || ctx.cookies.get(cookieName);

    if (!currentRefreshToken) {
      return ctx.badRequest('Missing refresh token');
    }

    const rotation = await sessionManager.rotateRefreshToken(currentRefreshToken);
    if ('error' in rotation) {
      return ctx.unauthorized('Invalid refresh token');
    }

    const access = await sessionManager.generateAccessToken(rotation.token);
    if ('error' in access) {
      return ctx.unauthorized('Invalid refresh token');
    }

    ctx.cookies.set(cookieName, rotation.token, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    return ctx.send({ jwt: access.token, refreshToken: rotation.token });
  },

  async heartbeat(ctx: Context) {
    const { deviceId } = ctx.request.body ?? {};
    if (!deviceId) return ctx.badRequest('deviceId is required.');

    const device = await strapi.db.query(DEVICE_UID).findOne({
      where: { deviceId, active: true, revoked: false },
    });

    if (!device) return ctx.notFound('Device not found.');

    if (new Date(device.trustExpiresAt) < new Date()) {
      return ctx.send({ error: 'DEVICE_TRUST_EXPIRED' }, 401);
    }

    await strapi.db.query(DEVICE_UID).update({
      where: { id: device.id },
      data: { lastSeenAt: new Date().toISOString() },
    });

    return ctx.send({ ok: true });
  },

  async listDevices(ctx: Context) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized('Authentication required');

    const devices = await strapi.db.query(DEVICE_UID).findMany({
      where: { employee: userId },
      orderBy: { pairedAt: 'desc' },
    });

    return ctx.send({ devices });
  },

  async getDevice(ctx: Context) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized('Authentication required');

    const { id } = ctx.params;

    const device = await strapi.db.query(DEVICE_UID).findOne({
      where: { id: parseInt(id, 10), employee: userId },
    });

    if (!device) return ctx.notFound('Device not found.');

    return ctx.send({ device });
  },

  async unpair(ctx: Context) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized('Authentication required');

    const { id } = ctx.params;
    const roleName = ctx.state.user?.role?.name;
    const isAdminOrHr = roleName === 'HR' || roleName === 'Admin';

    const where: any = { id: parseInt(id, 10) };
    if (!isAdminOrHr) {
      where.employee = userId;
    }

    const device = await strapi.db.query(DEVICE_UID).findOne({ where });

    if (!device) return ctx.notFound('Device not found.');

    await strapi.db.query(DEVICE_UID).update({
      where: { id: device.id },
      data: {
        active: false,
        revoked: true,
        revokedAt: new Date().toISOString(),
        revokedBy: isAdminOrHr ? `hr:${userId}` : `self:${userId}`,
      },
    });

    return ctx.send({ ok: true });
  },

  async renameDevice(ctx: Context) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized('Authentication required');

    const { id } = ctx.params;
    const { deviceName } = ctx.request.body ?? {};

    if (!deviceName || typeof deviceName !== 'string') {
      return ctx.badRequest('deviceName is required.');
    }

    const device = await strapi.db.query(DEVICE_UID).findOne({
      where: { id: parseInt(id, 10), employee: userId },
    });

    if (!device) return ctx.notFound('Device not found.');

    const updated = await strapi.db.query(DEVICE_UID).update({
      where: { id: device.id },
      data: { deviceName: deviceName.trim() },
    });

    return ctx.send({ device: updated });
  },

  async hrListAllDevices(ctx: Context) {
    const roleName = ctx.state.user?.role?.name;
    if (roleName !== 'HR' && roleName !== 'Admin') {
      return ctx.forbidden('HR or Admin role required.');
    }

    const devices = await strapi.db.query(DEVICE_UID).findMany({
      orderBy: { pairedAt: 'desc' },
      populate: ['employee'],
    });

    return ctx.send({ devices });
  },

  async revokeByHr(ctx: Context) {
    const roleName = ctx.state.user?.role?.name;
    if (roleName !== 'HR' && roleName !== 'Admin') {
      return ctx.forbidden('HR or Admin role required.');
    }

    const { id } = ctx.params;
    const adminId = ctx.state.user?.id;

    const device = await strapi.db.query(DEVICE_UID).findOne({
      where: { id: parseInt(id, 10) },
    });

    if (!device) return ctx.notFound('Device not found.');

    await strapi.db.query(DEVICE_UID).update({
      where: { id: device.id },
      data: {
        active: false,
        revoked: true,
        revokedAt: new Date().toISOString(),
        revokedBy: `hr:${adminId}`,
      },
    });

    return ctx.send({ ok: true });
  },

  async revokeAllByEmployee(ctx: Context) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized('Authentication required');

    const devices = await strapi.db.query(DEVICE_UID).findMany({
      where: { employee: userId, active: true },
    });
    const revokedAt = new Date().toISOString();
    for (const d of devices) {
      await strapi.db.query(DEVICE_UID).update({
        where: { id: d.id },
        data: {
          active: false,
          revoked: true,
          revokedAt,
          revokedBy: `password-reset:${userId}`,
        },
      });
    }

    return ctx.send({ ok: true });
  },

  async unpairSelf(ctx: Context) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized('Authentication required');

    const { deviceId } = ctx.request.body ?? {};
    if (!deviceId) return ctx.badRequest('deviceId is required.');

    const device = await strapi.db.query(DEVICE_UID).findOne({
      where: { deviceId, employee: userId },
    });

    if (!device) return ctx.notFound('Device not found.');

    await strapi.db.query(DEVICE_UID).update({
      where: { id: device.id },
      data: {
        active: false,
        revoked: true,
        revokedAt: new Date().toISOString(),
        revokedBy: `self:${userId}`,
      },
    });

    return ctx.send({ ok: true });
  },
};
