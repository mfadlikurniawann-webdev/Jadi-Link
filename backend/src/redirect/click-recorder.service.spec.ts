import { ConfigService } from '@nestjs/config';
import type { FastifyRequest } from 'fastify';
import { ClientIdentityService } from '../common/client-identity/client-identity.service';
import type { EnvironmentVariables } from '../common/config/environment';
import type { ClickBufferService } from './click-buffer.service';
import { ClickRecorderService } from './click-recorder.service';
import type { BufferedClickDto } from './dto/buffered-click.dto';

describe('ClickRecorderService', () => {
  const config = new ConfigService<EnvironmentVariables, true>({
    TRUST_PROXY: '127.0.0.1,::1',
    VISITOR_HASH_SECRET: 'private-test-visitor-secret-at-least-32-characters',
  });
  const buffer = {
    enqueue: jest.fn((click: BufferedClickDto) => click.id.length > 0),
  };
  const recorder = new ClickRecorderService(
    buffer as unknown as ClickBufferService,
    new ClientIdentityService(config),
    config,
  );
  const linkId = '11111111-1111-4111-8111-111111111111';
  const request = (
    agent = 'Mozilla/5.0 (Windows NT 10.0)',
    ip = '198.51.100.7',
  ) =>
    ({
      raw: { socket: { remoteAddress: '127.0.0.1' } },
      ip: '127.0.0.1',
      headers: {
        'cf-connecting-ip': ip,
        'cf-ipcountry': 'id',
        referer: 'https://Search.Example./private?q=secret#fragment',
        'user-agent': agent,
      },
    }) as unknown as FastifyRequest;

  beforeEach(() => jest.clearAllMocks());

  it('stores only referrer hostname, country, device and HMAC, not IP/UA/URL', () => {
    const clickedAt = new Date();
    recorder.record(linkId, request(), clickedAt);
    const click = buffer.enqueue.mock.calls[0]?.[0];
    expect(click).toMatchObject({
      linkId,
      clickedAt,
      referrer: 'search.example',
      country: 'ID',
      device: 'desktop',
      visitorHash: expect.stringMatching(/^[0-9a-f]{64}$/) as string,
    });
    const serialized = JSON.stringify(click);
    expect(serialized).not.toContain('198.51.100.7');
    expect(serialized).not.toContain('Windows NT');
    expect(serialized).not.toContain('q=secret');
    expect(serialized).not.toContain('private-test-visitor-secret');
  });

  it('creates stable per-link hashes and independent event IDs', () => {
    recorder.record(linkId, request(), new Date());
    recorder.record(linkId, request(), new Date());
    recorder.record(
      '22222222-2222-4222-8222-222222222222',
      request(),
      new Date(),
    );
    const [first, second, other] = buffer.enqueue.mock.calls.map(
      ([click]) => click,
    );
    expect(first!.visitorHash).toBe(second!.visitorHash);
    expect(first!.id).not.toBe(second!.id);
    expect(first!.visitorHash).not.toBe(other!.visitorHash);
  });

  it.each([
    ['Mozilla iPhone Mobile', 'mobile'],
    ['Mozilla Android Mobile', 'mobile'],
    ['Mozilla iPad Mobile', 'tablet'],
    ['Mozilla Android 14', 'tablet'],
    ['Mozilla Macintosh', 'desktop'],
    ['Googlebot Mobile', 'bot'],
    ['curl/8.0', 'unknown'],
    ['', 'unknown'],
  ])('classifies %s as %s', (agent, device) => {
    recorder.record(linkId, request(agent), new Date());
    expect(buffer.enqueue.mock.calls[0]?.[0].device).toBe(device);
  });

  it('treats invalid referrer as direct/unknown', () => {
    const incoming = request();
    incoming.headers.referer = 'javascript:alert(1)';
    recorder.record(linkId, incoming, new Date());
    expect(buffer.enqueue.mock.calls[0]?.[0].referrer).toBeNull();
  });
});
