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
        accessTokenLifespan: env.int('SESSION_ACCESS_TOKEN_LIFESPAN', 60 * 60),
        maxRefreshTokenLifespan: env.int('SESSION_MAX_REFRESH_LIFESPAN', 7 * 24 * 60 * 60),
        idleRefreshTokenLifespan: env.int('SESSION_IDLE_REFRESH_LIFESPAN', 7 * 24 * 60 * 60),
        httpOnly: true,
        cookie: {
          sameSite: 'lax',
          secure: env.bool('SESSION_COOKIE_SECURE', false),
          name: 'rws_refresh',
        },
      },
      ratelimit: {
        interval: env.int('SESSION_RATELIMIT_INTERVAL', 60_000),
        max: env.int('SESSION_RATELIMIT_MAX', 5),
      },
    },
  },
  email: {
    config: {
      provider: 'nodemailer',
      providerOptions: {
        host: env('SMTP_HOST', 'smtp.gmail.com'),
        port: env.int('SMTP_PORT', 587),
        secure: env.bool('SMTP_SECURE', false),
        auth: {
          user: env('SMTP_USER'),
          pass: env('SMTP_PASS'),
        },
      },
      settings: {
        defaultFrom: env('SMTP_FROM', 'noreply@assas.app'),
        defaultReplyTo: env('SMTP_FROM', 'noreply@assas.app'),
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
