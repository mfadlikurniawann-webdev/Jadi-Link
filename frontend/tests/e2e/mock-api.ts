import { randomUUID } from 'node:crypto';
import type { Page } from '@playwright/test';
import type { Analytics, ShortLink } from '../../src/lib/types';

export const TEST_TOKEN = 'browser-test-token-not-a-real-jwt';
export const LINK_ID = '22222222-2222-4222-8222-222222222222';
export const fixtureLink: ShortLink = {
  id: LINK_ID,
  code: 'hello-world',
  shortUrl: 'https://s.example.com/hello-world',
  targetUrl: 'https://example.com/article',
  isActive: true,
  expiresAt: null,
  createdAt: '2026-11-20T12:00:00Z',
};

export function analyticsFor(id: string): Analytics {
  const dailyClicks = Array.from({ length: 30 }, (_, index) => ({
    date: new Date(Date.UTC(2026, 9, 28 + index)).toISOString().slice(0, 10),
    clicks: index === 4 || index === 18 || index === 29 ? 2 : 0,
  }));
  return {
    linkId: id,
    period: {
      timezone: 'UTC',
      days: 30,
      from: '2026-10-28T00:00:00Z',
      to: '2026-11-26T12:00:00Z',
    },
    totalClicks: 27,
    clicksLast30Days: 6,
    uniqueVisitorsLast30Days: 3,
    dailyClicks,
    topReferrers: [
      { referrer: 'search.example', clicks: 4 },
      { referrer: null, clicks: 2 },
    ],
    countries: [
      { country: 'ID', clicks: 4 },
      { country: null, clicks: 2 },
    ],
    devices: [
      { device: 'mobile', clicks: 4 },
      { device: 'desktop', clicks: 2 },
      { device: 'tablet', clicks: 0 },
      { device: 'bot', clicks: 0 },
      { device: 'unknown', clicks: 0 },
    ],
  };
}

export async function mockApi(page: Page, seed: ShortLink[] = []) {
  const state = {
    links: [...seed],
    authStatus: 200,
    listStatus: 200,
    analyticsStatus: 200,
    unauthorized: false,
    writes: [] as { method: string; body: Record<string, unknown> }[],
  };
  await page.route('http://127.0.0.1:3101/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.slice(4);
    const method = request.method();
    const headers = {
      'access-control-allow-origin': 'http://127.0.0.1:3100',
      'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
      'access-control-allow-headers': 'Content-Type,Authorization',
      'access-control-expose-headers': 'Retry-After',
      'Retry-After': '6',
    };
    const respond = (status: number, json: unknown) =>
      route.fulfill({ status, json, headers });
    if (method === 'OPTIONS') {
      await route.fulfill({ status: 204, headers });
      return;
    }
    if (path === '/auth/login' || path === '/auth/register') {
      if (state.authStatus !== 200) {
        await respond(state.authStatus, {
          message: 'Invalid email or password',
        });
        return;
      }
      const body = request.postDataJSON() as { email: string };
      await respond(path.endsWith('register') ? 201 : 200, {
        accessToken: TEST_TOKEN,
        tokenType: 'Bearer',
        expiresIn: 900,
        user: {
          id: '11111111-1111-4111-8111-111111111111',
          email: body.email,
          createdAt: '2026-01-01T00:00:00Z',
        },
      });
      return;
    }
    if (
      state.unauthorized ||
      request.headers().authorization !== `Bearer ${TEST_TOKEN}`
    ) {
      await respond(401, { message: 'Invalid or expired access token' });
      return;
    }
    if (path === '/links' && method === 'GET') {
      if (state.listStatus !== 200) {
        await respond(state.listStatus, {
          message: 'DB details must not be shown',
        });
        return;
      }
      const pageNumber = Number(url.searchParams.get('page') || 1);
      const limit = Number(url.searchParams.get('limit') || 20);
      await respond(200, {
        items: state.links.slice((pageNumber - 1) * limit, pageNumber * limit),
        page: pageNumber,
        limit,
        hasNextPage: pageNumber * limit < state.links.length,
      });
      return;
    }
    if (path === '/links' && method === 'POST') {
      const body = request.postDataJSON() as {
        alias?: string;
        targetUrl: string;
        expiresAt?: string;
      };
      state.writes.push({ method, body });
      const code = body.alias || 'new7AbX';
      if (state.links.some((link) => link.code === code)) {
        await respond(409, { message: 'Alias is already in use' });
        return;
      }
      const created = {
        ...fixtureLink,
        id: randomUUID(),
        code,
        shortUrl: `https://s.example.com/${code}`,
        targetUrl: new URL(body.targetUrl).href,
        expiresAt: body.expiresAt ?? null,
      };
      state.links.unshift(created);
      await respond(201, created);
      return;
    }
    const id = path.split('/')[2];
    const link = state.links.find((item) => item.id === id);
    if (!link) {
      await respond(404, { message: 'Link not found' });
      return;
    }
    if (path.endsWith('/analytics')) {
      await respond(
        state.analyticsStatus,
        state.analyticsStatus === 200
          ? analyticsFor(link.id)
          : { message: 'ThrottlerException' },
      );
      return;
    }
    if (method === 'PATCH') {
      const body = request.postDataJSON() as Record<string, unknown>;
      state.writes.push({ method, body });
      Object.assign(link, body);
      await respond(200, link);
      return;
    }
    if (method === 'DELETE') {
      state.links = state.links.filter((item) => item.id !== id);
      await route.fulfill({ status: 204, headers });
      return;
    }
    await respond(200, link);
  });
  return state;
}

export async function login(page: Page, email = 'owner@example.com') {
  await page.goto('/login');
  await page.getByLabel('Alamat email', { exact: true }).fill(email);
  await page
    .getByLabel('Kata sandi', { exact: true })
    .fill('browser-test-password-123');
  await page
    .getByRole('button', { name: 'Masuk ke workspace', exact: true })
    .click();
  await page.waitForURL('**/dashboard');
}
