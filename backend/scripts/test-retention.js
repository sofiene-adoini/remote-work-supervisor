/**
 * Runner: boots Strapi programmatically and runs retention integration tests.
 *
 * Usage:  npx --yes tsx scripts/test-retention.js
 *
 * Reads database credentials from the .env file in the backend root.
 */

const fs = require('fs');
const path = require('path');
const { createStrapi } = require('@strapi/strapi');

const ROOT = path.resolve(__dirname, '..');

function loadEnv(envPath) {
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const val = line.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = val;
  }
}

loadEnv(path.join(ROOT, '.env'));

async function main() {
  const app = createStrapi({
    dir: ROOT,
    distDir: path.join(ROOT, 'dist'),
    distClientDir: path.join(ROOT, '.strapi', 'client'),
    appDir: ROOT,
    serveAdminPanel: false,
    quiet: true,
    config: {
      host: '0.0.0.0',
      port: 1338,
      app: {
        keys: (process.env.APP_KEYS || '').split(',').filter(Boolean),
      },
    },
    database: {
      connection: {
        client: process.env.DATABASE_CLIENT || 'postgres',
        connection: {
          host: process.env.DATABASE_HOST || '127.0.0.1',
          port: parseInt(process.env.DATABASE_PORT || '5432', 10),
          database: process.env.DATABASE_NAME || 'remote_work_supervisor',
          user: process.env.DATABASE_USERNAME || 'postgres',
          password: process.env.DATABASE_PASSWORD || '',
          ssl: process.env.DATABASE_SSL === 'true',
          schema: 'public',
        },
        pool: { min: 2, max: 10 },
        acquireConnectionTimeout: 60000,
      },
    },
  });

  await app.load();

  try {
    const { runRetentionTests } = require('../src/api/screenshot-analysis/__tests__/screenshot-retention.test');
    await runRetentionTests();
  } finally {
    await app.destroy();
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
