import type { RedirectTargetDto } from '../../redirect/dto/redirect-target.dto';
import {
  REDIRECT_CACHE_MAX,
  REDIRECT_CACHE_TTL_MS,
  RedirectCacheService,
} from './redirect-cache.service';

describe('RedirectCacheService', () => {
  const link: RedirectTargetDto = {
    id: '11111111-1111-4111-8111-111111111111',
    code: 'abc234X',
    targetUrl: 'https://example.com/',
    isActive: true,
    expiresAt: null,
  };

  it('evicts the least recently used entry and never exceeds 1000 entries', () => {
    const cache = new RedirectCacheService();
    for (let index = 0; index < REDIRECT_CACHE_MAX; index++) {
      cache.set(`code${index}`, link, cache.version);
    }
    expect(cache.get('code0')).toBe(link);
    cache.set('extra', link, cache.version);
    expect(cache.size).toBe(1000);
    expect(cache.get('code1')).toBeUndefined();
    expect(cache.get('code0')).toBe(link);
  });

  it('uses fixed TTL, not a sliding TTL extended by reads', () => {
    let now = 1000;
    const clock = jest.spyOn(Date, 'now').mockImplementation(() => now);
    try {
      const cache = new RedirectCacheService();
      cache.set(link.code, link, cache.version);
      now += REDIRECT_CACHE_TTL_MS - 1;
      expect(cache.get(link.code)).toBe(link);
      now += 1;
      expect(cache.get(link.code)).toBeUndefined();
      expect(cache.size).toBe(0);
    } finally {
      clock.mockRestore();
    }
  });

  it('invalidates only the requested entry and rejects a stale in-flight fill', () => {
    const cache = new RedirectCacheService();
    const oldVersion = cache.version;
    cache.set('other-code', link, oldVersion);
    cache.invalidate(link.code);
    cache.set(link.code, link, oldVersion);
    expect(cache.get(link.code)).toBeUndefined();
    expect(cache.get('other-code')).toBe(link);
    cache.set(link.code, link, cache.version);
    expect(cache.get(link.code)).toBe(link);
    cache.invalidate(link.code);
    expect(cache.get(link.code)).toBeUndefined();
  });
});
