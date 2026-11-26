import helmet from '@fastify/helmet';
import {
  ClassSerializerInterceptor,
  RequestMethod,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { EnvironmentVariables } from './config/environment';
import { HttpExceptionFilter } from './filters/http-exception.filter';

export async function configureApp(app: NestFastifyApplication): Promise<void> {
  const config = app.get(ConfigService<EnvironmentVariables, true>);

  app.setGlobalPrefix('api', {
    // Nest matches exclusions against registered route templates. Escape ":" so
    // only "/:code" is excluded, not static "/health" or "/links" GET routes.
    exclude: [{ path: '\\:code', method: RequestMethod.GET }],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      validationError: { target: false, value: false },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
  await app.register(helmet);
  app.enableCors({
    origin: new URL(config.get('FRONTEND_ORIGIN')).origin,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false,
  });
  if (config.get('NODE_ENV') !== 'production') {
    // Do not generate or register the UI/spec on the production bootstrap path.
    const { configureSwagger } = await import('./swagger/configure-swagger');
    configureSwagger(app);
  }
  app.enableShutdownHooks();
}
