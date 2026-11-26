import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { instanceToPlain } from 'class-transformer';
import type { PrismaService } from '../prisma/prisma.service';
import { PUBLIC_USER_SELECT, UsersService } from './users.service';

describe('UsersService', () => {
  const user = {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'user@example.com',
    createdAt: new Date('2026-01-01T00:00:00Z'),
  };
  const prisma = { user: { create: jest.fn(), findUnique: jest.fn() } };
  const service = new UsersService(prisma as unknown as PrismaService);

  beforeEach(() => jest.resetAllMocks());

  it('selects public fields explicitly when creating a user', async () => {
    prisma.user.create.mockResolvedValue(user);
    await expect(service.create(user.email, 'hash')).resolves.toEqual(user);
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: { email: user.email, passwordHash: 'hash' },
      select: PUBLIC_USER_SELECT,
    });
  });

  it('maps a database unique violation to HTTP 409', async () => {
    prisma.user.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique violation', {
        code: 'P2002',
        clientVersion: '7.10.1',
        meta: { target: ['email'] },
      }),
    );
    await expect(service.create(user.email, 'hash')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('does not hide unexpected database failures', async () => {
    const failure = new Error('Database is down');
    prisma.user.create.mockRejectedValue(failure);
    await expect(service.create(user.email, 'hash')).rejects.toBe(failure);
  });

  it('looks up login credentials only by the normalized email', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.findForLogin(user.email)).resolves.toBeNull();
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: user.email },
    });
  });

  it('selects only safe fields and excludes unexpected fields from serialization', async () => {
    prisma.user.findUnique.mockResolvedValue({
      ...user,
      passwordHash: 'never-expose-this',
      internalNote: 'private',
    });
    const response = await service.getProfile(user.id);
    // Defense in depth: even an accidentally attached field is not serialized.
    Object.assign(response, { passwordHash: 'never-expose-this' });
    expect(instanceToPlain(response)).toEqual(user);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: user.id },
      select: PUBLIC_USER_SELECT,
    });
  });

  it('rejects the profile of a deleted user', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.getProfile(user.id)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
