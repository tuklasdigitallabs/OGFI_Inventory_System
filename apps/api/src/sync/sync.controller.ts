import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { SyncService } from './sync.service';

@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Get('bootstrap')
  bootstrap() {
    return this.syncService.list('bootstrap');
  }

  @Get('status')
  status() {
    return this.syncService.list('status');
  }

  @Post('batch')
  submitBatch(@Body() body: unknown) {
    return this.syncService.action('batch.submit', body);
  }

  @Get('batches/:id')
  getBatch(@Param('id') id: string) {
    return this.syncService.list('batches.detail', { id });
  }
}
