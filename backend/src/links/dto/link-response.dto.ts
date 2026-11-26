import type { Link } from '@prisma/client';
import { Exclude, Expose } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

@Exclude()
export class LinkResponseDto {
  @Expose()
  @ApiProperty({ format: 'uuid' })
  readonly id: string;

  @Expose()
  @ApiProperty({
    example: 'my-portfolio',
    description: 'Immutable short code.',
  })
  readonly code: string;

  @Expose()
  @ApiProperty({ format: 'uri' })
  readonly shortUrl: string;

  @Expose()
  @ApiProperty({ format: 'uri' })
  readonly targetUrl: string;

  @Expose()
  @ApiProperty({ type: Boolean })
  readonly isActive: boolean;

  @Expose()
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  readonly expiresAt: Date | null;

  @Expose()
  @ApiProperty({ type: String, format: 'date-time' })
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
