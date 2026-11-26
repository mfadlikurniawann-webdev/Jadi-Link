import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { ApiErrors } from '../common/swagger/api-errors.decorator';
import { HealthResponseDto } from './dto/health-response.dto';
import { HealthService } from './health.service';

@Controller('health')
@ApiTags('Health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({
    summary: 'Check API/database health',
    description: 'Public. Executes SELECT 1; no credentials are returned.',
  })
  @ApiOkResponse({ type: HealthResponseDto })
  @ApiErrors(503)
  @Public()
  @SkipThrottle()
  check(): Promise<HealthResponseDto> {
    return this.healthService.check();
  }
}
