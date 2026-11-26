import { GoneException, NotFoundException } from '@nestjs/common';
import { RedirectCacheService } from '../common/cache/redirect-cache.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { RedirectTargetDto } from './dto/redirect-target.dto';
import { RedirectService } from './redirect.service';

describe('RedirectService', () => {
  const link: RedirectTargetDto = {
    id: '11111111-1111-4111-8111-111111111111',
    code: 'abc234X',
    targetUrl: 'https://example.com/',
    isActive: true,
    expiresAt: null,
  };
  const prisma = { link: { findUnique: jest.fn() } };
  let cache: RedirectCacheService;
  let service: RedirectService;

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.link.findUnique.mockResolvedValue(link);
    cache = new RedirectCacheService();
    service = new RedirectService(prisma as unknown as PrismaService, cache);
  });

  it('uses one lookup for repeated hits', async () => {
    await expect(service.resolve(link.code)).resolves.toEqual(link);
    await expect(service.resolve(link.code)).resolves.toEqual(link);
    expect(prisma.link.findUnique).toHaveBeenCalledTimes(1);
  });

  it('does not negatively cache missing codes', async () => {
    prisma.link.findUnique.mockResolvedValue(null);
    await expect(service.resolve(link.code)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.resolve(link.code)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.link.findUnique).toHaveBeenCalledTimes(2);
  });

  it.each(['api', 'DOCS', 'health', 'ab', 'a.b', 'a/b', 'a'.repeat(65)])(
    'rejects reserved/malformed code without querying: %s',
    async (code) => {
      await expect(service.resolve(code)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.link.findUnique).not.toHaveBeenCalled();
    },
  );

  it('returns 410 for an inactive cached link', async () => {
    prisma.link.findUnique.mockResolvedValue({ ...link, isActive: false });
    await expect(service.resolve(link.code)).rejects.toBeInstanceOf(
      GoneException,
    );
    await expect(service.resolve(link.code)).rejects.toBeInstanceOf(
      GoneException,
    );
    expect(prisma.link.findUnique).toHaveBeenCalledTimes(1);
  });

  it('checks expiration on every cache hit, not just cache insertion', async () => {
    let now = Date.now();
    const expiresAt = new Date(now + 1000);
    const clock = jest.spyOn(Date, 'now').mockImplementation(() => now);
    try {
      prisma.link.findUnique.mockResolvedValue({ ...link, expiresAt });
      await expect(service.resolve(link.code)).resolves.toMatchObject({
        expiresAt,
      });
      now += 1000;
      await expect(service.resolve(link.code)).rejects.toBeInstanceOf(
        GoneException,
      );
      expect(prisma.link.findUnique).toHaveBeenCalledTimes(1);
    } finally {
      clock.mockRestore();
    }
  });

  it('does not refill stale data if a mutation overlaps the lookup', async () => {
    let finish!: (link: RedirectTargetDto) => void;
    prisma.link.findUnique.mockReturnValueOnce(
      new Promise<RedirectTargetDto>((resolve) => {
        finish = resolve;
      }),
    );
    const inFlight = service.resolve(link.code);
    cache.invalidate(link.code);
    finish(link);
    await inFlight;
    expect(cache.get(link.code)).toBeUndefined();
    prisma.link.findUnique.mockResolvedValue({
      ...link,
      targetUrl: 'https://updated.example.com/',
    });
    await expect(service.resolve(link.code)).resolves.toMatchObject({
      targetUrl: 'https://updated.example.com/',
    });
    expect(prisma.link.findUnique).toHaveBeenCalledTimes(2);
  });
});
