import crypto from 'node:crypto';
import type { Core } from '@strapi/strapi';
import { buildResetPasswordEmail, buildWelcomeEmail } from '../../utils/email-templates';

type StrapiPlugin = {
  contentTypes: Record<string, { schema: { attributes: Record<string, unknown> } }>;
  controllers: Record<string, any>;
  routes: Record<string, { routes: Array<Record<string, any>> }>;
  policies?: Record<string, (policyContext: any, config: unknown, context: { strapi: Core.Strapi }) => boolean>;
};

const USER_UID = 'plugin::users-permissions.user';
const PASSWORD_PATTERN = /^(?=.*\d).{10,}$/;

/**
 * Roles that may be assigned to a newly invited user via the HR/Admin invite flow.
 * `Admin` (and Strapi's built-in `super-admin` authenticated role) are intentionally
 * excluded so an HR user cannot escalate privileges by inviting an Admin account.
 * HR may only assign: Employee or HR.
 * Admin (calling the endpoint) may additionally assign the `Admin` role.
 */
const INVITABLE_ROLE_TYPES_HR = new Set(['employee', 'hr']);
const SUPER_ADMIN_TYPE = 'super-admin';

const publicProfile = (user: any) => ({
  id: user.id,
  fullName: user.fullName,
  email: user.email,
  role: user.role
    ? {
        id: user.role.id,
        name: user.role.name,
        type: user.role.type,
      }
    : null,
  team: user.team
    ? {
        id: user.team.id,
        name: user.team.name,
      }
    : null,
  isActive: user.isActive,
  employeeId: user.employeeId ?? null,
  phone: user.phone ?? null,
  jobTitle: user.jobTitle ?? null,
  employmentStatus: user.employmentStatus ?? 'active',
  startDate: user.startDate ?? null,
  expectedDailyHours: user.expectedDailyHours ?? null,
  agentRequired: user.agentRequired ?? true,
});

const makeTemporaryPassword = () => `${crypto.randomBytes(10).toString('base64url')}7A`;

