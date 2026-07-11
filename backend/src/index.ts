import type { Core } from '@strapi/strapi';

export default {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register(/* { strapi }: { strapi: Core.Strapi } */) {},

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
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
