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

const { apps } = require(join(deployDir, 'pm2/ecosystem.config.cjs'));
const app = (name) => apps.find((candidate) => candidate.name === name);

test('PM2 runs one fork-mode API process and one dashboard process', () => {
  assert.deepEqual(apps.map((candidate) => candidate.name).sort(), [
    'jadi-link-api',
    'jadi-link-web',
  ]);
  for (const candidate of apps) {
    assert.equal(candidate.exec_mode, 'fork', candidate.name);
    assert.equal(candidate.instances, 1, candidate.name);
    assert.equal(candidate.env.NODE_ENV, 'production', candidate.name);
  }
});

test('PM2 API process runs backend/dist and drains clicks on shutdown', () => {
  const api = app('jadi-link-api');
  assert.equal(api.cwd, join(repoDir, 'backend'));
  assert.equal(api.script, 'dist/main.js');
  // Leaves time for Fastify to finish requests and the click buffer to drain.
  assert.ok(api.kill_timeout >= 15000);
  assert.ok(existsSync(join(repoDir, 'backend/package.json')));
});

test('PM2 dashboard process runs next start on loopback only', () => {
  const web = app('jadi-link-web');
  assert.equal(web.cwd, join(repoDir, 'frontend'));
  assert.equal(web.script, 'node_modules/next/dist/bin/next');
  assert.equal(web.args, 'start --hostname 127.0.0.1 --port 3000');
  assert.ok(existsSync(join(repoDir, 'frontend/package.json')));
});