export default (plugin: StrapiPlugin) => {
  plugin.policies = plugin.policies ?? {};

  plugin.contentTypes.user.schema.attributes.fullName = {
    type: 'string',
    required: true,
  };

  plugin.contentTypes.user.schema.attributes.team = {
    type: 'relation',
    relation: 'manyToOne',
    target: 'api::team.team',
    inversedBy: 'users',
  };

  plugin.contentTypes.user.schema.attributes.isActive = {
    type: 'boolean',
    default: true,
  };

  plugin.contentTypes.user.schema.attributes.employeeId = {
    type: 'string',
  };

  plugin.contentTypes.user.schema.attributes.phone = {
    type: 'string',
  };

  plugin.contentTypes.user.schema.attributes.jobTitle = {
    type: 'string',
  };

  plugin.contentTypes.user.schema.attributes.employmentStatus = {
    type: 'enumeration',
    enum: ['active', 'suspended', 'terminated'],
    default: 'active',
  };

  plugin.contentTypes.user.schema.attributes.startDate = {
    type: 'date',
  };

  plugin.contentTypes.user.schema.attributes.expectedDailyHours = {
    type: 'decimal',
    default: null,
  };

  plugin.contentTypes.user.schema.attributes.agentRequired = {
    type: 'boolean',
    default: true,
  };

  plugin.contentTypes.user.schema.attributes.deletedAt = {
    type: 'datetime',
  };

  ///////
 plugin.contentTypes.user.schema.attributes.sessions = {
  type: 'relation',
  relation: 'oneToMany',
  target: 'api::session.session',
  mappedBy: 'user',
};

plugin.contentTypes.user.schema.attributes.alerts = {
  type: 'relation',
  relation: 'oneToMany',
  target: 'api::alert.alert',
  mappedBy: 'user',
};

plugin.contentTypes.user.schema.attributes.overtimeDeclarations = {
  type: 'relation',
  relation: 'oneToMany',
  target: 'api::overtime-declaration.overtime-declaration',
  mappedBy: 'user',
};

plugin.contentTypes.user.schema.attributes.timeEntries = {
  type: 'relation',
  relation: 'oneToMany',
  target: 'api::time-entry.time-entry',
  mappedBy: 'user',
};

plugin.contentTypes.user.schema.attributes.projects = {
  type: 'relation',
  relation: 'manyToMany',
  target: 'api::project.project',
  mappedBy: 'users',
};

plugin.contentTypes.user.schema.attributes.screenshotAnalyses = {
  type: 'relation',
  relation: 'oneToMany',
  target: 'api::screenshot-analysis.screenshot-analysis',
  mappedBy: 'employee',
};

plugin.contentTypes.user.schema.attributes.agentDevices = {
  type: 'relation',
  relation: 'oneToMany',
  target: 'api::agent-device.agent-device',
  mappedBy: 'employee',
};

plugin.contentTypes.user.schema.attributes.projectTimeAllocations = {
  type: 'relation',
  relation: 'oneToMany',
  target: 'api::project-time-allocation.project-time-allocation',
  mappedBy: 'user',
};

plugin.contentTypes.user.schema.attributes.managedProjects = {
  type: 'relation',
  relation: 'oneToMany',
  target: 'api::project.project',
  mappedBy: 'manager',
};

plugin.contentTypes.user.schema.attributes.leaderOf = {
  type: 'relation',
  relation: 'oneToMany',
  target: 'api::team.team',
  mappedBy: 'leader',
};

  plugin.policies.isHR = (policyContext) => {
    const roleName = policyContext.state?.user?.role?.name;
    return roleName === 'HR' || roleName === 'Admin';
  };

  plugin.policies.isAuthenticatedUser = (policyContext) => {
    return !!policyContext.state?.user?.id;
  };

  const originalAuthFactory = plugin.controllers.auth;
  plugin.controllers.auth = (context: { strapi: Core.Strapi }) => {
    const authController = originalAuthFactory(context);
    const { strapi: strapiInstance } = context;

    return {
      ...authController,
      async forgotPassword(ctx: any) {
        const { email } = ctx.request.body ?? {};
        if (typeof email !== 'string') {
          return ctx.badRequest('Email is required');
        }

        const user = await strapiInstance.db.query(USER_UID).findOne({
          where: { email: email.toLowerCase() },
        });

        if (!user || user.blocked) {
          return ctx.send({ ok: true });
        }

        const resetPasswordToken = crypto.randomBytes(64).toString('hex');

        await strapiInstance.db.query(USER_UID).update({
          where: { id: user.id },
          data: { resetPasswordToken },
        });

        const frontendUrl = (process.env.CORS_ORIGIN || 'http://localhost:4200').split(',')[0].trim();
        const resetUrl = `${frontendUrl}/reset-password?code=${resetPasswordToken}`;

        try {
          await strapiInstance.plugin('email').service('email').send({
            to: user.email,
            from: process.env.SMTP_FROM || 'noreply@assas.app',
            subject: 'Reset your Assas password',
            text: `Click the link to reset your password: ${resetUrl}`,
            html: buildResetPasswordEmail({
              resetUrl,
              intro: 'You requested a password reset for your Assas account. Click the button below to set a new password.',
              note: "If you didn't request this, you can safely ignore this email. Your password will remain unchanged.",
            }),
          });
          strapiInstance.log.info(`[auth] Reset email sent to ${email}`);
        } catch (err: any) {
          strapiInstance.log.warn(`[auth] Failed to send reset email: ${err.message}`);
          strapiInstance.log.info(`[auth] Reset link for ${email}: ${resetUrl}`);
        }

        ctx.send({ ok: true });
      },

      async callback(ctx: any) {
        const identifier = ctx.request.body?.identifier;

        if (typeof identifier === 'string') {
          const user = await strapiInstance.db.query(USER_UID).findOne({
            where: {
              $or: [{ email: identifier.toLowerCase() }, { username: identifier }],
            },
          });

          if (user?.isActive === false) {
            return ctx.unauthorized('This account is inactive. Contact HR for access.');
          }
        }

        return authController.callback(ctx);
      },

      async register(ctx: any) {
        return ctx.forbidden('Public self-registration is disabled. Contact HR for an invite.');
      },

      async me(ctx: any) {
        if (!ctx.state.user) {
          return ctx.unauthorized('Missing authentication');
        }

        const user = await strapiInstance.db.query(USER_UID).findOne({
          where: { id: ctx.state.user.id },
          populate: ['role', 'team'],
        });

        if (!user || user.isActive === false) {
          return ctx.unauthorized('This account is inactive. Contact HR for access.');
        }

        return ctx.send(publicProfile(user));
      },

      async changePassword(ctx: any) {
        const result = await authController.changePassword(ctx);

        if (ctx.state.user?.id) {
          const devices = await strapiInstance.db.query('api::agent-device.agent-device').findMany({
            where: { employee: ctx.state.user.id, active: true },
          });
          const revokedAt = new Date().toISOString();
          for (const d of devices) {
            await strapiInstance.db.query('api::agent-device.agent-device').update({
              where: { id: d.id },
              data: {
                active: false,
                revoked: true,
                revokedAt,
                revokedBy: `password-reset:${ctx.state.user.id}`,
              },
            });
          }
          strapiInstance.log.info(`[auth] All trusted devices revoked for user ${ctx.state.user.id} (password change)`);
        }

        return result;
      },

      async invite(ctx: any) {
        const {
          email, fullName, roleId, teamId,
          phone, jobTitle, employeeId, startDate, expectedDailyHours,
          agentRequired, employmentStatus, password, sendWelcomeEmail,
        } = ctx.request.body ?? {};

        if (typeof email !== 'string' || typeof fullName !== 'string' || !roleId) {
          return ctx.badRequest('email, fullName, and roleId are required.');
        }

        const normalizedEmail = email.toLowerCase();

        const existing = await strapiInstance.db.query(USER_UID).findOne({
          where: { email: normalizedEmail },
        });

        // Soft-deleted accounts no longer "occupy" their email — they can be
        // re-invited (restored) below instead of blocking the invite with a 409.
        if (existing && !existing.deletedAt) {
          return ctx.conflict('A user with that email already exists.');
        }

        let employeeIdCollision: { id: number; deletedAt: string | null } | null = null;
        if (employeeId) {
          employeeIdCollision = await strapiInstance.db.query(USER_UID).findOne({
            where: { employeeId: String(employeeId).trim() },
          });
          if (employeeIdCollision && !employeeIdCollision.deletedAt) {
            return ctx.conflict('That employee ID is already assigned.');
          }
        }

        // Resolve the requested role and enforce an allowlist to prevent privilege
        // escalation (e.g. an HR user cannot create an Admin or super-admin account).
        let targetRole: { id: number; type: string; name: string } | null = null;
        try {
          targetRole = await strapiInstance.db
            .query('plugin::users-permissions.role')
            .findOne({ where: { id: roleId } });
        } catch {
          targetRole = null;
        }

        if (!targetRole) {
          return ctx.badRequest('The specified roleId does not exist.');
        }

        if (targetRole.type === SUPER_ADMIN_TYPE) {
          return ctx.forbidden('Inviting a super-admin account is not permitted.');
        }

        const inviterRoleName = ctx.state?.user?.role?.name;
        const inviterIsAdmin = inviterRoleName === 'Admin';

        const roleIsInvitable = inviterIsAdmin
          ? INVITABLE_ROLE_TYPES_HR.has(targetRole.type) || targetRole.type === 'admin'
          : INVITABLE_ROLE_TYPES_HR.has(targetRole.type);

        if (!roleIsInvitable) {
          return ctx.forbidden(
            inviterIsAdmin
              ? 'Admin can only assign Employee, HR, or Admin roles.'
              : 'HR can only assign Employee or HR roles.',
          );
        }

        // Validate teamId references an existing Team when provided.
        if (teamId !== undefined && teamId !== null && teamId !== '') {
          const team = await strapiInstance.db
            .query('api::team.team')
            .findOne({ where: { id: teamId } });

          if (!team) {
            return ctx.badRequest('The specified teamId does not exist.');
          }
        }

        // A compliant password is either supplied by the inviter (HR/Admin) or
        // generated as a temporary password. Either way it must satisfy the same
        // policy enforced by the plugin (`config/plugins.ts` validationRules.password).
        let effectivePassword: string;
        let temporaryPassword: string | null = null;

        if (typeof password === 'string' && password.length > 0) {
          if (!PASSWORD_PATTERN.test(password)) {
            return ctx.badRequest('Password must be at least 10 characters and contain at least one number.');
          }
          effectivePassword = password;
        } else {
          temporaryPassword = makeTemporaryPassword();
          if (!PASSWORD_PATTERN.test(temporaryPassword)) {
            strapiInstance.log.error('[auth invite] generated temporary password failed policy check');
            return ctx.internalServerError('Could not generate a compliant temporary password. Retry the invite.');
          }
          effectivePassword = temporaryPassword;
        }

        const resetPasswordToken = crypto.randomBytes(32).toString('hex');

        // Employee IDs are auto-generated on the backend when HR does not supply
        // one (the Add/Edit forms no longer expose the field). Collisions are
        // retried; the timestamp fallback is effectively collision-free.
        const makeEmployeeId = async (): Promise<string> => {
          for (let attempt = 0; attempt < 12; attempt++) {
            const candidate = `EMP-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
            const clash = await strapiInstance.db.query(USER_UID).findOne({
              where: { employeeId: candidate },
            });
            if (!clash) return candidate;
          }
          return `EMP-${Date.now().toString(36).toUpperCase()}`;
        };

        const userService = () => strapiInstance.plugin('users-permissions').service('user');
        const userData = {
          username: normalizedEmail,
          email: normalizedEmail,
          password: effectivePassword,
          fullName,
          isActive: true,
          blocked: false,
          confirmed: true,
          role: targetRole.id,
          team: teamId || null,
          employeeId: employeeId ? String(employeeId).trim() : await makeEmployeeId(),
          phone: phone?.trim() || null,
          jobTitle: jobTitle?.trim() || null,
          startDate: startDate || null,
          expectedDailyHours: expectedDailyHours != null && Number(expectedDailyHours) > 0 ? Number(expectedDailyHours) : null,
          agentRequired: agentRequired === undefined ? true : !!agentRequired,
          employmentStatus: employmentStatus || 'active',
          resetPasswordToken,
        };

        let user;
        if (existing && existing.deletedAt) {
          // Re-invite: the email column is unique, so resurrect the soft-deleted
          // record instead of creating a duplicate. Account history (sessions,
          // breaks, alerts) is preserved and the account is reactivated.
          // `deletedAt` must be cleared via the raw query layer: the Document
          // Service used by userService().edit() does not apply null values, so
          // it would otherwise leave the account hidden from every list.
          if (employeeIdCollision && employeeIdCollision.id !== existing.id) {
            await strapiInstance.db.query(USER_UID).update({
              where: { id: employeeIdCollision.id },
              data: { employeeId: null },
            });
          }
          const hashedPassword = (await userService().ensureHashedPasswords({ password: effectivePassword })).password;
          user = await strapiInstance.db.query(USER_UID).update({
            where: { id: existing.id },
            data: { ...userData, password: hashedPassword, deletedAt: null },
          });
          strapiInstance.log.info(
            `[auth invite] ${fullName} <${email}> re-invited — restored soft-deleted account #${existing.id}`
          );
        } else {
          // A soft-deleted account may still hold the requested employee ID.
          // Free it so a brand-new employee can be created with the same ID.
          if (employeeIdCollision && employeeIdCollision.deletedAt) {
            await strapiInstance.db.query(USER_UID).update({
              where: { id: employeeIdCollision.id },
              data: { employeeId: null },
            });
          }
          user = await userService().add({
            ...userData,
            provider: 'local',
          });
          strapiInstance.log.info(
            `[auth invite] ${fullName} <${email}> invited — password-reset token generated`
          );
        }

        const invitedUser = await strapiInstance.db.query(USER_UID).findOne({
          where: { id: user.id },
          populate: ['role', 'team'],
        });

        // Best-effort welcome email with a password-set link. Falls back to the
        // reset token being returned in the response (and a server log) so the
        // inviter can still relay credentials when email is unavailable.
        if (sendWelcomeEmail !== false) {
          const frontendUrl = (process.env.CORS_ORIGIN || 'http://localhost:4200').split(',')[0].trim();
          const setPasswordUrl = `${frontendUrl}/set-initial-password?code=${resetPasswordToken}`;
          try {
            await strapiInstance.plugin('email').service('email').send({
              to: invitedUser.email,
              from: process.env.SMTP_FROM || 'noreply@assas.app',
              subject: 'Welcome to Assas — set up your account',
              text: `Your account has been created. Set your password here: ${setPasswordUrl}`,
              html: buildWelcomeEmail(fullName, setPasswordUrl),
            });
            strapiInstance.log.info(`[auth invite] Welcome email sent to ${email}`);
          } catch (err: any) {
            strapiInstance.log.warn(`[auth invite] Failed to send welcome email: ${err.message}`);
            strapiInstance.log.info(`[auth invite] Set-password link for ${email}: ${setPasswordUrl}`);
          }
        }

        return ctx.created({
          user: publicProfile(invitedUser),
          inviteToken: resetPasswordToken,
          // Only surface the plaintext temporary password when the welcome email
          // was NOT sent (the inviter must relay it manually in that case).
          temporaryPassword: sendWelcomeEmail === false ? temporaryPassword : null,
        });
      },
    };
  };

  plugin.routes['content-api'].routes.push(
    {
      method: 'GET',
      path: '/auth/me',
      handler: 'auth.me',
      config: {
        prefix: '',
        // Let Strapi's default users-permissions auth strategy populate
        // ctx.state.user. This is required for compatibility with the
        // session-based refresh system (jwtManagement: 'refresh' in
        // config/plugin.ts) — a manual jwtService.verify() bypass does NOT
        // check session validity and can wrongly reject tokens that are
        // actually valid, which caused a refresh/me/logout retry loop.
      },
    },
    {
      method: 'POST',
      path: '/auth/invite',
      handler: 'auth.invite',
      config: {
        prefix: '',
        policies: ['plugin::users-permissions.isHR'],
      },
    }
  );

  return plugin;
};
