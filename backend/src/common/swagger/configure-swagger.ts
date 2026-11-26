import { ConfigService } from '@nestjs/config';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NodeEnvironment } from '../config/environment';
import type { EnvironmentVariables } from '../config/environment';

export function configureSwagger(app: NestFastifyApplication): void {
  const config = app.get(ConfigService<EnvironmentVariables, true>);
  if (config.get('NODE_ENV') === NodeEnvironment.Production) return;

  const options = new DocumentBuilder()
    .setTitle('Jadi Link API')
    .setDescription(
      'URL shortener with owner-only link management and UTC click analytics. ' +
        'Redirects are public; protected API routes require an access token. ' +
        'Click analytics are best-effort and may lag by one batch flush interval.',
    )
    .setVersion('0.1.0')
    .addServer('/')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .build();
  const document = SwaggerModule.createDocument(app, options);
  SwaggerModule.setup('docs', app, document, {
    useGlobalPrefix: false,
    jsonDocumentUrl: '/docs/openapi.json',
    raw: ['json'],
    customSiteTitle: 'Jadi Link API',
    swaggerOptions: {
      persistAuthorization: false,
      validatorUrl: null,
      displayRequestDuration: true,
    },
  });
}
