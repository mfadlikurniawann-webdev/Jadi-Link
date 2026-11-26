import { ConfigService } from '@nestjs/config';
import type { FastifyRequest } from 'fastify';
import type { EnvironmentVariables } from '../config/environment';
import { ClientIdentityService } from './client-identity.service';

describe('ClientIdentityService', () => {
  const identity = new ClientIdentityService(
    new ConfigService<EnvironmentVariables, true>({
      TRUST_PROXY: '127.0.0.1,::1,10.0.0.0/24',
    }),
  );
  const request = (
    peer: string,
    headers: Record<string, string | string[]> = {},
    ip = peer,
  ) =>
    ({
      raw: { socket: { remoteAddress: peer } },
      headers,
      ip,
    }) as unknown as FastifyRequest;

  it.each(['127.0.0.1', '::1', '::ffff:127.0.0.1', '10.0.0.10'])(
    'prefers CF-Connecting-IP through trusted peer %s',
    (peer) => {
      expect(
        identity.getClientIp(
          request(peer, { 'cf-connecting-ip': '198.51.100.5' }, '192.0.2.5'),
        ),
      ).toBe('198.51.100.5');
    },
  );

  it('ignores spoofed CF and forwarding identity through an untrusted peer', () => {
    const incoming = request(
      '203.0.113.9',
      { 'cf-connecting-ip': '198.51.100.5', 'cf-ipcountry': 'ID' },
      '192.0.2.5',
    );
    expect(identity.getClientIp(incoming)).toBe('203.0.113.9');
    expect(identity.getCountry(incoming)).toBeNull();
  });

  it.each(['not-an-ip', '1.2.3.4,5.6.7.8', ['1.2.3.4', '5.6.7.8']])(
    'ignores malformed or repeated CF IP: %j',
    (value) => {
      expect(
        identity.getClientIp(
          request('127.0.0.1', { 'cf-connecting-ip': value }, '192.0.2.5'),
        ),
      ).toBe('192.0.2.5');
    },
  );

  it('canonicalizes IPv6 spellings and handles malformed peers safely', () => {
    expect(
      identity.getClientIp(
        request('127.0.0.1', {
          'cf-connecting-ip': '2001:0db8:0000:0000:0000:0000:0000:0001',
        }),
      ),
    ).toBe('2001:db8::1');
    expect(identity.getClientIp(request('invalid'))).toBeNull();
    expect(identity.getClientIp(request('fe80::1%eth0'))).toBeNull();
  });

  it('preserves the prefix length of an IPv4-mapped IPv6 proxy subnet', () => {
    const mapped = new ClientIdentityService(
      new ConfigService<EnvironmentVariables, true>({
        TRUST_PROXY: '::ffff:127.0.0.1/128',
      }),
    );
    expect(
      mapped.getClientIp(
        request('::ffff:127.0.0.1', { 'cf-connecting-ip': '198.51.100.5' }),
      ),
    ).toBe('198.51.100.5');
  });

  it('normalizes a country from the same trusted Cloudflare header path', () => {
    expect(
      identity.getCountry(
        request('127.0.0.1', {
          'cf-connecting-ip': '198.51.100.5',
          'cf-ipcountry': 'id',
        }),
      ),
    ).toBe('ID');
  });

  it.each(['XX', 'T1', 'unknown', '123', ''])(
    'treats unsupported country value %s as unknown',
    (country) => {
      expect(
        identity.getCountry(
          request('127.0.0.1', {
            'cf-connecting-ip': '198.51.100.5',
            'cf-ipcountry': country,
          }),
        ),
      ).toBeNull();
    },
  );

  it('ignores country when the CF IP is absent', () => {
    expect(
      identity.getCountry(request('127.0.0.1', { 'cf-ipcountry': 'ID' })),
    ).toBeNull();
  });
});
