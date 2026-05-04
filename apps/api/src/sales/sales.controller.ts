import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { LocationAccess } from '../rbac/decorators/location-access.decorator';
import { Permissions } from '../rbac/decorators/permissions.decorator';
import { SalesService } from './sales.service';

@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post('batches')
  @Permissions('sales.batches:create')
  @LocationAccess({ source: 'body', key: 'locationId' })
  createBatch(@Body() body: unknown) {
    return this.salesService.action('batches.create', body);
  }

  @Get('batches/:id')
  @Permissions('sales.batches:read')
  getBatch(@Param('id') id: string) {
    return this.salesService.list('batches.detail', { id });
  }
}
