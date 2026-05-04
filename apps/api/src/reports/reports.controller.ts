import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Permissions } from '../rbac/decorators/permissions.decorator';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('catalog')
  @Permissions('reports:read')
  catalog() {
    return this.reportsService.list('catalog');
  }

  @Post('runs')
  @Permissions('reports:run')
  runReport(@Body() body: unknown) {
    return this.reportsService.action('runs.create', body);
  }

  @Get('runs')
  @Permissions('reports:read')
  listRuns(@Query() query: Record<string, string>) {
    return this.reportsService.list('runs', query);
  }

  @Get('runs/:id')
  @Permissions('reports:read')
  getRun(@Param('id') id: string) {
    return this.reportsService.list('runs.detail', { id });
  }

  @Get('runs/:id/download')
  @Permissions('reports:read')
  downloadRun(@Param('id') id: string) {
    return this.reportsService.list('runs.download', { id });
  }
}
