// PM2 process file for the Jadi Link API.
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
  ],
};
