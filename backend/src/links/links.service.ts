import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import type { Link } from '@prisma/client';
import { RedirectCacheService } from '../common/cache/redirect-cache.service';
import type { EnvironmentVariables } from '../common/config/environment';
import { PrismaService } from '../prisma/prisma.service';
import { CodeGeneratorService } from './code-generator.service';
import type { CreateLinkDto } from './dto/create-link.dto';
import { LinkListResponseDto } from './dto/link-list-response.dto';
import { LinkResponseDto } from './dto/link-response.dto';
import type { ListLinksQueryDto } from './dto/list-links-query.dto';
import type { UpdateLinkDto } from './dto/update-link.dto';
import { LinkPolicyService } from './link-policy.service';
import { MAX_CODE_ATTEMPTS } from './links.constants';

function isPrismaError(error: unknown, code: string): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === code
  );
}

@Injectable()
export class LinksService {
  private readonly shortLinkBaseUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly codeGenerator: CodeGeneratorService,
    private readonly policy: LinkPolicyService,
    private readonly cache: RedirectCacheService,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.shortLinkBaseUrl = config.get('SHORT_LINK_BASE_URL');
  }

  async create(userId: string, dto: CreateLinkDto): Promise<LinkResponseDto> {
    const targetUrl = this.policy.validateTargetUrl(dto.targetUrl);
    const expiresAt = this.policy.parseExpiration(dto.expiresAt);
    const alias =
      dto.alias === undefined
        ? undefined
        : this.policy.validateAlias(dto.alias);

    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
      const code = alias ?? this.codeGenerator.generate();
      try {
        const link = await this.prisma.link.create({
          data: { code, targetUrl, userId, expiresAt },
        });
        this.cache.invalidate(link.code);
        return this.toResponse(link);
      } catch (error) {
        // The unique index is authoritative, even for simultaneous requests.
        if (isPrismaError(error, 'P2002')) {
          if (alias !== undefined) {
            throw new ConflictException('Alias is already in use');
          }
          continue;
        }
        if (isPrismaError(error, 'P2003')) {
          throw new UnauthorizedException('User is no longer available');
        }
        throw error;
      }
    }
    throw new ServiceUnavailableException(
      'Unable to allocate a short code; please try again',
    );
  }

  async findAll(
    userId: string,
    query: ListLinksQueryDto,
  ): Promise<LinkListResponseDto> {
    // One extra row tells us whether another page exists, without a COUNT query.
    const links = await this.prisma.link.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (query.page - 1) * query.limit,
      take: query.limit + 1,
    });
    return new LinkListResponseDto(
      links.slice(0, query.limit).map((link) => this.toResponse(link)),
      query.page,
      query.limit,
      links.length > query.limit,
    );
  }

  async findOne(userId: string, id: string): Promise<LinkResponseDto> {
    const link = await this.prisma.link.findUnique({
      where: { id, userId },
    });
    if (!link) {
      throw new NotFoundException('Link not found');
    }
    return this.toResponse(link);
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateLinkDto,
  ): Promise<LinkResponseDto> {
    if (
      dto.targetUrl === undefined &&
      dto.isActive === undefined &&
      dto.expiresAt === undefined
    ) {
      throw new BadRequestException('Provide at least one field to update');
    }
    const data: Prisma.LinkUpdateInput = {};
    if (dto.targetUrl !== undefined) {
      data.targetUrl = this.policy.validateTargetUrl(dto.targetUrl);
    }
    if (dto.isActive !== undefined) {
      data.isActive = dto.isActive;
    }
    if (dto.expiresAt !== undefined) {
      data.expiresAt = this.policy.parseExpiration(dto.expiresAt);
    }

    try {
      // Include ownership in the write itself: no check-then-write race.
      const link = await this.prisma.link.update({
        where: { id, userId },
        data,
      });
      this.cache.invalidate(link.code);
      return this.toResponse(link);
    } catch (error) {
      if (isPrismaError(error, 'P2025')) {
        throw new NotFoundException('Link not found');
      }
      throw error;
    }
  }

  async remove(userId: string, id: string): Promise<void> {
    try {
      const link = await this.prisma.link.delete({ where: { id, userId } });
      this.cache.invalidate(link.code);
    } catch (error) {
      if (isPrismaError(error, 'P2025')) {
        throw new NotFoundException('Link not found');
      }
      throw error;
    }
  }

  private toResponse(link: Link): LinkResponseDto {
    return new LinkResponseDto(link, this.shortLinkBaseUrl);
  }
}
