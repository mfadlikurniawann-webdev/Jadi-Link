import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { isUUID } from 'class-validator';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request';

interface AccessTokenClaims {
  sub?: unknown;
  exp?: unknown;
}

// A guard runs before the controller. APP_GUARD protects all routes by default.
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ])
    ) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    const token =
      typeof authorization === 'string'
        ? /^Bearer ([^\s]+)$/i.exec(authorization)?.[1]
        : undefined;
    if (!token) {
      throw new UnauthorizedException('A Bearer access token is required');
    }

    let claims: AccessTokenClaims;
    try {
      // Algorithm, issuer, audience, signature and expiry are checked by JwtModule.
      claims = await this.jwtService.verifyAsync<AccessTokenClaims>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }

    if (
      !claims ||
      typeof claims.sub !== 'string' ||
      !isUUID(claims.sub, '4') ||
      typeof claims.exp !== 'number' ||
      !Number.isFinite(claims.exp) ||
      claims.exp <= Math.floor(Date.now() / 1000)
    ) {
      throw new UnauthorizedException('Invalid or expired access token');
    }

    request.user = { id: claims.sub };
    return true;
  }
}
