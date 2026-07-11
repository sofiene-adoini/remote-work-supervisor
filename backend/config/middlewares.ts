import type { Core } from '@strapi/strapi';

const config: Core.Config.Middlewares = [
  'strapi::logger',
  'strapi::errors',
  'strapi::security',
  {
    name: 'strapi::cors',
    config: {
      // The refresh token is delivered as an httpOnly cookie, so browser-based
      // clients (the Angular web app) need `credentials: true` to both receive and
      // later send it. Browsers refuse to send credentials cross-origin unless the
      // server echoes a specific origin (NOT '*') and `Access-Control-Allow-Credentials: true`.
      // Configure CORS_ORIGIN in .env as a comma-separated list of allowed origins.
      // When left empty, fall back to Strapi's default behaviour (no credentials).
      headers: '*',
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
      credentials: true,
      origin: (env: NodeJS.ProcessEnv) => {
        const raw = env.CORS_ORIGIN;
        if (!raw) return ['*'];
        return raw
          .split(',')
          .map((o) => o.trim())
          .filter(Boolean);
      },
    },
  },
  'strapi::poweredBy',
  'strapi::query',
  'strapi::body',
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];

export default config;
