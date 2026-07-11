import type { Core } from '@strapi/strapi';

const allowedMediaTypes = [
  'image/*',
  'video/*',
  'audio/*',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.*',
  'text/plain',
  'text/csv',
];

const deniedExecutableTypes = [
  'application/vnd.microsoft.portable-executable',
  'application/x-msdownload',
  'application/x-msdos-program',
  'application/x-executable',
  'application/x-dosexec',
  'application/x-sh',
  'text/x-shellscript',
  'application/x-mach-binary',
];

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Plugin => ({
  'users-permissions': {
    config: {
      jwtManagement: 'refresh',
      validationRules: {
        password: {
          minLength: 10,
          regex: /^(?=.*\d).{10,}$/,
        },
      },
      sessions: {
        accessTokenLifespan: 60 * 60,
        maxRefreshTokenLifespan: 7 * 24 * 60 * 60,
        idleRefreshTokenLifespan: 7 * 24 * 60 * 60,
        httpOnly: true,
        cookie: {
          sameSite: 'lax',
          secure: env.bool('SESSION_COOKIE_SECURE', false),
          name: 'rws_refresh',
        },
      },
      ratelimit: {
        interval: 60_000,
        max: 5,
      },
    },
  },
  upload: {
    config: {
      security: {
        allowedTypes: allowedMediaTypes,
        deniedTypes: deniedExecutableTypes,
      },
    },
  },
});

export default config;
