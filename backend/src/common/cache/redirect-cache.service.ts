import { Injectable } from '@nestjs/common';
import type { RedirectTargetDto } from '../../redirect/dto/redirect-target.dto';

export const REDIRECT_CACHE_MAX = 1000;
export const REDIRECT_CACHE_TTL_MS = 60_000;

@Injectable()
export class RedirectCacheService {
  private readonly entries = new Map<
    string,
    { value: RedirectTargetDto; validUntil: number }
  >();
  private revision = 0;

  get version(): number {
    return this.revision;
  }

  get size(): number {
    return this.entries.size;
  }

  get(code: string): RedirectTargetDto | undefined {
    const entry = this.entries.get(code);
    if (!entry) return undefined;
    if (entry.validUntil <= Date.now()) {
      this.entries.delete(code);
      return undefined;
    }
    // Map insertion order is the LRU order; a hit moves the entry to the end.
    this.entries.delete(code);
    this.entries.set(code, entry);
    return entry.value;
  }

  set(code: string, value: RedirectTargetDto, version: number): void {
    // An update/delete during the DB lookup must not refill a stale value.
    if (version !== this.revision) return;
    this.entries.delete(code);
    this.entries.set(code, {
      value,
      validUntil: Date.now() + REDIRECT_CACHE_TTL_MS,
    });
    if (this.entries.size > REDIRECT_CACHE_MAX) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
  }

  invalidate(code: string): void {
    this.revision++;
    this.entries.delete(code);
  }
}
