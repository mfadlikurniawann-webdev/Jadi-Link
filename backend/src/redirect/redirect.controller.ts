import { Controller, Get, Param, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { Public } from '../common/decorators/public.decorator';
import { ApiErrors } from '../common/swagger/api-errors.decorator';
import { ClickRecorderService } from './click-recorder.service';
import { RedirectService } from './redirect.service';

@Controller()
@ApiTags('Redirect')
export class RedirectController {
  constructor(
    private readonly redirectService: RedirectService,
    private readonly recorder: ClickRecorderService,
  ) {}

  @Get(':code')
  @ApiOperation({
    summary: 'Redirect a public short link',
    description:
      'No /api prefix or token. 600 requests/minute/IP. A successful GET buffers a click only after response finish. HEAD does not count a click.',
  })
  @ApiParam({
    name: 'code',
    schema: {
      type: 'string',
      minLength: 3,
      maxLength: 64,
      pattern: '^[A-Za-z0-9][A-Za-z0-9_-]{2,63}$',
    },
    example: 'my-portfolio',
  })
  @ApiResponse({
    status: 302,
    description: 'Temporary redirect; empty response body.',
    headers: {
      Location: {
        description: 'Destination URL',
        schema: { type: 'string', format: 'uri' },
      },
      'Cache-Control': { schema: { type: 'string', example: 'no-store' } },
    },
  })
  @ApiErrors(404, 410, 429, 500)
  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 600 } })
  async redirect(
    @Param('code') code: string,
    @Req() request: FastifyRequest,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const clickedAt = new Date();
    const link = await this.redirectService.resolve(code);
    if (request.method === 'GET') {
      reply.raw.once('finish', () => {
        if (reply.raw.statusCode === 302) {
          this.recorder.record(link.id, request, clickedAt);
        }
      });
    }
    // Prevent browser/CDN caching, so changes and click counts reach the server.
    reply
      .code(302)
      .header('Cache-Control', 'no-store')
      .header('Location', link.targetUrl)
      .send();
  }
}
