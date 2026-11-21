import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { HealthService } from './health.service.js';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'Check API availability' })
  @ApiResponse({ status: 200, schema: { example: { status: 'ok' } } })
  getStatus(): { status: 'ok' } {
    return this.healthService.getStatus();
  }

  @Get('database')
  @ApiOperation({ summary: 'Check database connectivity' })
  @ApiResponse({ status: 200, schema: { example: { status: 'ok' } } })
  getDatabaseStatus(): Promise<{ status: 'ok' | 'error' }> {
    return this.healthService.getDatabaseStatus();
  }
}
