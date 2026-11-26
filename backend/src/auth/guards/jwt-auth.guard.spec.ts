import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  const userId = '11111111-1111-4111-8111-111111111111';
  const reflector = { getAllAndOverride: jest.fn() };
  const jwt = { verifyAsync: jest.fn() };
  const contextFor = (authorization?: string) => {
    const request = {
      headers: { authorization },
    } as AuthenticatedRequest;
    const context = {
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
    return { request, context };
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    jwt.verifyAsync.mockResolvedValue({
      sub: userId,
      exp: Math.floor(Date.now() / 1000) + 900,
    });
    const module = await Test.createTestingModule({
      providers: [
        JwtAuthGuard,
        { provide: Reflector, useValue: reflector },
        { provide: JwtService, useValue: jwt },
      ],
    }).compile();
    guard = module.get(JwtAuthGuard);
  });

  it('allows explicitly public routes without verifying a token', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    await expect(guard.canActivate(contextFor().context)).resolves.toBe(true);
    expect(jwt.verifyAsync).not.toHaveBeenCalled();
  });

  it.each([undefined, '', 'Basic abc', 'Bearer', 'Bearer a b'])(
    'rejects a missing or malformed authorization header: %s',
    async (authorization) => {
      await expect(
        guard.canActivate(contextFor(authorization).context),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(jwt.verifyAsync).not.toHaveBeenCalled();
    },
  );

  it('attaches only the verified user ID', async () => {
    const { request, context } = contextFor('bearer valid-token');
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual({ id: userId });
    expect(jwt.verifyAsync).toHaveBeenCalledWith('valid-token');
  });

  it('rejects an invalid signature without exposing JWT internals', async () => {
    jwt.verifyAsync.mockRejectedValue(new Error('private JWT detail'));
    await expect(
      guard.canActivate(contextFor('Bearer invalid-token').context),
    ).rejects.toEqual(
      new UnauthorizedException('Invalid or expired access token'),
    );
  });

  it.each([
    { exp: 9_999_999_999 },
    { sub: 'not-a-uuid', exp: 9_999_999_999 },
    { sub: userId },
    { sub: userId, exp: '9999999999' },
    { sub: userId, exp: Number.POSITIVE_INFINITY },
    { sub: userId, exp: 1 },
    null,
  ])('rejects invalid or missing mandatory claims: %j', async (claims) => {
    jwt.verifyAsync.mockResolvedValue(claims);
    await expect(
      guard.canActivate(contextFor('Bearer token').context),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
