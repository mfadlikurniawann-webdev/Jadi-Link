import { createHmac, randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { FastifyRequest } from 'fastify';
import { ClientIdentityService } from '../common/client-identity/client-identity.service';
import type { EnvironmentVariables } from '../common/config/environment';
import { ClickBufferService } from './click-buffer.service';
import type { BufferedClickDto } from './dto/buffered-click.dto';

@Injectable()
export class ClickRecorderService {
  private readonly logger = new Logger(ClickRecorderService.name);
  private readonly secret: string;

  constructor(
    private readonly buffer: ClickBufferService,
    private readonly identity: ClientIdentityService,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.secret = config.get('VISITOR_HASH_SECRET');
  }

  // Called only after response.finish. No database I/O and no raw IP/UA retained.
  record(linkId: string, request: FastifyRequest, clickedAt: Date): void {
    try {
      const agent = request.headers['user-agent']?.slice(0, 512) ?? '';
      const ip = this.identity.getClientIp(request);
      const visitorHash = ip
        ? createHmac('sha256', this.secret)
            .update(linkId)
            .update('\0')
            .update(ip)
            .update('\0')
            .update(agent)
            .digest('hex')
        : null;
      this.buffer.enqueue({
        id: randomUUID(),
        linkId,
        clickedAt,
        referrer: this.referrerHostname(request.headers.referer),
        country: this.identity.getCountry(request),
        device: this.deviceType(agent),
        visitorHash,
      });
    } catch {
      // Telemetry failure must never escape into the response finish event.
      this.logger.warn('Click metadata could not be recorded');
    }
  }

  private referrerHostname(value: string | undefined): string | null {
    if (!value || value.length > 2048) return null;
    try {
      const url = new URL(value);
      const hostname = url.hostname.toLowerCase().replace(/\.+$/, '');
      return ['http:', 'https:'].includes(url.protocol) &&
        hostname.length > 0 &&
        hostname.length <= 253
        ? hostname
        : null;
    } catch {
      return null;
    }
  }

  private deviceType(agent: string): BufferedClickDto['device'] {
    if (!agent) return 'unknown';
    if (/bot|crawler|spider|slurp|facebookexternalhit|headless/i.test(agent))
      return 'bot';
    if (/ipad|tablet|kindle|silk|android(?!.*mobile)/i.test(agent))
      return 'tablet';
    if (/iphone|ipod|mobile|android/i.test(agent)) return 'mobile';
    if (/windows|macintosh|x11|linux|cros/i.test(agent)) return 'desktop';
    return 'unknown';
  }
}
