import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { instanceToPlain } from 'class-transformer';
import { RedirectCacheService } from '../common/cache/redirect-cache.service';
import { PrismaService } from '../prisma/prisma.service';
import { CodeGeneratorService } from './code-generator.service';
import { ListLinksQueryDto } from './dto/list-links-query.dto';
import { LinkPolicyService } from './link-policy.service';
import { MAX_CODE_ATTEMPTS } from './links.constants';
import { LinksService } from './links.service';

describe('LinksService', () => {
  let service: LinksService;
  const userId = '11111111-1111-4111-8111-111111111111';
  const link = {
    id: '22222222-2222-4222-8222-222222222222',
    code: 'aBc234X',
    userId,
    targetUrl: 'https://example.com/',
    expiresAt: null,
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00Z'),
  };
  const prisma = {
    link: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
  const generator = { generate: jest.fn() };
  const cache = { invalidate: jest.fn() };
  const databaseError = (code: string) =>
    new Prisma.PrismaClientKnownRequestError('Database error', {
      code,
      clientVersion: '7.10.1',
    });

  beforeEach(async () => {
    jest.resetAllMocks();
    generator.generate.mockReturnValue(link.code);
    prisma.link.create.mockResolvedValue(link);
    prisma.link.findUnique.mockResolvedValue(link);
    prisma.link.findMany.mockResolvedValue([link]);
    prisma.link.update.mockResolvedValue(link);
    prisma.link.delete.mockResolvedValue(link);
    const module = await Test.createTestingModule({
      providers: [
        LinksService,
        LinkPolicyService,
        { provide: PrismaService, useValue: prisma },
        { provide: CodeGeneratorService, useValue: generator },
        { provide: RedirectCacheService, useValue: cache },
        {
          provide: ConfigService,
          useValue: { get: () => 'https://s.example.com' },
        },
      ],
    }).compile();
    service = module.get(LinksService);
  });

  it('creates a normalized target and takes ownership only from the caller', async () => {
    const response = await service.create(userId, {
      targetUrl: 'HTTPS://EXAMPLE.COM',
    });
    expect(prisma.link.create).toHaveBeenCalledWith({
      data: {
        code: link.code,
        targetUrl: 'https://example.com/',
        userId,
        expiresAt: null,
      },
    });
    expect(response.shortUrl).toBe('https://s.example.com/aBc234X');
    expect(instanceToPlain(response)).not.toHaveProperty('userId');
    expect(cache.invalidate).toHaveBeenCalledWith(link.code);
  });

  it('uses an explicit alias without invoking the generator', async () => {
    prisma.link.create.mockResolvedValue({ ...link, code: 'My-Link' });
    const response = await service.create(userId, {
      targetUrl: link.targetUrl,
      alias: 'My-Link',
    });
    expect(response.code).toBe('My-Link');
    expect(generator.generate).not.toHaveBeenCalled();
  });

  it('retries automatic codes after unique-constraint collisions', async () => {
    prisma.link.create
      .mockRejectedValueOnce(databaseError('P2002'))
      .mockRejectedValueOnce(databaseError('P2002'));
    generator.generate
      .mockReturnValueOnce('taken2X')
      .mockReturnValueOnce('taken3X');
    const response = await service.create(userId, {
      targetUrl: link.targetUrl,
    });
    expect(response.code).toBe(link.code);
    expect(prisma.link.create).toHaveBeenCalledTimes(3);
    expect(generator.generate).toHaveBeenCalledTimes(3);
  });

  it('stops after five collisions rather than looping indefinitely', async () => {
    prisma.link.create.mockRejectedValue(databaseError('P2002'));
    await expect(
      service.create(userId, { targetUrl: link.targetUrl }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(prisma.link.create).toHaveBeenCalledTimes(MAX_CODE_ATTEMPTS);
  });

  it('returns 409 immediately for an occupied custom alias', async () => {
    prisma.link.create.mockRejectedValue(databaseError('P2002'));
    await expect(
      service.create(userId, { targetUrl: link.targetUrl, alias: 'taken' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.link.create).toHaveBeenCalledTimes(1);
    expect(generator.generate).not.toHaveBeenCalled();
  });

  it('does not create links for a user deleted after token issuance', async () => {
    prisma.link.create.mockRejectedValue(databaseError('P2003'));
    await expect(
      service.create(userId, { targetUrl: link.targetUrl }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('does not retry unexpected database failures', async () => {
    const error = new Error('Database unavailable');
    prisma.link.create.mockRejectedValue(error);
    await expect(
      service.create(userId, { targetUrl: link.targetUrl }),
    ).rejects.toBe(error);
    expect(prisma.link.create).toHaveBeenCalledTimes(1);
  });

  it.each([
    { targetUrl: 'javascript:alert(1)' },
    { targetUrl: 'https://s.example.com/old-code' },
    { targetUrl: link.targetUrl, alias: 'docs' },
    { targetUrl: link.targetUrl, expiresAt: '2020-01-01T00:00:00Z' },
  ])(
    'rejects invalid creation before accessing the database: %j',
    async (dto) => {
      await expect(service.create(userId, dto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.link.create).not.toHaveBeenCalled();
    },
  );

  it('stores a valid expiration as a Date', async () => {
    const expiresAt = new Date(Date.now() + 86_400_000).toISOString();
    await service.create(userId, { targetUrl: link.targetUrl, expiresAt });
    expect(prisma.link.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        expiresAt: new Date(expiresAt),
      }) as Record<string, unknown>,
    });
  });

  it('scopes listing to the owner, fetches one extra row, and paginates', async () => {
    prisma.link.findMany.mockResolvedValue([link, { ...link, id: 'next-id' }]);
    const response = await service.findAll(userId, { page: 2, limit: 1 });
    expect(prisma.link.findMany).toHaveBeenCalledWith({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: 1,
      take: 2,
    });
    expect(response).toMatchObject({
      page: 2,
      limit: 1,
      hasNextPage: true,
    });
    expect(response.items).toHaveLength(1);
  });

  it('returns an empty page safely', async () => {
    prisma.link.findMany.mockResolvedValue([]);
    await expect(
      service.findAll(userId, new ListLinksQueryDto()),
    ).resolves.toMatchObject({ items: [], hasNextPage: false });
  });

  it('includes ownership in the unique lookup', async () => {
    await service.findOne(userId, link.id);
    expect(prisma.link.findUnique).toHaveBeenCalledWith({
      where: { id: link.id, userId },
    });
  });

  it('returns 404 for a nonexistent link or a link owned by someone else', async () => {
    prisma.link.findUnique.mockResolvedValue(null);
    await expect(service.findOne(userId, link.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('scopes PATCH atomically and can disable a link or clear expiration', async () => {
    await service.update(userId, link.id, {
      targetUrl: 'https://new.example.com',
      isActive: false,
      expiresAt: null,
    });
    expect(prisma.link.update).toHaveBeenCalledWith({
      where: { id: link.id, userId },
      data: {
        targetUrl: 'https://new.example.com/',
        isActive: false,
        expiresAt: null,
      },
    });
    expect(prisma.link.findUnique).not.toHaveBeenCalled();
    expect(cache.invalidate).toHaveBeenCalledWith(link.code);
  });

  it('rejects empty updates', async () => {
    await expect(service.update(userId, link.id, {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.link.update).not.toHaveBeenCalled();
  });

  it('revalidates the target URL during PATCH', async () => {
    await expect(
      service.update(userId, link.id, { targetUrl: 'https://s.example.com/' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.link.update).not.toHaveBeenCalled();
  });

  it('returns 404 when the scoped update matches no record', async () => {
    prisma.link.update.mockRejectedValue(databaseError('P2025'));
    await expect(
      service.update(userId, link.id, { isActive: true }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(cache.invalidate).not.toHaveBeenCalled();
  });

  it('includes ownership in DELETE', async () => {
    await service.remove(userId, link.id);
    expect(prisma.link.delete).toHaveBeenCalledWith({
      where: { id: link.id, userId },
    });
    expect(cache.invalidate).toHaveBeenCalledWith(link.code);
  });

  it('returns 404 when the scoped delete matches no record', async () => {
    prisma.link.delete.mockRejectedValue(databaseError('P2025'));
    await expect(service.remove(userId, link.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