const nginx = read('nginx/jadi-link.conf');
const servers = nginx
  .split(/\n(?=server \{)/)
  .filter((block) => block.startsWith('server {'));
const siteServers = servers.filter((block) =>
  /server_name (www\.)?jadi\.click[ ;]/.test(block),
);
const httpServer = siteServers.find((block) => block.includes('listen 80;'));
const wwwServer = siteServers.find((block) =>
  block.includes('server_name www.jadi.click;'),
);
const appServer = siteServers.find((block) =>
  block.includes('server_name jadi.click;'),
);

test('nginx serves jadi.click directly, without Cloudflare-only gates', () => {
  assert.equal(siteServers.length, 3);
  assert.ok(httpServer && wwwServer && appServer);
  assert.doesNotMatch(nginx, /example\.com/);
  assert.doesNotMatch(nginx, /\/etc\/(nginx\/snippets|ssl)\/cloudflare/);
  assert.doesNotMatch(nginx, /ssl_verify_client|deny all;/);
});

test("nginx uses the Let's Encrypt jadi.click certificate over modern TLS", () => {
  for (const block of [wwwServer, appServer]) {
    assert.match(
      block,
      /ssl_certificate +\/etc\/letsencrypt\/live\/jadi\.click\/fullchain\.pem;/,
    );
    assert.match(
      block,
      /ssl_certificate_key \/etc\/letsencrypt\/live\/jadi\.click\/privkey\.pem;/,
    );
    assert.match(block, /ssl_protocols TLSv1\.2 TLSv1\.3;/);
  }
});

test('HTTP serves ACME challenges and redirects to the canonical host', () => {
  assert.match(httpServer, /server_name jadi\.click www\.jadi\.click;/);
  assert.ok(
    httpServer.includes('location ^~ /.well-known/acme-challenge/ {'),
    'ACME challenge location missing',
  );
  assert.match(httpServer, /root \/var\/www\/html;/);
  assert.match(httpServer, /try_files \$uri =404;/);
  assert.match(httpServer, /return 301 https:\/\/jadi\.click\$request_uri;/);
  assert.doesNotMatch(httpServer, /proxy_pass/);
  assert.match(wwwServer, /return 301 https:\/\/jadi\.click\$request_uri;/);
  assert.doesNotMatch(wwwServer, /proxy_pass/);
});

test('unknown hosts are refused by default servers', () => {
  const defaults = servers.filter((block) => block.includes('default_server'));
  assert.equal(defaults.length, 2);
  assert.ok(defaults.some((block) => block.includes('return 444;')));
  assert.ok(
    defaults.some((block) => block.includes('ssl_reject_handshake on;')),
  );
});

// Location blocks of the jadi.click TLS server (comments removed), with upstream.
const appServerCode = appServer.replace(/#.*$/gm, '');
const locationPattern = /^\s*location ([^{]+)\{([^}]*)\}/gm;
const locations = [...appServerCode.matchAll(locationPattern)].map(
  ([, selector, body]) => ({
    selector: selector.trim(),
    upstream: body.match(/proxy_pass http:\/\/(\w+);/)?.[1],
  }),
);

test('nginx routes dashboard pages to Next.js and the rest to the API', () => {
  const upstreamOf = (selector) =>
    locations.find((location) => location.selector === selector)?.upstream;
  assert.equal(upstreamOf('= /'), 'jadi_link_web');
  assert.equal(upstreamOf('^~ /_next/'), 'jadi_link_web');
  assert.equal(
    upstreamOf('~ ^/(login|register|dashboard|links)(/|$)'),
    'jadi_link_web',
  );
  assert.equal(upstreamOf('^~ /api/'), 'jadi_link_api');
  // Short links (/:code) fall through to the API.
  assert.equal(upstreamOf('/'), 'jadi_link_api');
  assert.match(
    nginx,
    /upstream jadi_link_api \{\s+[^}]*server 127\.0\.0\.1:3001;/,
  );
  assert.match(
    nginx,
    /upstream jadi_link_web \{\s+[^}]*server 127\.0\.0\.1:3000;/,
  );
});

test('every dashboard path routed to Next.js is a reserved short-link alias', () => {
  const constants = readFileSync(
    join(repoDir, 'backend/src/links/links.constants.ts'),
    'utf8',
  );
  const reserved = new Set(
    [
      ...constants
        .match(/RESERVED_ALIASES[^[]*\[([^\]]*)\]/)[1]
        .matchAll(/'([^']+)'/g),
    ].map(([, alias]) => alias),
  );
  const webPaths = locations
    .filter((location) => location.upstream === 'jadi_link_web')
    .flatMap(({ selector }) => {
      const group = selector.match(/\^\/\(([^)]+)\)/);
      if (group) return group[1].split('|');
      return [selector.replace(/^(=|\^~)\s*\//, '').split(/[/.]/)[0]];
    })
    .filter(Boolean);
  assert.ok(webPaths.includes('dashboard'));
  for (const path of webPaths) {
    // Aliases must start with a letter or digit, so "_next" can never clash.
    if (!/^[A-Za-z0-9]/.test(path)) continue;
    assert.ok(reserved.has(path), `${path} must be a reserved alias`);
  }
});

test('nginx proxies to loopback with safe forwarding headers', () => {
  assert.match(nginx, /proxy_set_header X-Forwarded-For \$remote_addr;/);
  assert.doesNotMatch(nginx, /proxy_add_x_forwarded_for/);
  assert.match(nginx, /client_max_body_size 64k;/);
  // Without Cloudflare, client-sent CF headers must never reach the API.
  assert.match(nginx, /proxy_set_header CF-Connecting-IP "";/);
  assert.match(nginx, /proxy_set_header CF-IPCountry "";/);
  assert.doesNotMatch(nginx, /\$http_cf_/);
  // Shared headers live at server level so every location inherits them.
  for (const location of appServerCode.matchAll(locationPattern)) {
    assert.doesNotMatch(location[2], /proxy_set_header/);
  }
});

test('HSTS is sent once for both upstreams', () => {
  assert.match(
    appServer,
    /add_header Strict-Transport-Security "max-age=\d+; includeSubDomains" always;/,
  );
  for (const selector of ['^~ /api/', '/']) {
    const block = appServer.match(
      new RegExp(
        `location ${selector.replace(/[\^~/]/g, (c) => `\\${c}`)} \\{([^}]*)\\}`,
      ),
    );
    assert.ok(block, selector);
    assert.match(block[1], /proxy_hide_header Strict-Transport-Security;/);
  }
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
    assert.equal(env[key], 'https://jadi.click', key);
  }
  assert.match(env.JWT_SECRET, /^replace-with-/);
  assert.match(env.VISITOR_HASH_SECRET, /^replace-with-/);
  assert.match(env.DATABASE_URL, /USER:PASSWORD@YOUR-ENDPOINT/);
  assert.match(env.DATABASE_URL, /sslmode=verify-full/);
});

test('shell scripts fail fast', () => {
  for (const script of ['scripts/deploy.sh', 'test/nginx-smoke.sh']) {
    const source = read(script);
    assert.ok(source.startsWith('#!/usr/bin/env bash\n'), script);
    assert.match(source, /^set -euo pipefail$/m, script);
  }
});

test('deploy script builds both apps, migrates before reload, checks health', () => {
  const source = read('scripts/deploy.sh');
  const commands = source
    .split('\n')
    .filter((line) => !line.trim().startsWith('#'))
    .join('\n');
  const steps = [
    'git merge --ff-only',
    'cd backend\nnpm ci',
    'npm run prisma:deploy',
    'npm prune --omit=dev',
    'cd frontend\nnpm ci',
    'NEXT_PUBLIC_API_URL="$api_url" npm run build',
    'pm2 startOrReload deploy/pm2/ecosystem.config.cjs',
    'wait_for API "$HEALTH_URL"',
    'wait_for dashboard "$WEB_URL"',
  ];
  let previous = -1;
  for (const step of steps) {
    const position = commands.indexOf(step, previous + 1);
    assert.ok(position > previous, `step out of order or missing: ${step}`);
    previous = position;
  }
  assert.match(commands, /api_url="\$\{short_link_base%\/\}\/api"/);
  assert.doesNotMatch(commands, /migrate dev|--force|reset --hard/);
});
