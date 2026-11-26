import {
  BadRequestException,
  HttpException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  const reply = {
    header: jest.fn().mockReturnThis(),
    status: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  };
  const request = {
    id: 'req-test',
    url: '/api/links?token=private-query-value',
  };
  const host = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => reply,
    }),
  } as unknown as ArgumentsHost;
  const filter = new HttpExceptionFilter();
  let log: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    log = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('preserves validation arrays and returns a consistent, non-cacheable envelope', () => {
    filter.catch(new BadRequestException(['targetUrl is required']), host);
    expect(reply.header).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(reply.status).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith({
      statusCode: 400,
      error: 'Bad Request',
      message: ['targetUrl is required'],
      timestamp: expect.any(String) as string,
      path: '/api/links',
      requestId: 'req-test',
    });
    expect(log).not.toHaveBeenCalled();
  });

  it('supports a string HttpException response', () => {
    filter.catch(new HttpException('Custom message', 418), host);
    expect(reply.status).toHaveBeenCalledWith(418);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 418, message: 'Custom message' }),
    );
  });

  it('removes query strings from the default Nest 404 message', () => {
    filter.catch(
      new NotFoundException('Cannot GET /api/links?token=private-query-value'),
      host,
    );
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Resource not found',
        path: '/api/links',
      }),
    );
    expect(JSON.stringify(reply.send.mock.calls)).not.toContain(
      'private-query-value',
    );
  });

  it('hides unknown driver errors and logs only safe identifiers', () => {
    filter.catch(new Error('sensitive database diagnostics'), host);
    expect(reply.status).toHaveBeenCalledWith(500);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Internal server error' }),
    );
    expect(log).toHaveBeenCalledWith({
      requestId: 'req-test',
      statusCode: 500,
      exception: 'Error',
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain(
      'sensitive database diagnostics',
    );
    expect(JSON.stringify(reply.send.mock.calls)).not.toContain(
      'sensitive database diagnostics',
    );
  });

  it('logs a known 503 without adding private exception details', () => {
    filter.catch(
      new ServiceUnavailableException('Database is unavailable'),
      host,
    );
    expect(reply.status).toHaveBeenCalledWith(503);
    expect(log).toHaveBeenCalledWith({
      requestId: 'req-test',
      statusCode: 503,
      exception: 'ServiceUnavailableException',
    });
  });
});
