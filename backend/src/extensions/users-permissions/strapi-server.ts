import crypto from 'node:crypto';
import type { Core } from '@strapi/strapi';

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
        const { email, fullName, roleId, teamId } = ctx.request.body ?? {};

        if (typeof email !== 'string' || typeof fullName !== 'string' || !roleId) {
          return ctx.badRequest('email, fullName, and roleId are required.');
        }

        const normalizedEmail = email.toLowerCase();

        const existing = await strapiInstance.db.query(USER_UID).findOne({
          where: { email: normalizedEmail },
        });

        if (existing) {
          return ctx.conflict('A user with that email already exists.');
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

        const temporaryPassword = makeTemporaryPassword();

        // Defense-in-depth: assert the generated temp password satisfies the same
        // policy enforced by the plugin (`config/plugins.ts` validationRules.password).
        if (!PASSWORD_PATTERN.test(temporaryPassword)) {
          strapiInstance.log.error('[auth invite] generated temporary password failed policy check');
          return ctx.internalServerError('Could not generate a compliant temporary password. Retry the invite.');
        }

        const resetPasswordToken = crypto.randomBytes(32).toString('hex');

        const user = await strapiInstance.plugin('users-permissions').service('user').add({
          username: normalizedEmail,
          email: normalizedEmail,
          password: temporaryPassword,
          provider: 'local',
          confirmed: true,
          blocked: false,
          fullName,
          isActive: true,
          role: targetRole.id,
          team: teamId || null,
          resetPasswordToken,
        });

        strapiInstance.log.info(
          `[auth invite] ${fullName} <${email}> invited — password-reset token generated`
        );

        const invitedUser = await strapiInstance.db.query(USER_UID).findOne({
          where: { id: user.id },
          populate: ['role', 'team'],
        });

        return ctx.created({
          user: publicProfile(invitedUser),
          inviteToken: resetPasswordToken,
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
