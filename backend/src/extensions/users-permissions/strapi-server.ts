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
            html: `
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
              </head>
              <body style="margin:0;padding:0;background-color:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,sans-serif;">
                <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;min-height:100vh;">
                  <tr>
                    <td align="center" style="padding:40px 16px;">
                      <table width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;">
                        <tr>
                          <td align="center" style="padding:0 0 32px;">
                            <span style="font-size:24px;font-weight:800;color:#1e293b;letter-spacing:-0.03em;">Assas</span>
                          </td>
                        </tr>
                        <tr>
                          <td style="background-color:#ffffff;border-radius:12px;padding:40px 36px;box-shadow:0 1px 3px rgba(0,0,0,0.04),0 1px 2px rgba(0,0,0,0.06);">
                            <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#1e293b;">Reset your password</h1>
                            <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#64748b;">
                              You requested a password reset for your Assas account. Click the button below to set a new password.
                            </p>
                            <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                              <tr>
                                <td align="center" style="background-color:#2563eb;border-radius:8px;padding:12px 32px;">
                                  <a href="${resetUrl}" style="color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;display:inline-block;">
                                    Reset password
                                  </a>
                                </td>
                              </tr>
                            </table>
                            <p style="margin:0 0 8px;font-size:14px;line-height:1.5;color:#94a3b8;">
                              Or copy this link into your browser:
                            </p>
                            <p style="margin:0 0 24px;font-size:13px;line-height:1.5;color:#64748b;word-break:break-all;">
                              <a href="${resetUrl}" style="color:#2563eb;">${resetUrl}</a>
                            </p>
                            <hr style="border:none;border-top:1px solid #e2e8f0;margin:0 0 24px;">
                            <p style="margin:0;font-size:13px;line-height:1.5;color:#94a3b8;">
                              If you didn't request this, you can safely ignore this email. Your password will remain unchanged.
                            </p>
                          </td>
                        </tr>
                        <tr>
                          <td align="center" style="padding:24px 0 0;">
                            <p style="margin:0;font-size:12px;color:#94a3b8;">Assas — Remote Work Supervisor</p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </body>
              </html>
            `.trim(),
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
