import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import type { EnvironmentVariables } from './common/config/environment';
import { configureApp } from './common/configure-app';

async function bootstrap(): Promise<void> {
  // ConfigModule validates env while AppModule is loaded, before this runs.
  const trustProxy = (process.env['TRUST_PROXY'] ?? '127.0.0.1,::1')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      trustProxy,
      bodyLimit: 64 * 1024,
      requestTimeout: 10_000,
    }),
    { bufferLogs: true, abortOnError: false },
  );
  try {
    await configureApp(app);
    const config = app.get(ConfigService<EnvironmentVariables, true>);
    await app.listen(config.get('PORT'), config.get('HOST'));
    new Logger('Bootstrap').log(`API listening on port ${config.get('PORT')}`);
  } catch (error) {
    await app.close();
    throw error;
  }
}

void bootstrap().catch(() => {
  // Avoid printing driver errors which might contain connection credentials.
  new Logger('Bootstrap').error(
    'Startup failed. Check environment variables and database connectivity.',
  );
  process.exitCode = 1;
});
