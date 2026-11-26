import { describe, expect, it } from 'vitest';
import {
  linkPayload,
  safeHttpUrl,
  safeReturnTo,
  toLocalDateTime,
  validateCredentials,
} from '../../src/lib/validation';
import type { ShortLink } from '../../src/lib/types';

const existing: ShortLink = {
  id: '22222222-2222-4222-8222-222222222222',
  code: 'stable-link',
  shortUrl: 'https://s.example.com/stable-link',
  targetUrl: 'https://example.com/original',
  isActive: true,
  expiresAt: '2020-01-01T00:00:00Z',
  createdAt: '2020-01-01T00:00:00Z',
};

describe('safe navigation and credentials', () => {
  it.each([
    null,
    '//evil.example',
    'https://evil.example',
    '/dashboard?next=evil',
    '/links/not-a-uuid',
    'javascript:alert(1)',
  ])('rejects an unsafe return URL: %s', (value) => {
    expect(safeReturnTo(value)).toBe('/dashboard');
  });
  it('allows only known internal protected routes', () => {
    expect(safeReturnTo(`/links/${existing.id}`)).toBe(`/links/${existing.id}`);
    expect(safeReturnTo('/dashboard')).toBe('/dashboard');
  });
  it('enforces UTF-8 bytes, not only character count', () => {
    expect(
      validateCredentials('user@example.com', '🔑'.repeat(18), true),
    ).toBeNull();
    expect(
      validateCredentials('user@example.com', '🔑'.repeat(19), true),
    ).toContain('72 byte');
  });
  it('requires twelve characters only at registration and does not trim password', () => {
    expect(validateCredentials('user@example.com', 'short', true)).toContain(
      '12 karakter',
    );
    expect(validateCredentials('user@example.com', 'short', false)).toBeNull();
    expect(
      validateCredentials(
        ' USER@EXAMPLE.COM ',
        '  spaces are meaningful  ',
        true,
      ),
    ).toBeNull();
  });
  it('rejects invalid email and missing passwords', () => {
    expect(
      validateCredentials('invalid', 'valid-password-123', true),
    ).toContain('email');
    expect(validateCredentials('user@example.com', '', false)).toContain(
      'kata sandi',
    );
  });
});

describe('link form payloads', () => {
  it('omits empty optional fields at creation', () => {
    expect(
      linkPayload({
        targetUrl: ' https://example.com ',
        alias: '  ',
        expiresAt: '',
      }),
    ).toEqual({ targetUrl: 'https://example.com' });
  });
  it('trims custom aliases without changing their case', () => {
    expect(
      linkPayload({
        targetUrl: 'https://example.com',
        alias: ' My-Link ',
        expiresAt: '',
      }),
    ).toEqual({ targetUrl: 'https://example.com', alias: 'My-Link' });
  });
  it.each([
    'javascript:alert(1)',
    'ftp://example.com',
    'https://user:password@example.com',
    'not-a-url',
  ])('rejects unsafe destination %s', (targetUrl) => {
    expect(() => linkPayload({ targetUrl, alias: '', expiresAt: '' })).toThrow(
      'HTTP/HTTPS',
    );
    expect(safeHttpUrl(targetUrl)).toBeNull();
  });
  it('rejects malformed aliases', () => {
    expect(() =>
      linkPayload({
        targetUrl: 'https://example.com',
        alias: '_bad',
        expiresAt: '',
      }),
    ).toThrow('Alias');
  });
  it('does not resend an unchanged expired timestamp when editing the destination', () => {
    const body = linkPayload(
      {
        targetUrl: 'https://example.com/updated',
        alias: 'must-not-change',
        expiresAt: toLocalDateTime(existing.expiresAt),
      },
      existing,
    );
    expect(body).toEqual({ targetUrl: 'https://example.com/updated' });
  });
  it('clears expiration with null and never sends an alias on PATCH', () => {
    expect(
      linkPayload(
        { targetUrl: existing.targetUrl, alias: 'ignored', expiresAt: '' },
        existing,
      ),
    ).toEqual({ expiresAt: null });
  });
  it('converts local date-time to ISO and rejects dates in the past', () => {
    const future = toLocalDateTime('2099-01-01T00:00:00Z');
    expect(
      linkPayload({
        targetUrl: 'https://example.com',
        alias: '',
        expiresAt: future,
      }),
    ).toHaveProperty('expiresAt', '2099-01-01T00:00:00.000Z');
    expect(() =>
      linkPayload({
        targetUrl: 'https://example.com',
        alias: '',
        expiresAt: '2020-01-01T00:00',
      }),
    ).toThrow('masa depan');
  });
  it('rejects no-op edits and handles missing/invalid date strings', () => {
    expect(() =>
      linkPayload(
        {
          targetUrl: existing.targetUrl,
          alias: existing.code,
          expiresAt: toLocalDateTime(existing.expiresAt),
        },
        existing,
      ),
    ).toThrow('Belum ada perubahan');
    expect(toLocalDateTime(null)).toBe('');
    expect(toLocalDateTime('invalid')).toBe('');
  });
});
