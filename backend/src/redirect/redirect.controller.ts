import { Controller, Get, Param, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { Public } from '../common/decorators/public.decorator';
import { ClickRecorderService } from './click-recorder.service';
import { RedirectService } from './redirect.service';

@Controller()
export class RedirectController {
  constructor(
    private readonly redirectService: RedirectService,
    private readonly recorder: ClickRecorderService,
  ) {}

  @Get(':code')
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
