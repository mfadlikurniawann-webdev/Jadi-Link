import { GoneException, Injectable, NotFoundException } from '@nestjs/common';
import { RedirectCacheService } from '../common/cache/redirect-cache.service';
import { ALIAS_PATTERN, RESERVED_ALIASES } from '../links/links.constants';
import { PrismaService } from '../prisma/prisma.service';
import type { RedirectTargetDto } from './dto/redirect-target.dto';

@Injectable()
export class RedirectService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: RedirectCacheService,
  ) {}

  async resolve(code: string): Promise<RedirectTargetDto> {
    if (!ALIAS_PATTERN.test(code) || RESERVED_ALIASES.has(code.toLowerCase())) {
      throw new NotFoundException('Link not found');
    }
    let link = this.cache.get(code);
    if (!link) {
      const version = this.cache.version;
      const found = await this.prisma.link.findUnique({
        where: { code },
        select: {
          id: true,
          code: true,
          targetUrl: true,
          isActive: true,
          expiresAt: true,
        },
      });
      if (!found) throw new NotFoundException('Link not found');
      link = found;
      this.cache.set(code, link, version);
    }
    // Never rely on TTL for expiry: a cached link can expire between two hits.
    if (
      !link.isActive ||
      (link.expiresAt && link.expiresAt.getTime() <= Date.now())
    ) {
      throw new GoneException('Link is inactive or expired');
    }
    return link;
  }
}
