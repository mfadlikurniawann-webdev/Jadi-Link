import type { Link } from '@prisma/client';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class LinkResponseDto {
  @Expose()
  readonly id: string;

  @Expose()
  readonly code: string;

  @Expose()
  readonly shortUrl: string;

  @Expose()
  readonly targetUrl: string;

  @Expose()
  readonly isActive: boolean;

  @Expose()
  readonly expiresAt: Date | null;

  @Expose()
  readonly createdAt: Date;

  constructor(link: Link, shortLinkBaseUrl: string) {
    this.id = link.id;
    this.code = link.code;
    this.shortUrl = new URL(`/${link.code}`, shortLinkBaseUrl).href;
    this.targetUrl = link.targetUrl;
    this.isActive = link.isActive;
    this.expiresAt = link.expiresAt;
    this.createdAt = link.createdAt;
  }
}
