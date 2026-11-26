import { Controller, Get, Header, Param, ParseUUIDPipe } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-request';
import { AnalyticsService } from './analytics.service';
import { ApiErrors } from '../common/swagger/api-errors.decorator';
import { AnalyticsResponseDto } from './dto/analytics-response.dto';

@Controller('links')
@ApiTags('Analytics')
@ApiBearerAuth('access-token')
@ApiErrors(400, 401, 404, 429, 500)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  // The global JWT guard runs first; SQL also scopes aggregation to the owner.
  @Get(':id/analytics')
  @ApiOperation({
    summary: 'Get click analytics for an owned link',
    description:
      '30 requests/minute/IP. Lifetime total plus 30 UTC calendar days (today partial). Reads persisted clicks only, without forcing buffer flush. Inactive/expired links remain readable by their owner.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Link UUID.' })
  @ApiOkResponse({ type: AnalyticsResponseDto })
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  forLink(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<AnalyticsResponseDto> {
    return this.analyticsService.forLink(user.id, id);
  }
}
