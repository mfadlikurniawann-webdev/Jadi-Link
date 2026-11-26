import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { ExceptionFilter } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<FastifyReply>();
    const request = context.getRequest<FastifyRequest>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let message: string | string[] = 'Internal server error';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      message = exception.message;
      error = exception.name.replace(/Exception$/, '');
      if (typeof body === 'string') {
        message = body;
      } else {
        const payload = body as {
          message?: string | string[];
          error?: string;
        };
        message = payload.message ?? message;
        error = payload.error ?? error;
      }
    }

    // Nest's default 404 message includes the request query; do not echo it.
    if (
      status === 404 &&
      typeof message === 'string' &&
      message.startsWith('Cannot ')
    ) {
      message = 'Resource not found';
    }

    if (status >= 500) {
      // Do not log request headers, URLs, or exception messages containing secrets.
      this.logger.error({
        requestId: request.id,
        statusCode: status,
        exception:
          exception instanceof Error ? exception.constructor.name : 'Unknown',
      });
    }

    void response
      .header('Cache-Control', 'no-store')
      .status(status)
      .send({
        statusCode: status,
        error,
        message,
        timestamp: new Date().toISOString(),
        path: request.url.split('?')[0],
        requestId: request.id,
      });
  }
}
