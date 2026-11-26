import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import type { FastifyRequest } from 'fastify';
import { AnalyticsModule } from './analytics/analytics.module';
import { AuthModule } from './auth/auth.module';
import { ClientIdentityModule } from './common/client-identity/client-identity.module';
import { ClientIdentityService } from './common/client-identity/client-identity.service';
import { validateEnvironment } from './common/config/environment';
import { HealthModule } from './health/health.module';
import { LinksModule } from './links/links.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedirectModule } from './redirect/redirect.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnvironment,
    }),
    ThrottlerModule.forRootAsync({
      imports: [ClientIdentityModule],
      inject: [ClientIdentityService],
      useFactory: (identity: ClientIdentityService) => ({
        throttlers: [{ ttl: 60_000, limit: 120 }],
        getTracker: (request: Record<string, unknown>) =>
          identity.getClientIp(request as unknown as FastifyRequest) ??
          'unknown',
      }),
    }),
    PrismaModule,
    AuthModule,
    HealthModule,
    LinksModule,
    AnalyticsModule,
    // Feature controllers must be registered before the public catch-all route.
    RedirectModule,
  ],
  providers: [
    // APP_GUARD applies this guard to every route (unless explicitly skipped).
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
