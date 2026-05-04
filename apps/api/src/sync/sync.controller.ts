import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { LocationAccess } from '../rbac/decorators/location-access.decorator';
import { Permissions } from '../rbac/decorators/permissions.decorator';
import { SyncService } from './sync.service';

@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Get('bootstrap')
  @Permissions('sync:read')
  bootstrap() {
    return this.syncService.list('bootstrap');
  }

  @Get('status')
  @Permissions('sync:read')
  status() {
    return this.syncService.list('status');
  }

  @Post('batch')
  @Permissions('sync:submit')
  @LocationAccess({ source: 'body', key: 'locationId' })
  submitBatch(@Body() body: unknown) {
    return this.syncService.action('batch.submit', body);
  }

  @Get('batches/:id')
  @Permissions('sync:read')
  getBatch(@Param('id') id: string) {
    return this.syncService.list('batches.detail', { id });
  }
}
