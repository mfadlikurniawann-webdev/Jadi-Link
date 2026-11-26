// PM2 process file for jadi.click: the Nest API and the Next.js dashboard.
// Usage on the VPS (from the repository root):
//   pm2 startOrReload deploy/pm2/ecosystem.config.cjs --update-env
const path = require('node:path');

module.exports = {
  apps: [
    {
      name: 'jadi-link-api',
      cwd: path.resolve(__dirname, '../../backend'),
      script: 'dist/main.js',
      // Redirect cache, throttling and the click buffer live in one process.
      // Never switch to cluster mode or more than one instance.
      exec_mode: 'fork',
      instances: 1,
      // ConfigModule reads backend/.env; only force production mode here.
      env: { NODE_ENV: 'production' },
      // Nest handles SIGINT: Fastify finishes requests, then the click buffer
      // drains (with one retry) before Prisma disconnects.
      kill_timeout: 20000,
      listen_timeout: 15000,
      max_memory_restart: '350M',
      autorestart: true,
      exp_backoff_restart_delay: 200,
      max_restarts: 15,
      min_uptime: '10s',
      time: true,
    },
    {
      name: 'jadi-link-web',
      cwd: path.resolve(__dirname, '../../frontend'),
      // Next.js dashboard, built by deploy/scripts/deploy.sh with NEXT_PUBLIC_API_URL.
      script: 'node_modules/next/dist/bin/next',
      args: 'start --hostname 127.0.0.1 --port 3000',
      exec_mode: 'fork',
      instances: 1,
      env: { NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1' },
      kill_timeout: 10000,
      listen_timeout: 15000,
      max_memory_restart: '300M',
      autorestart: true,
      exp_backoff_restart_delay: 200,
      max_restarts: 15,
      min_uptime: '10s',
      time: true,
    },
  ],
};
