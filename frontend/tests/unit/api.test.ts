import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ApiError,
  apiFetch,
  errorMessage,
  resolveApiUrl,
} from '../../src/lib/api';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('public API configuration', () => {
  it('normalizes the /api base and supports a local development default', () => {
    expect(resolveApiUrl('https://api.example.com/api/')).toBe(
      'https://api.example.com/api',
    );
    expect(resolveApiUrl(undefined)).toBe('http://localhost:3001/api');
  });
  it.each([
    'javascript:alert(1)',
    'https://user:password@example.com/api',
    'https://example.com',
    'https://example.com/api?secret=test',
  ])('rejects invalid config: %s', (url) => {
    expect(() => resolveApiUrl(url)).toThrow();
  });
  it('requires explicit HTTPS for a remote production API', () => {
    expect(() => resolveApiUrl(undefined, true)).toThrow('required');
    expect(() => resolveApiUrl('http://remote.example/api', true)).toThrow(
      'HTTPS',
    );
    expect(resolveApiUrl('http://127.0.0.1:3001/api', true)).toBe(
      'http://127.0.0.1:3001/api',
    );
  });
});

describe('API requests', () => {
  it('uses bearer auth, omits cookies/cache and serializes a JSON body', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ id: 'result' })));
    vi.stubGlobal('fetch', fetch);
    await expect(
      apiFetch('/links', {
        method: 'POST',
        token: 'test-token',
        body: { targetUrl: 'https://example.com' },
      }),
    ).resolves.toEqual({ id: 'result' });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/links$/),
      expect.objectContaining({
        method: 'POST',
        credentials: 'omit',
        cache: 'no-store',
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ targetUrl: 'https://example.com' }),
      }),
    );
  });
  it('does not parse a 204 response as JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(null, { status: 204 })),
    );
    await expect(
      apiFetch('/links/id', { method: 'DELETE' }),
    ).resolves.toBeUndefined();
  });
  it('localizes login failures without storing request bodies/tokens on errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            message: 'Invalid email or password',
            requestId: 'req-test',
          }),
          { status: 401 },
        ),
      ),
    );
    await expect(
      apiFetch('/auth/login', {
        method: 'POST',
        body: { password: 'private-password' },
      }),
    ).rejects.toMatchObject({
      status: 401,
      message: 'Email atau kata sandi tidak cocok.',
      requestId: 'req-test',
    });
  });
  it('handles Retry-After and hides server diagnostics', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response('{}', { status: 429, headers: { 'Retry-After': '12' } }),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ message: 'private driver diagnostics' }),
            { status: 500 },
          ),
        ),
    );
    await expect(apiFetch('/links')).rejects.toMatchObject({
      status: 429,
      retryAfter: 12,
      message: expect.stringContaining('12 detik'),
    });
    await expect(apiFetch('/links')).rejects.toMatchObject({
      status: 500,
      message: 'Server sedang mengalami kendala. Silakan coba lagi.',
    });
  });
  it('converts broken responses and network failures into actionable errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(new Response('not-json'))
        .mockRejectedValueOnce(new TypeError('failed fetch')),
    );
    await expect(apiFetch('/links')).rejects.toMatchObject({ status: 502 });
    await expect(apiFetch('/links')).rejects.toMatchObject({
      status: 0,
      message: expect.stringContaining('backend berjalan'),
    });
    expect(errorMessage(new Error('private data'))).not.toContain(
      'private data',
    );
    expect(errorMessage(new ApiError(400, 'Safe message'))).toBe(
      'Safe message',
    );
  });
  it('aborts slow requests instead of leaving forms pending forever', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url, options: RequestInit) =>
          new Promise((_resolve, reject) =>
            options.signal?.addEventListener('abort', () =>
              reject(new DOMException('aborted', 'AbortError')),
            ),
          ),
      ),
    );
    const assertion = expect(apiFetch('/links')).rejects.toMatchObject({
      status: 0,
      message: expect.stringContaining('terlalu lama'),
    });
    await vi.advanceTimersByTimeAsync(15000);
    await assertion;
  });
  it('does not attach a bearer token to an arbitrary external URL', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await expect(
      apiFetch('//evil.example', { token: 'private-token' }),
    ).rejects.toThrow('local paths');
    expect(fetch).not.toHaveBeenCalled();
  });
});
