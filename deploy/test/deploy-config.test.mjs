// Contract tests for deployment files. Run: node --test deploy/test
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const deployDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const repoDir = join(deployDir, '..');
const read = (path) => readFileSync(join(deployDir, path), 'utf8');
const require = createRequire(import.meta.url);

test('PM2 runs exactly one fork-mode API process from backend/dist', () => {
  const { apps } = require(join(deployDir, 'pm2/ecosystem.config.cjs'));
  assert.equal(apps.length, 1);
  const [app] = apps;
  assert.equal(app.exec_mode, 'fork');
  assert.equal(app.instances, 1);
  assert.equal(app.cwd, join(repoDir, 'backend'));
  assert.equal(app.script, 'dist/main.js');
  assert.equal(app.env.NODE_ENV, 'production');
  // Leaves time for Fastify to finish requests and the click buffer to drain.
  assert.ok(app.kill_timeout >= 15000);
  assert.ok(existsSync(join(repoDir, 'backend/package.json')));
});

const nginx = read('nginx/jadi-link.conf');
const servers = nginx
  .split(/\n(?=server \{)/)
  .filter((block) => block.startsWith('server {'));
const siteServers = servers.filter((block) =>
  /server_name link\.example\.com;/.test(block),
);

const tlsServer = siteServers.find((block) => block.includes('listen 443'));
const httpServer = siteServers.find((block) => block.includes('listen 80;'));

test('nginx serves the site directly, without Cloudflare-only gates', () => {
  assert.equal(siteServers.length, 2);
  assert.doesNotMatch(nginx, /\/etc\/(nginx\/snippets|ssl)\/cloudflare/);
  assert.doesNotMatch(nginx, /ssl_verify_client|deny all;/);
});

test("nginx uses Let's Encrypt certificates over modern TLS", () => {
  assert.ok(tlsServer);
  assert.match(
    tlsServer,
    /ssl_certificate +\/etc\/letsencrypt\/live\/link\.example\.com\/fullchain\.pem;/,
  );
  assert.match(
    tlsServer,
    /ssl_certificate_key \/etc\/letsencrypt\/live\/link\.example\.com\/privkey\.pem;/,
  );
  assert.match(tlsServer, /ssl_protocols TLSv1\.2 TLSv1\.3;/);
});

test('HTTP serves ACME challenges and redirects everything else', () => {
  assert.ok(httpServer);
  const acme = httpServer.indexOf('location ^~ /.well-known/acme-challenge/ {');
  assert.ok(acme > 0, 'ACME challenge location missing');
  assert.match(httpServer, /root \/var\/www\/html;/);
  assert.match(httpServer, /try_files \$uri =404;/);
  assert.match(httpServer, /return 301 https:\/\/\$host\$request_uri;/);
  assert.doesNotMatch(httpServer, /proxy_pass/);
});

test('unknown hosts are refused by default servers', () => {
  const defaults = servers.filter((block) => block.includes('default_server'));
  assert.equal(defaults.length, 2);
  assert.ok(defaults.some((block) => block.includes('return 444;')));
  assert.ok(
    defaults.some((block) => block.includes('ssl_reject_handshake on;')),
  );
});

test('nginx proxies to loopback with safe forwarding headers', () => {
  assert.match(nginx, /server 127\.0\.0\.1:3001;/);
  assert.match(nginx, /proxy_set_header X-Forwarded-For \$remote_addr;/);
  assert.doesNotMatch(nginx, /proxy_add_x_forwarded_for/);
  assert.match(nginx, /client_max_body_size 64k;/);
  // Without Cloudflare, client-sent CF headers must never reach the API.
  assert.match(nginx, /proxy_set_header CF-Connecting-IP "";/);
  assert.match(nginx, /proxy_set_header CF-IPCountry "";/);
  assert.doesNotMatch(nginx, /\$http_cf_/);
});

test('access log format does not record visitor IPs', () => {
  const format = nginx.match(/log_format jadi_link([^;]+);/);
  assert.ok(format);
  for (const variable of [
    '$remote_addr',
    '$http_cf_connecting_ip',
    '$http_x_forwarded_for',
    '$args',
    '$request_uri',
  ]) {
    assert.ok(!format[1].includes(variable), `${variable} must not be logged`);
  }
});

test('production env template is safe and has no real secrets', () => {
  const env = Object.fromEntries(
    read('env/backend.production.env.example')
      .split('\n')
      .filter((line) => /^[A-Z_]+=/.test(line))
      .map((line) => [
        line.slice(0, line.indexOf('=')),
        line.slice(line.indexOf('=') + 1),
      ]),
  );
  assert.equal(env.NODE_ENV, 'production');
  assert.equal(env.HOST, '127.0.0.1');
  assert.equal(env.PORT, '3001');
  assert.equal(env.TRUST_PROXY, '127.0.0.1,::1');
  for (const key of ['FRONTEND_ORIGIN', 'SHORT_LINK_BASE_URL']) {
    const url = new URL(env[key]);
    assert.equal(url.protocol, 'https:');
    assert.equal(url.pathname, '/');
  }
  assert.match(env.JWT_SECRET, /^replace-with-/);
  assert.match(env.VISITOR_HASH_SECRET, /^replace-with-/);
  assert.match(env.DATABASE_URL, /USER:PASSWORD@YOUR-ENDPOINT/);
  assert.match(env.DATABASE_URL, /sslmode=verify-full/);
});

test('shell scripts fail fast', () => {
  for (const script of ['scripts/deploy-backend.sh', 'test/nginx-smoke.sh']) {
    const source = read(script);
    assert.ok(source.startsWith('#!/usr/bin/env bash\n'), script);
    assert.match(source, /^set -euo pipefail$/m, script);
  }
});

test('deploy script migrates before reloading and checks health', () => {
  const source = read('scripts/deploy-backend.sh');
  const order = [
    'git merge --ff-only',
    'npm ci',
    'npm run build',
    'npm run prisma:deploy',
    'npm prune --omit=dev',
    'pm2 startOrReload deploy/pm2/ecosystem.config.cjs',
    'HEALTH_URL',
  ].map((step) => source.lastIndexOf(step));
  for (const [index, position] of order.entries()) {
    assert.ok(position >= 0, `missing step ${index}`);
    if (index > 0 && index < order.length - 1)
      assert.ok(position > order[index - 1], `step ${index} out of order`);
  }
  const commands = source
    .split('\n')
    .filter((line) => !line.trim().startsWith('#'))
    .join('\n');
  assert.doesNotMatch(commands, /migrate dev|--force|reset --hard/);
});
