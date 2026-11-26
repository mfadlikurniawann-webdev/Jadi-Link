import { Injectable } from '@nestjs/common';
import type { OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import type { EnvironmentVariables } from '../common/config/environment';
import { withUtcTimezone } from './connection-options';

// A provider is a class whose dependencies Nest injects through its constructor.
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnApplicationShutdown
{
  constructor(config: ConfigService<EnvironmentVariables, true>) {
    super({
      adapter: new PrismaPg({
        connectionString: withUtcTimezone(config.get('DATABASE_URL')),
        max: config.get('DATABASE_POOL_MAX'),
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 5_000,
        query_timeout: 5_000,
      }),
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      await this.$queryRaw`SELECT 1`;
    } catch {
      await this.$disconnect();
      throw new Error('Database connection failed');
    }
  }

  // Fastify onClose drains click batches before this final lifecycle hook.
  async onApplicationShutdown(): Promise<void> {
    await this.$disconnect();
  }
}
