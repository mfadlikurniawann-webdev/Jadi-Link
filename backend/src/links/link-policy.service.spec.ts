import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../common/config/environment';
import { LinkPolicyService } from './link-policy.service';
import { MAX_TARGET_URL_LENGTH, RESERVED_ALIASES } from './links.constants';

describe('LinkPolicyService', () => {
  const config = new ConfigService<EnvironmentVariables, true>({
    SHORT_LINK_BASE_URL: 'https://s.example.com',
  });
  const policy = new LinkPolicyService(config);

  it('normalizes an HTTP(S) URL and preserves query/path semantics', () => {
    expect(
      policy.validateTargetUrl('  HTTPS://EXAMPLE.COM/a?q=hello%20world#b  '),
    ).toBe('https://example.com/a?q=hello%20world#b');
    expect(policy.validateTargetUrl('http://example.com')).toBe(
      'http://example.com/',
    );
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,test',
    'ftp://example.com/file',
    '//example.com/path',
    '/relative',
    'https:///example.com',
    'https://',
    'not-a-url',
    'https://user:password@example.com',
    'https://example.com/a\nb',
    'https://example.com/a\u0000b',
    'https://example.com/a b',
    'https://example.com\\path',
    `https://example.com/${'a'.repeat(MAX_TARGET_URL_LENGTH)}`,
    `https://example.com/${'語'.repeat(300)}`,
  ])('rejects unsafe or malformed URL: %s', (url) => {
    expect(() => policy.validateTargetUrl(url)).toThrow(BadRequestException);
  });

  it.each([
    'https://s.example.com',
    'http://S.EXAMPLE.COM/path',
    'https://s.example.com.:444/path',
    'https://%73.example.com/path',
    'http://s.example.com:8000/another-code',
  ])('rejects a redirect loop independent of scheme/port/case: %s', (url) => {
    expect(() => policy.validateTargetUrl(url)).toThrow(
      'targetUrl cannot point to the short-link hostname',
    );
  });

  it('does not reject an unrelated hostname with a similar prefix', () => {
    expect(policy.validateTargetUrl('https://s.example.com.evil.test/')).toBe(
      'https://s.example.com.evil.test/',
    );
  });

  it('compares canonical IP and international hostnames', () => {
    const local = new LinkPolicyService(
      new ConfigService<EnvironmentVariables, true>({
        SHORT_LINK_BASE_URL: 'http://127.0.0.1:3001',
      }),
    );
    expect(() => local.validateTargetUrl('http://0x7f000001:3000/')).toThrow(
      BadRequestException,
    );
    const international = new LinkPolicyService(
      new ConfigService<EnvironmentVariables, true>({
        SHORT_LINK_BASE_URL: 'https://bücher.example',
      }),
    );
    expect(() =>
      international.validateTargetUrl('https://xn--bcher-kva.example./'),
    ).toThrow(BadRequestException);
  });

  it('allows case-sensitive aliases without rewriting them', () => {
    expect(policy.validateAlias('My-Link_123')).toBe('My-Link_123');
    expect(policy.validateAlias('a'.repeat(64))).toHaveLength(64);
  });

  it.each([
    'ab',
    '',
    'a'.repeat(65),
    '-abc',
    '_abc',
    'a/b',
    'a.b',
    'a b',
    '語語語',
  ])('rejects malformed alias: %s', (alias) => {
    expect(() => policy.validateAlias(alias)).toThrow(BadRequestException);
  });

  it.each([...RESERVED_ALIASES])(
    'reserves route names case-insensitively: %s',
    (alias) => {
      expect(() => policy.validateAlias(alias.toUpperCase())).toThrow(
        BadRequestException,
      );
    },
  );

  describe('expiration', () => {
    beforeEach(() => {
      jest
        .spyOn(Date, 'now')
        .mockReturnValue(new Date('2026-11-26T00:00:00.000Z').getTime());
    });
    afterEach(() => jest.restoreAllMocks());

    it('allows no expiration or a future timezone-aware ISO timestamp', () => {
      expect(policy.parseExpiration(undefined)).toBeNull();
      expect(policy.parseExpiration(null)).toBeNull();
      expect(policy.parseExpiration('2026-12-01T07:00:00+07:00')).toEqual(
        new Date('2026-12-01T00:00:00.000Z'),
      );
    });

    it.each([
      '2026-11-26T00:00:00.000Z',
      '2020-01-01T00:00:00Z',
      '2026-12-01',
      '2026-12-01T07:00:00',
      '2027-02-30T07:00:00Z',
      'not-a-date',
    ])('rejects invalid, ambiguous, or non-future expiration: %s', (value) => {
      expect(() => policy.parseExpiration(value)).toThrow(BadRequestException);
    });
  });
});
