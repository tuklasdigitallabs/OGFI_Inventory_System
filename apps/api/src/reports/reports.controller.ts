import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('catalog')
  catalog() {
    return this.reportsService.list('catalog');
  }

  @Post('runs')
  runReport(@Body() body: unknown) {
    return this.reportsService.action('runs.create', body);
  }

  @Get('runs')
  listRuns(@Query() query: Record<string, string>) {
    return this.reportsService.list('runs', query);
  }

  @Get('runs/:id')
  getRun(@Param('id') id: string) {
    return this.reportsService.list('runs.detail', { id });
  }

  @Get('runs/:id/download')
  downloadRun(@Param('id') id: string) {
    return this.reportsService.list('runs.download', { id });
  }
}
