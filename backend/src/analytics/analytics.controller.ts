import { Controller, Get, Header, Param, ParseUUIDPipe } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-request';
import { AnalyticsService } from './analytics.service';
import type { AnalyticsResponseDto } from './dto/analytics-response.dto';

@Controller('links')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  // The global JWT guard runs first; SQL also scopes aggregation to the owner.
  @Get(':id/analytics')
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  forLink(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<AnalyticsResponseDto> {
    return this.analyticsService.forLink(user.id, id);
  }
}
